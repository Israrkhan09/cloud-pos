<?php

namespace App\Services;

use App\Models\Option;
use App\Models\SyncOutbox;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SyncUploadService
{
    protected string $serverUrl;
    protected int $timeoutSeconds;
    protected int $retryAttempts;
    protected int $retryBackoffMs;

    public function __construct(
        protected SyncQueueService $syncQueueService,
        protected DeviceService $deviceService
    ) {
        $this->serverUrl = rtrim((string) config('sync.server_url', 'https://api.sudoleads.com'), '/');
        $this->timeoutSeconds = (int) config('sync.timeout_seconds', 30);
        $this->retryAttempts = (int) config('sync.retry_attempts', 3);
        $this->retryBackoffMs = (int) config('sync.retry_backoff_ms', 500);
    }

    /**
     * Upload a single batch of pending outbox events to the central server.
     *
     * @return array{
     *     success: bool,
     *     message: string,
     *     synced_count: int,
     *     pending_remaining: int,
     *     error?: string,
     *     acknowledged?: array
     * }
     */
    public function uploadPending(int $batchSize = 100, bool $retryFailed = false): array
    {
        $lock = null;
        try {
            $lock = Cache::lock('pos_sync_upload_running', 60);
            if (!$lock->get()) {
                return [
                    'success'           => false,
                    'error'             => 'sync_in_progress',
                    'message'           => 'A synchronization upload is already in progress.',
                    'synced_count'      => 0,
                    'pending_remaining' => SyncOutbox::pending()->count(),
                ];
            }
        } catch (\Throwable $e) {
            // If cache driver doesn't support locking, proceed safely
            $lock = null;
        }

        try {
            if ($retryFailed) {
                $this->syncQueueService->retryFailed($batchSize);
            }

            $pending = $this->syncQueueService->getPendingEvents($batchSize);

            if ($pending->isEmpty()) {
                return [
                    'success'           => true,
                    'message'           => 'No pending sync events in outbox.',
                    'synced_count'      => 0,
                    'pending_remaining' => 0,
                    'acknowledged'      => [],
                ];
            }

            $deviceId = $this->deviceService->getDeviceId();
            $token = $this->ensureAuthenticated();

            if (empty($token)) {
                // If authentication fails, un-process events and keep them pending
                return [
                    'success'           => false,
                    'error'             => 'auth_failed',
                    'message'           => 'Failed to authenticate POS device with central sync server.',
                    'synced_count'      => 0,
                    'pending_remaining' => SyncOutbox::pending()->count(),
                ];
            }

            return $this->sendBatch($pending, $token, $deviceId);
        } catch (\Throwable $e) {
            Log::error('SyncUploadService::uploadPending unhandled error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success'           => false,
                'error'             => 'exception',
                'message'           => 'Sync upload error: ' . $e->getMessage(),
                'synced_count'      => 0,
                'pending_remaining' => SyncOutbox::pending()->count(),
            ];
        } finally {
            if ($lock) {
                try {
                    $lock->release();
                } catch (\Throwable) {
                    // Safe ignore
                }
            }
        }
    }

    /**
     * Upload all pending events in iterative batches until the queue is drained.
     */
    public function uploadAll(int $batchSize = 100, int $maxBatches = 50, bool $retryFailed = false): array
    {
        $totalSynced = 0;
        $batchCount = 0;
        $lastResult = null;

        while ($batchCount < $maxBatches) {
            $batchResult = $this->uploadPending($batchSize, $retryFailed && $batchCount === 0);
            $lastResult = $batchResult;

            if (!$batchResult['success']) {
                break;
            }

            $syncedInBatch = $batchResult['synced_count'];
            $totalSynced += $syncedInBatch;
            $batchCount++;

            // If no events were synced or remaining is 0, we are done
            if ($syncedInBatch === 0 || ($batchResult['pending_remaining'] ?? 0) === 0) {
                break;
            }
        }

        return [
            'success'           => $lastResult['success'] ?? true,
            'message'           => "Uploaded {$totalSynced} event(s) across {$batchCount} batch(es).",
            'synced_count'      => $totalSynced,
            'batches_processed' => $batchCount,
            'pending_remaining' => SyncOutbox::pending()->count(),
            'last_error'        => $lastResult['error'] ?? null,
        ];
    }

    /**
     * Dispatch the batch HTTP request to the central server and handle acknowledgment.
     */
    protected function sendBatch(Collection $pending, string $token, string $deviceId): array
    {
        // Mark events as processing during in-flight request
        foreach ($pending as $event) {
            $this->syncQueueService->markAsProcessing($event);
        }

        $eventsPayload = $pending->map(function (SyncOutbox $outbox) use ($deviceId) {
            return [
                'event_uuid'  => $outbox->uuid,
                'device_id'   => $deviceId,
                'entity_type' => $outbox->entity_type,
                'entity_uuid' => $outbox->entity_uuid,
                'operation'   => $outbox->operation,
                'payload'     => $outbox->payload,
                'timestamp'   => $outbox->created_at?->toIso8601String(),
            ];
        })->values()->all();

        $pushEndpoint = (string) config('sync.endpoints.push', '/api/v1/sync/push');
        $url = $this->serverUrl . $pushEndpoint;

        try {
            /** @var Response $response */
            $response = Http::timeout($this->timeoutSeconds)
                ->retry($this->retryAttempts, $this->retryBackoffMs, function (\Throwable $exception) {
                    return $exception instanceof ConnectionException;
                }, throw: false)
                ->withToken($token)
                ->withHeaders([
                    'Accept'       => 'application/json',
                    'Content-Type' => 'application/json',
                    'X-Device-Id'  => $deviceId,
                ])
                ->post($url, [
                    'device_id' => $deviceId,
                    'events'    => $eventsPayload,
                ]);

            if ($response->status() === 401 || $response->status() === 403) {
                // Token invalid, expired, or belongs to wrong business on server; clear and re-authenticate once
                $this->clearStoredToken();
                $newToken = $this->ensureAuthenticated();

                if (!empty($newToken) && $newToken !== $token) {
                    $response = Http::timeout($this->timeoutSeconds)
                        ->withToken($newToken)
                        ->withHeaders([
                            'Accept'       => 'application/json',
                            'Content-Type' => 'application/json',
                            'X-Device-Id'  => $deviceId,
                        ])
                        ->post($url, [
                            'device_id' => $deviceId,
                            'events'    => $eventsPayload,
                        ]);
                }
            }

            if ($response->successful()) {
                $responseData = $response->json();
                $acknowledged = $responseData['data']['acknowledged_event_uuids'] ?? [];
                $acknowledgedLookup = array_flip($acknowledged);

                $syncedCount = 0;
                foreach ($pending as $event) {
                    if (isset($acknowledgedLookup[$event->uuid])) {
                        $this->syncQueueService->markAsSynced($event);
                        $syncedCount++;
                    } else {
                        // Unacknowledged events must remain pending for retry
                        $event->update([
                            'status'     => SyncOutbox::STATUS_PENDING,
                            'attempts'   => $event->attempts + 1,
                            'last_error' => 'Server did not acknowledge event UUID',
                        ]);
                    }
                }

                return [
                    'success'           => true,
                    'message'           => "Batch uploaded successfully: {$syncedCount} of {$pending->count()} acknowledged.",
                    'synced_count'      => $syncedCount,
                    'pending_remaining' => SyncOutbox::pending()->count(),
                    'acknowledged'      => $acknowledged,
                ];
            }

            // HTTP error response (4xx or 5xx)
            $errorMsg = "Server returned HTTP {$response->status()}: " . ($response->json('message') ?: $response->body());
            foreach ($pending as $event) {
                $attempts = $event->attempts + 1;
                $status = ($attempts >= 5) ? SyncOutbox::STATUS_FAILED : SyncOutbox::STATUS_PENDING;
                $event->update([
                    'status'     => $status,
                    'attempts'   => $attempts,
                    'last_error' => $errorMsg,
                ]);
            }

            return [
                'success'           => false,
                'error'             => 'http_' . $response->status(),
                'message'           => $errorMsg,
                'synced_count'      => 0,
                'pending_remaining' => SyncOutbox::pending()->count(),
            ];
        } catch (ConnectionException $e) {
            // Offline / network failure: Keep events in pending queue with attempts incremented
            $errorMsg = 'Network connection failed: ' . $e->getMessage();
            Log::info("POS offline or sync server unreachable: {$errorMsg}");

            foreach ($pending as $event) {
                $event->update([
                    'status'     => SyncOutbox::STATUS_PENDING,
                    'attempts'   => $event->attempts + 1,
                    'last_error' => $errorMsg,
                ]);
            }

            return [
                'success'           => false,
                'error'             => 'network_unavailable',
                'message'           => 'Central server is unreachable. Offline mode active.',
                'synced_count'      => 0,
                'pending_remaining' => SyncOutbox::pending()->count(),
            ];
        }
    }

    /**
     * Ensure the POS device has an authenticated API token, registering if necessary.
     */
    public function ensureAuthenticated(?string $businessId = null): ?string
    {
        $targetBusinessId = $businessId ?: $this->resolveActiveBusinessId();
        $token = $this->getStoredToken($targetBusinessId);
        if (!empty($token)) {
            return $token;
        }

        return $this->registerDevice($targetBusinessId);
    }

    /**
     * Register this POS desktop device with the central server and persist the returned token.
     * Uses existing central endpoint: POST /api/v1/sync/register
     */
    public function registerDevice(?string $token = null): ?string
    {
        $info = $this->deviceService->getDeviceInfo();
        $registrationKey = config('sync.registration_key');

        $authToken = $token ?: $this->getStoredToken();

        $payload = [
            'device_id'        => $info['device_id'],
            'device_name'      => config('app.name', 'JKC Mandi POS'),
            'hostname'         => $info['hostname'],
            'os'               => $info['os'],
            'app_version'      => config('app.version', 'v2.4.1'),
            'registration_key' => $registrationKey,
            'metadata'         => [
                'php_version' => $info['php_version'],
                'created_at'  => $info['created_at'],
            ],
        ];

        $headers = [
            'Accept'       => 'application/json',
            'Content-Type' => 'application/json',
        ];
        if (!empty($registrationKey)) {
            $headers['X-Sync-Registration-Key'] = (string) $registrationKey;
        }
        if (!empty($authToken)) {
            $headers['Authorization'] = 'Bearer ' . $authToken;
        }

        try {
            $registerEndpoint = (string) config('sync.endpoints.register', '/api/v1/sync/register');
            $url = $this->serverUrl . $registerEndpoint;
            $response = Http::timeout($this->timeoutSeconds)
                ->withHeaders($headers)
                ->post($url, $payload);

            if ($response->successful()) {
                $returnedToken = $response->json('data.api_token') ?: $authToken;
                if (!empty($returnedToken)) {
                    $this->storeToken((string) $returnedToken);
                    return (string) $returnedToken;
                }
            }

            Log::warning('Device registration response on central server: ' . $response->body());
        } catch (\Throwable $e) {
            Log::info('Cannot register device (server unreachable): ' . $e->getMessage());
        }

        return $authToken;
    }

    /**
     * Retrieve the stored API token from config, options table, or storage file,
     * validating that it matches the target business identity and is unexpired.
     */
    public function getStoredToken(?string $expectedBusinessId = null): ?string
    {
        $targetBusinessId = $expectedBusinessId ?: $this->resolveActiveBusinessId();

        // 1. Check environment / config
        $configToken = config('sync.device_token');
        if (!empty($configToken) && $this->isTokenValidForBusiness((string) $configToken, $targetBusinessId)) {
            return trim((string) $configToken);
        }

        // 2. Check options table
        try {
            $dbToken = Option::where('meta_key', 'sync_device_token')->value('meta_value');
            if (!empty($dbToken)) {
                if ($this->isTokenValidForBusiness((string) $dbToken, $targetBusinessId)) {
                    return trim((string) $dbToken);
                } else {
                    Option::where('meta_key', 'sync_device_token')->delete();
                }
            }
        } catch (\Throwable) {
            // Options table may not be ready
        }

        // 3. Check persistent storage file
        try {
            $filePath = storage_path('app/sync_token.json');
            if (File::exists($filePath)) {
                $data = json_decode(File::get($filePath), true);
                if (!empty($data['api_token'])) {
                    if ($this->isTokenValidForBusiness((string) $data['api_token'], $targetBusinessId)) {
                        return trim((string) $data['api_token']);
                    } else {
                        File::delete($filePath);
                    }
                }
            }
        } catch (\Throwable) {
            // Ignore storage errors
        }

        return null;
    }

    /**
     * Decode JWT payload without verification (verification is performed by central backend).
     */
    public function decodeJwtPayload(string $token): ?array
    {
        $parts = explode('.', trim($token));
        if (count($parts) !== 3) {
            return null;
        }

        $payloadJson = base64_decode(strtr($parts[1], '-_', '+/'));
        if (!$payloadJson) {
            return null;
        }

        return json_decode($payloadJson, true) ?: null;
    }

    /**
     * Check if a token is valid, unexpired, and matches the expected business if it is a JWT.
     */
    public function isTokenValidForBusiness(string $token, ?string $expectedBusinessId = null): bool
    {
        $payload = $this->decodeJwtPayload($token);
        if (!$payload) {
            // Not a JWT (e.g. plain test token or custom API key)
            return !empty(trim($token));
        }

        // Check expiration
        if (isset($payload['exp']) && $payload['exp'] < (time() + 60)) {
            return false;
        }

        // Check business identity if specified and present in token
        if (!empty($expectedBusinessId)) {
            $tokenBiz = $payload['businessId'] ?? ($payload['business_id'] ?? null);
            if (!empty($tokenBiz) && $tokenBiz !== $expectedBusinessId) {
                return false;
            }
        }

        return true;
    }

    /**
     * Resolve the active canonical business ID for the current context.
     */
    public function resolveActiveBusinessId(): ?string
    {
        // 1. From TenantContext
        $biz = app(\App\Services\TenantContext::class)->getBusinessId();
        if (!empty($biz)) {
            return $biz;
        }

        // 2. From Session
        if (session()->has('active_business_id')) {
            $sessionBiz = session('active_business_id');
            if (!empty($sessionBiz)) {
                return (string) $sessionBiz;
            }
        }

        // 3. From authenticated user
        if (auth()->check() && !empty(auth()->user()->business_id)) {
            return (string) auth()->user()->business_id;
        }

        // 4. Default to Kashmir Sabzi Mandi canonical business if active in users
        try {
            $userWithBiz = \App\Models\User::whereNotNull('business_id')
                ->where('business_id', '!=', 'biz-test-business')
                ->orderBy('id', 'desc')
                ->first();
            if ($userWithBiz && !empty($userWithBiz->business_id)) {
                return (string) $userWithBiz->business_id;
            }
        } catch (\Throwable) {
            // Safe fallback
        }

        return null;
    }

    /**
     * Persist the device API token locally.
     */
    public function storeToken(string $token): void
    {
        try {
            Option::updateOrCreate(
                ['meta_key' => 'sync_device_token'],
                [
                    'meta_value'    => $token,
                    'meta_category' => 'sync',
                ]
            );
        } catch (\Throwable) {
            // Database may be restricted
        }

        try {
            $dir = storage_path('app');
            if (!File::isDirectory($dir)) {
                File::makeDirectory($dir, 0755, true, true);
            }
            File::put(
                $dir . DIRECTORY_SEPARATOR . 'sync_token.json',
                json_encode(['api_token' => $token, 'updated_at' => date('c')], JSON_PRETTY_PRINT)
            );
            File::put(
                $dir . DIRECTORY_SEPARATOR . 'device_token.json',
                json_encode([
                    'token'      => trim($token),
                    'device_id'  => $this->deviceService->getDeviceId(),
                    'updated_at' => date('c'),
                ], JSON_PRETTY_PRINT)
            );
        } catch (\Throwable) {
            // Storage write safe failure
        }
    }

    /**
     * Remove the locally stored device token.
     */
    public function clearStoredToken(): void
    {
        try {
            Option::where('meta_key', 'sync_device_token')->delete();
        } catch (\Throwable) {
            // Safe ignore
        }

        try {
            $filePath = storage_path('app/sync_token.json');
            if (File::exists($filePath)) {
                File::delete($filePath);
            }
            $devTokenPath = storage_path('app/device_token.json');
            if (File::exists($devTokenPath)) {
                File::delete($devTokenPath);
            }
        } catch (\Throwable) {
            // Safe ignore
        }
    }
}
