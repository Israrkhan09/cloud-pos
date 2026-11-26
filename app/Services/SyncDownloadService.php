<?php

namespace App\Services;

use App\Models\Option;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SyncDownloadService
{
    protected string $serverUrl;
    protected int $timeoutSeconds;
    protected int $retryAttempts;
    protected int $retryBackoffMs;

    public function __construct(
        protected CentralEventProcessor $eventProcessor,
        protected SyncUploadService $uploadService,
        protected DeviceService $deviceService
    ) {
        $this->serverUrl = rtrim((string) config('sync.server_url', 'https://api.sudoleads.com'), '/');
        $this->timeoutSeconds = (int) config('sync.timeout_seconds', 30);
        $this->retryAttempts = (int) config('sync.retry_attempts', 3);
        $this->retryBackoffMs = (int) config('sync.retry_backoff_ms', 500);
    }

    /**
     * Download a single batch of new events from the central server and apply them to local SQLite.
     *
     * @return array{
     *     success: bool,
     *     message: string,
     *     applied_count: int,
     *     failed_count: int,
     *     current_cursor: int,
     *     has_more: bool,
     *     errors: array,
     *     error?: string
     * }
     */
    public function downloadPending(int $batchSize = 100): array
    {
        $lock = Cache::lock('pos_sync_download_running', 60);

        if (!$lock->get()) {
            return [
                'success'        => false,
                'error'          => 'sync_in_progress',
                'message'        => 'A download synchronization is already in progress.',
                'applied_count'  => 0,
                'failed_count'   => 0,
                'current_cursor' => $this->getStoredCursor(),
                'has_more'       => false,
                'errors'         => [],
            ];
        }

        try {
            $cursor = $this->getStoredCursor();
            $deviceId = $this->deviceService->getDeviceId();
            $token = $this->uploadService->ensureAuthenticated();

            if (empty($token)) {
                return [
                    'success'        => false,
                    'error'          => 'auth_failed',
                    'message'        => 'Failed to authenticate POS device with central sync server.',
                    'applied_count'  => 0,
                    'failed_count'   => 0,
                    'current_cursor' => $cursor,
                    'has_more'       => false,
                    'errors'         => [],
                ];
            }

            $pullEndpoint = (string) config('sync.endpoints.pull', '/api/v1/sync/pull');
            $url = $this->serverUrl . $pullEndpoint;

            /** @var Response $response */
            $response = Http::timeout($this->timeoutSeconds)
                ->retry($this->retryAttempts, $this->retryBackoffMs, function (\Throwable $exception) {
                    return $exception instanceof ConnectionException;
                }, throw: false)
                ->withToken($token)
                ->withHeaders([
                    'Accept'      => 'application/json',
                    'X-Device-Id' => $deviceId,
                ])
                ->get($url, [
                    'device_id'    => $deviceId,
                    'since_cursor' => $cursor,
                    'limit'        => $batchSize,
                    'include_self' => false,
                ]);

            if ($response && ($response->status() === 401 || $response->status() === 403)) {
                // Token expired/rotated or mismatched business; refresh and retry once
                $this->uploadService->clearStoredToken();
                $newToken = $this->uploadService->ensureAuthenticated();

                if (!empty($newToken)) {
                    $response = Http::timeout($this->timeoutSeconds)
                        ->withToken($newToken)
                        ->withHeaders([
                            'Accept'      => 'application/json',
                            'X-Device-Id' => $deviceId,
                        ])
                        ->get($url, [
                            'device_id'    => $deviceId,
                            'since_cursor' => $cursor,
                            'limit'        => $batchSize,
                            'include_self' => false,
                        ]);
                }
            }

            if (!$response || !$response->successful()) {
                $status = $response ? $response->status() : 500;
                $msg = $response ? ($response->json('message') ?: $response->body()) : 'No response from server';
                $errorMsg = "Central server returned HTTP {$status}: {$msg}";
                return [
                    'success'        => false,
                    'error'          => 'http_' . $status,
                    'message'        => $errorMsg,
                    'applied_count'  => 0,
                    'failed_count'   => 0,
                    'current_cursor' => $cursor,
                    'has_more'       => false,
                    'errors'         => [],
                ];
            }

            $data = $response->json('data') ?? [];
            $events = $data['events'] ?? [];
            $nextCursor = (int) ($data['next_cursor'] ?? $cursor);
            $hasMore = (bool) ($data['has_more'] ?? false);

            if (empty($events)) {
                if ($nextCursor > $cursor) {
                    $this->storeCursor($nextCursor);
                }

                return [
                    'success'        => true,
                    'message'        => 'Already up to date with central server. No new events.',
                    'applied_count'  => 0,
                    'failed_count'   => 0,
                    'current_cursor' => $nextCursor,
                    'has_more'       => false,
                    'errors'         => [],
                ];
            }

            // Materialize incoming remote events into local SQLite business tables
            $result = $this->eventProcessor->processBatch($events);

            if ($result['failed'] === 0) {
                // All events in batch applied cleanly; advance cursor
                $this->storeCursor($nextCursor);
            } else {
                Log::warning("SyncDownloadService: {$result['failed']} events failed to apply.", [
                    'errors' => $result['errors'],
                ]);
            }

            return [
                'success'        => $result['failed'] === 0,
                'message'        => "Downloaded " . count($events) . " events: {$result['processed']} applied, {$result['failed']} failed.",
                'applied_count'  => $result['processed'],
                'failed_count'   => $result['failed'],
                'current_cursor' => $result['failed'] === 0 ? $nextCursor : $cursor,
                'has_more'       => $hasMore,
                'errors'         => $result['errors'],
            ];
        } catch (ConnectionException $e) {
            $errorMsg = 'Network connection failed: ' . $e->getMessage();
            Log::info("POS download sync offline or server unreachable: {$errorMsg}");

            return [
                'success'        => false,
                'error'          => 'network_unavailable',
                'message'        => 'Central server is unreachable. Offline mode active.',
                'applied_count'  => 0,
                'failed_count'   => 0,
                'current_cursor' => $this->getStoredCursor(),
                'has_more'       => false,
                'errors'         => [],
            ];
        } catch (\Throwable $e) {
            Log::error('SyncDownloadService::downloadPending unhandled error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success'        => false,
                'error'          => 'exception',
                'message'        => 'Download sync error: ' . $e->getMessage(),
                'applied_count'  => 0,
                'failed_count'   => 0,
                'current_cursor' => $this->getStoredCursor(),
                'has_more'       => false,
                'errors'         => [],
            ];
        } finally {
            $lock->release();
        }
    }

    /**
     * Download all available batches until the client is fully caught up with the central server.
     */
    public function downloadAll(int $batchSize = 100, int $maxBatches = 20): array
    {
        $totalApplied = 0;
        $totalFailed = 0;
        $batchesCount = 0;
        $lastResult = null;

        while ($batchesCount < $maxBatches) {
            $batchResult = $this->downloadPending($batchSize);
            $lastResult = $batchResult;

            if (!$batchResult['success']) {
                break;
            }

            $applied = $batchResult['applied_count'];
            $totalApplied += $applied;
            $totalFailed += $batchResult['failed_count'];
            $batchesCount++;

            // If no more events available or 0 applied, we are caught up
            if (!$batchResult['has_more'] || $applied === 0) {
                break;
            }
        }

        return [
            'success'        => $lastResult['success'] ?? true,
            'message'        => "Downloaded and applied {$totalApplied} event(s) across {$batchesCount} batch(es).",
            'applied_count'  => $totalApplied,
            'failed_count'   => $totalFailed,
            'batches_count'  => $batchesCount,
            'current_cursor' => $this->getStoredCursor(),
            'last_error'     => $lastResult['error'] ?? null,
            'errors'         => $lastResult['errors'] ?? [],
        ];
    }

    /**
     * Resolve the storage key for the download cursor scoped to current tenant.
     */
    public function getCursorMetaKey(?string $businessId = null): string
    {
        $bizId = $businessId ?: app(\App\Services\TenantContext::class)->getBusinessId();
        return !empty($bizId) ? "sync_download_cursor_{$bizId}" : 'sync_download_cursor';
    }

    /**
     * Get the current download cursor from local options table or persistent storage file.
     */
    public function getStoredCursor(?string $businessId = null): int
    {
        $metaKey = $this->getCursorMetaKey($businessId);

        // 1. Check database options table for business-scoped cursor
        try {
            $dbCursor = Option::where('meta_key', $metaKey)->value('meta_value');
            if ($dbCursor !== null && is_numeric($dbCursor)) {
                return (int) $dbCursor;
            }

            // Fallback to legacy unscoped cursor if business-specific key not yet initialized
            if ($metaKey !== 'sync_download_cursor') {
                $legacyCursor = Option::where('meta_key', 'sync_download_cursor')->value('meta_value');
                if ($legacyCursor !== null && is_numeric($legacyCursor)) {
                    return (int) $legacyCursor;
                }
            }
        } catch (\Throwable) {
            // Options table may not be ready
        }

        // 2. Check storage file
        try {
            $filePath = storage_path('app/sync_cursor.json');
            if (File::exists($filePath)) {
                $data = json_decode(File::get($filePath), true);
                $bizId = $businessId ?: app(\App\Services\TenantContext::class)->getBusinessId();

                if ($bizId && isset($data['cursors'][$bizId]) && is_numeric($data['cursors'][$bizId])) {
                    return (int) $data['cursors'][$bizId];
                }

                if (isset($data['cursor']) && is_numeric($data['cursor'])) {
                    $fileDeviceId = $data['device_id'] ?? null;
                    $currentDeviceId = $this->deviceService->getDeviceId();
                    if ($fileDeviceId === null || $fileDeviceId === $currentDeviceId) {
                        return (int) $data['cursor'];
                    }
                }
            }
        } catch (\Throwable) {
            // Safe ignore
        }

        return 0;
    }

    /**
     * Persist the download cursor locally in both database and storage file.
     */
    public function storeCursor(int $cursor, ?string $businessId = null): void
    {
        $metaKey = $this->getCursorMetaKey($businessId);
        $bizId = $businessId ?: app(\App\Services\TenantContext::class)->getBusinessId();

        try {
            Option::updateOrCreate(
                ['meta_key' => $metaKey],
                [
                    'meta_value'    => (string) $cursor,
                    'meta_category' => 'sync',
                ]
            );
        } catch (\Throwable) {
            // Safe ignore
        }

        try {
            $dir = storage_path('app');
            if (!File::isDirectory($dir)) {
                File::makeDirectory($dir, 0755, true, true);
            }

            $filePath = $dir . DIRECTORY_SEPARATOR . 'sync_cursor.json';
            $existingData = [];
            if (File::exists($filePath)) {
                $existingData = json_decode(File::get($filePath), true) ?: [];
            }

            $cursors = $existingData['cursors'] ?? [];
            if ($bizId) {
                $cursors[$bizId] = $cursor;
            }

            File::put(
                $filePath,
                json_encode([
                    'cursor'           => $cursor,
                    'cursors'          => $cursors,
                    'device_id'        => $this->deviceService->getDeviceId(),
                    'last_download_at' => date('c'),
                ], JSON_PRETTY_PRINT)
            );
        } catch (\Throwable) {
            // Safe ignore
        }
    }

    /**
     * Reset the local download cursor to 0 to trigger a full resync.
     */
    public function resetCursor(?string $businessId = null): void
    {
        $metaKey = $this->getCursorMetaKey($businessId);

        try {
            Option::where('meta_key', $metaKey)->delete();
            Option::where('meta_key', 'sync_download_cursor')->delete();
        } catch (\Throwable) {
            // Safe ignore
        }

        try {
            $filePath = storage_path('app/sync_cursor.json');
            if (File::exists($filePath)) {
                File::delete($filePath);
            }
        } catch (\Throwable) {
            // Safe ignore
        }
    }
}
