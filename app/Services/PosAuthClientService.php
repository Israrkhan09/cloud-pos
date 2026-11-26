<?php

namespace App\Services;

use App\Models\Option;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PosAuthClientService
{
    protected string $serverUrl;
    protected int $timeoutSeconds;
    protected int $retryAttempts;
    protected int $retryBackoffMs;

    public function __construct(
        protected DeviceService $deviceService
    ) {
        $this->serverUrl = rtrim((string) config('sync.server_url', 'http://localhost:5000'), '/');
        $this->timeoutSeconds = (int) config('sync.timeout_seconds', 15);
        $this->retryAttempts = (int) config('sync.retry_attempts', 2);
        $this->retryBackoffMs = (int) config('sync.retry_backoff_ms', 500);
    }

    /**
     * Get the active central backend server URL.
     */
    public function getServerUrl(): string
    {
        return $this->serverUrl;
    }

    /**
     * Check employee invitation and account status with the central backend API.
     * Endpoint: ALL /api/pos/auth/check-status
     *
     * @return array{
     *     success: bool,
     *     status: string,
     *     name?: string,
     *     role?: string,
     *     businessId?: string,
     *     businessName?: string,
     *     mandiLocation?: string,
     *     message?: string,
     *     error?: string
     * }
     */
    public function checkStatus(string $email): array
    {
        $cleanEmail = trim(strtolower($email));
        $url = $this->serverUrl . '/api/pos/auth/check-status';

        try {
            /** @var Response $response */
            $response = Http::timeout($this->timeoutSeconds)
                ->retry($this->retryAttempts, $this->retryBackoffMs, function (\Throwable $e) {
                    return $e instanceof ConnectionException;
                }, throw: false)
                ->withHeaders([
                    'Accept'       => 'application/json',
                    'Content-Type' => 'application/json',
                ])
                ->post($url, [
                    'email' => $cleanEmail,
                ]);

            if ($response && $response->successful()) {
                return $response->json();
            }

            $status = $response ? $response->status() : 500;
            $msg = $response ? ($response->json('message') ?: $response->body()) : 'Server error';

            return [
                'success' => false,
                'status'  => 'ERROR',
                'error'   => 'http_' . $status,
                'message' => $msg,
            ];
        } catch (ConnectionException $e) {
            Log::info('PosAuthClientService::checkStatus offline or host unreachable: ' . $e->getMessage());

            return [
                'success' => false,
                'status'  => 'OFFLINE',
                'error'   => 'network_unavailable',
                'message' => 'Central server is unreachable. Offline mode active.',
            ];
        } catch (\Throwable $e) {
            Log::error('PosAuthClientService::checkStatus exception: ' . $e->getMessage());

            return [
                'success' => false,
                'status'  => 'EXCEPTION',
                'error'   => 'exception',
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Activate employee account by creating password through the POS terminal.
     * Endpoint: POST /api/pos/auth/activate
     *
     * @return array{
     *     success: bool,
     *     message: string,
     *     token?: string,
     *     user?: array,
     *     business?: array,
     *     permissions?: array,
     *     error?: string
     * }
     */
    public function activate(string $email, string $password, ?string $deviceId = null, ?string $deviceName = null): array
    {
        $cleanEmail = trim(strtolower($email));
        $finalDeviceId = $deviceId ?: $this->deviceService->getDeviceId();
        $finalDeviceName = $deviceName ?: config('app.name', 'JKC Mandi POS');
        $url = $this->serverUrl . '/api/pos/auth/activate';

        try {
            /** @var Response $response */
            $response = Http::timeout($this->timeoutSeconds)
                ->withHeaders([
                    'Accept'       => 'application/json',
                    'Content-Type' => 'application/json',
                ])
                ->post($url, [
                    'email'      => $cleanEmail,
                    'password'   => $password,
                    'deviceId'   => $finalDeviceId,
                    'deviceName' => $finalDeviceName,
                ]);

            if ($response && $response->successful()) {
                $data = $response->json();
                if (!empty($data['token'])) {
                    $this->storeToken((string) $data['token']);
                }
                return $data;
            }

            $status = $response ? $response->status() : 500;
            $msg = $response ? ($response->json('message') ?: $response->body()) : 'Activation failed';

            return [
                'success' => false,
                'error'   => 'http_' . $status,
                'message' => $msg,
            ];
        } catch (ConnectionException $e) {
            Log::info('PosAuthClientService::activate network unreachable: ' . $e->getMessage());

            return [
                'success' => false,
                'error'   => 'network_unavailable',
                'message' => 'Cannot connect to central server to activate account. An internet connection is required for first-time activation.',
            ];
        } catch (\Throwable $e) {
            Log::error('PosAuthClientService::activate exception: ' . $e->getMessage());

            return [
                'success' => false,
                'error'   => 'exception',
                'message' => 'Activation error: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Authenticate active employee through the central backend.
     * Endpoint: POST /api/pos/auth/login
     *
     * @return array{
     *     success: bool,
     *     message: string,
     *     token?: string,
     *     user?: array,
     *     business?: array,
     *     permissions?: array,
     *     error?: string
     * }
     */
    public function login(string $email, string $password, ?string $deviceId = null): array
    {
        $cleanEmail = trim(strtolower($email));
        $finalDeviceId = $deviceId ?: $this->deviceService->getDeviceId();
        $url = $this->serverUrl . '/api/pos/auth/login';

        try {
            /** @var Response $response */
            $response = Http::timeout($this->timeoutSeconds)
                ->withHeaders([
                    'Accept'       => 'application/json',
                    'Content-Type' => 'application/json',
                ])
                ->post($url, [
                    'email'    => $cleanEmail,
                    'password' => $password,
                    'deviceId' => $finalDeviceId,
                ]);

            if ($response && $response->successful()) {
                $data = $response->json();
                if (!empty($data['token'])) {
                    $this->storeToken((string) $data['token']);
                }
                return $data;
            }

            $status = $response ? $response->status() : 500;
            $msg = $response ? ($response->json('message') ?: 'Invalid email or password.') : 'Authentication failed';

            return [
                'success' => false,
                'error'   => 'http_' . $status,
                'message' => $msg,
            ];
        } catch (ConnectionException $e) {
            Log::info('PosAuthClientService::login network unreachable: ' . $e->getMessage());

            return [
                'success' => false,
                'error'   => 'network_unavailable',
                'message' => 'Central server is unreachable. Offline mode active.',
            ];
        } catch (\Throwable $e) {
            Log::error('PosAuthClientService::login exception: ' . $e->getMessage());

            return [
                'success' => false,
                'error'   => 'exception',
                'message' => 'Login error: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Download business profile and role permissions for local caching.
     * Endpoint: GET /api/pos/auth/sync-data
     */
    public function getSyncData(?string $token = null): array
    {
        $authToken = $token ?: $this->getStoredToken();
        if (empty($authToken)) {
            return [
                'success' => false,
                'error'   => 'unauthenticated',
                'message' => 'No active authentication token available.',
            ];
        }

        $url = $this->serverUrl . '/api/pos/auth/sync-data';

        try {
            $response = Http::timeout($this->timeoutSeconds)
                ->withToken($authToken)
                ->withHeaders([
                    'Accept'      => 'application/json',
                    'X-Device-Id' => $this->deviceService->getDeviceId(),
                ])
                ->get($url);

            if ($response && $response->successful()) {
                return $response->json();
            }

            return [
                'success' => false,
                'error'   => 'http_' . ($response ? $response->status() : 500),
                'message' => $response ? ($response->json('message') ?: $response->body()) : 'Server error',
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'error'   => 'network_unavailable',
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Pull role feature permissions from central backend.
     * Endpoint: GET /api/v1/sync/permissions
     */
    public function syncPermissions(?string $businessId = null, ?string $token = null): array
    {
        $authToken = $token ?: $this->getStoredToken();
        $deviceId = $this->deviceService->getDeviceId();
        $url = $this->serverUrl . '/api/v1/sync/permissions';

        try {
            $req = Http::timeout($this->timeoutSeconds)
                ->withHeaders([
                    'Accept'      => 'application/json',
                    'X-Device-Id' => $deviceId,
                ]);

            if (!empty($authToken)) {
                $req = $req->withToken($authToken);
            }

            $query = [];
            if ($businessId) {
                $query['business_id'] = $businessId;
            }

            $response = $req->get($url, $query);

            if ($response && $response->successful()) {
                return $response->json();
            }

            return [
                'success' => false,
                'error'   => 'http_' . ($response ? $response->status() : 500),
                'message' => $response ? ($response->json('message') ?: $response->body()) : 'Permissions sync error',
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'error'   => 'network_unavailable',
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Persist JWT authentication token locally in options table and storage file.
     */
    public function storeToken(string $token): void
    {
        try {
            Option::updateOrCreate(
                ['meta_key' => 'sync_device_token'],
                [
                    'meta_value'    => trim($token),
                    'meta_category' => 'sync',
                ]
            );
        } catch (\Throwable) {
            // Options table may not be ready
        }

        try {
            $dir = storage_path('app');
            if (!File::isDirectory($dir)) {
                File::makeDirectory($dir, 0755, true, true);
            }

            File::put(
                $dir . DIRECTORY_SEPARATOR . 'device_token.json',
                json_encode([
                    'token'      => trim($token),
                    'device_id'  => $this->deviceService->getDeviceId(),
                    'updated_at' => date('c'),
                ], JSON_PRETTY_PRINT)
            );
        } catch (\Throwable) {
            // Safe ignore
        }
    }

    /**
     * Retrieve the stored authentication token.
     */
    public function getStoredToken(): ?string
    {
        // 1. Check environment / config
        $configToken = config('sync.device_token');
        if (!empty($configToken)) {
            return trim((string) $configToken);
        }

        // 2. Check options table
        try {
            $dbToken = Option::where('meta_key', 'sync_device_token')->value('meta_value');
            if (!empty($dbToken)) {
                return trim((string) $dbToken);
            }
        } catch (\Throwable) {
            // Options table may not be ready
        }

        // 3. Check persistent storage file
        try {
            $filePath = storage_path('app/device_token.json');
            if (File::exists($filePath)) {
                $data = json_decode(File::get($filePath), true);
                if (!empty($data['token'])) {
                    $fileDeviceId = $data['device_id'] ?? null;
                    $currentDeviceId = $this->deviceService->getDeviceId();
                    if ($fileDeviceId === null || $fileDeviceId === $currentDeviceId) {
                        return trim((string) $data['token']);
                    }
                }
            }
        } catch (\Throwable) {
            // Safe ignore
        }

        return null;
    }

    /**
     * Clear stored authentication token on rotation or revocation.
     */
    public function clearStoredToken(): void
    {
        try {
            Option::where('meta_key', 'sync_device_token')->delete();
        } catch (\Throwable) {
            // Safe ignore
        }

        try {
            $filePath = storage_path('app/device_token.json');
            if (File::exists($filePath)) {
                File::delete($filePath);
            }
        } catch (\Throwable) {
            // Safe ignore
        }
    }
}
