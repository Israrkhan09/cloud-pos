<?php

namespace App\Services;

use App\Models\PosPermission;
use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PermissionService
{
    /**
     * All 15 central POS feature identifiers (immutable keys)
     */
    public const ALL_FEATURES = [
        'new_sale',
        'wasooli',
        'stock_management',
        'customers',
        'farmers',
        'bank_accounts',
        'deposit_transfer',
        'cheques',
        'investment_capital',
        'merchant_khata',
        'farmer_khata',
        'reports',
        'expiry_gifts',
        'discount_rules',
        'backup_restore',
    ];

    /**
     * Safe defaults for employee before first sync
     */
    public const DEFAULT_EMPLOYEE_FEATURES = [
        'new_sale',
        'wasooli',
        'stock_management',
        'customers',
        'farmers',
        'merchant_khata',
        'farmer_khata',
    ];

    /**
     * Route prefix to feature key mapping
     */
    public const ROUTE_FEATURE_MAP = [
        'amroza'            => 'new_sale',
        'merchants/amroza'  => 'new_sale',
        'naqdi'             => 'new_sale',
        'merchants/naqdi'   => 'new_sale',
        'wasooli'           => 'wasooli',
        'merchants/wasooli' => 'wasooli',
        'masters/items'     => 'stock_management',
        'masters/marks'     => 'stock_management',
        'masters/areas'     => 'stock_management',
        'customers'         => 'customers',
        'search-customer'   => 'customers',
        'farmers'           => 'farmers',
        'bijak'             => 'farmers',
        'khata'             => 'farmers',
        'general-ledger'    => 'merchant_khata',
        'banking/accounts'  => 'bank_accounts',
        'banking/transfers' => 'deposit_transfer',
        'banking/cheques'   => 'cheques',
        'banking'           => 'bank_accounts',
        'investment'        => 'investment_capital',
        'merchant-khata'    => 'merchant_khata',
        'merchant-amroza'   => 'merchant_khata',
        'merchant-wasooli'  => 'merchant_khata',
        'amroza-detail'     => 'merchant_khata',
        'wasooli-detail'    => 'merchant_khata',
        'amroza-wasooli'    => 'merchant_khata',
        'farmer-khata'      => 'farmer_khata',
        'reports'           => 'reports',
        'expiry-gifts'      => 'expiry_gifts',
        'discount-rules'    => 'discount_rules',
        'backup'            => 'backup_restore',
    ];

    /**
     * Return allowed feature keys for a user
     */
    public static function getAllowedFeaturesForUser(?User $user): array
    {
        if (!$user) {
            return [];
        }

        $role = trim((string) ($user->role ?: 'Admin'));

        // Admin always receives 100% full access to all 15 features
        if (strcasecmp($role, 'Admin') === 0 || strcasecmp($role, 'SUPER_ADMIN') === 0 || strcasecmp($role, 'CUSTOMER_ADMIN') === 0) {
            return self::ALL_FEATURES;
        }

        // Employee: look up in local SQLite pos_permissions table
        try {
            $perm = PosPermission::where('role', 'Employee')->latest('updated_at')->first();
            if ($perm && is_array($perm->allowed_features) && count($perm->allowed_features) > 0) {
                // Ensure only valid features are returned
                return array_values(array_intersect(self::ALL_FEATURES, $perm->allowed_features));
            }
        } catch (\Throwable $e) {
            Log::warning('PermissionService::getAllowedFeaturesForUser lookup error: ' . $e->getMessage());
        }

        // Safe fallback default for employee if not yet synced
        return self::DEFAULT_EMPLOYEE_FEATURES;
    }

    /**
     * Check if a specific feature is allowed for a user
     */
    public static function isFeatureAllowed(?User $user, string $featureKey): bool
    {
        if (!$user) {
            return false;
        }

        $role = trim((string) ($user->role ?: 'Admin'));
        if (strcasecmp($role, 'Admin') === 0 || strcasecmp($role, 'SUPER_ADMIN') === 0 || strcasecmp($role, 'CUSTOMER_ADMIN') === 0) {
            return true;
        }

        $allowed = self::getAllowedFeaturesForUser($user);
        return in_array($featureKey, $allowed, true);
    }

    /**
     * Check if a given route path is allowed for a user
     */
    public static function isRouteAllowed(?User $user, string $path): bool
    {
        if (!$user) {
            return false;
        }

        $role = trim((string) ($user->role ?: 'Admin'));
        if (strcasecmp($role, 'Admin') === 0 || strcasecmp($role, 'SUPER_ADMIN') === 0 || strcasecmp($role, 'CUSTOMER_ADMIN') === 0) {
            return true;
        }

        $cleanPath = trim(parse_url($path, PHP_URL_PATH) ?: $path, '/');

        // Always allowed baseline routes
        if ($cleanPath === '' || $cleanPath === 'dashboard' || $cleanPath === 'locale' || $cleanPath === 'logout' || $cleanPath === 'login' || $cleanPath === 'register' || str_starts_with($cleanPath, 'password') || str_starts_with($cleanPath, 'email/verify')) {
            return true;
        }

        // Check longest matching prefix
        foreach (self::ROUTE_FEATURE_MAP as $routePrefix => $featureKey) {
            if ($cleanPath === $routePrefix || str_starts_with($cleanPath, $routePrefix . '/') || str_starts_with($cleanPath, $routePrefix)) {
                return self::isFeatureAllowed($user, $featureKey);
            }
        }

        // Default allow unmapped generic routes (e.g. notifications, status)
        return true;
    }

    /**
     * Synchronize permissions from central Dashboard backend to local SQLite.
     * Offline resilient: will never wipe previously cached permissions on failure.
     */
    public static function syncPermissionsFromCentral(?string $businessId = null): array
    {
        $serverUrl = rtrim((string) config('sync.server_url', 'https://api.sudoleads.com'), '/');
        $timeout = (int) config('sync.timeout_seconds', 10);

        try {
            /** @var SyncUploadService $uploadService */
            $uploadService = app(SyncUploadService::class);
            $token = $uploadService->getStoredToken();
            $deviceService = app(DeviceService::class);
            $deviceId = $deviceService->getDeviceId();

            $endpoint = (string) config('sync.endpoints.permissions', '/api/v1/sync/permissions');
            $url = $serverUrl . $endpoint;
            $request = Http::timeout($timeout)->withHeaders([
                'Accept'      => 'application/json',
                'X-Device-Id' => $deviceId,
            ]);

            if (!empty($token)) {
                $request = $request->withToken($token);
            }

            $query = [];
            if ($businessId) {
                $query['business_id'] = $businessId;
            }

            $response = $request->get($url, $query);

            if ($response->successful()) {
                $data = $response->json();
                if (!empty($data['rolePermissions']) && is_array($data['rolePermissions'])) {
                    self::storePermissionsLocally(
                        $data['businessId'] ?? $businessId,
                        $data['rolePermissions'],
                        $data['syncedAt'] ?? now()->toIso8601String()
                    );

                    return [
                        'success'    => true,
                        'message'    => 'Permissions synchronized successfully to local SQLite.',
                        'synced_at'  => $data['syncedAt'] ?? now()->toIso8601String(),
                        'businessId' => $data['businessId'] ?? $businessId,
                    ];
                }
            }

            // Central server returned non-200 or unexpected structure: Keep existing permissions
            Log::warning('Permission sync returned unexpected response: ' . $response->body());
            return [
                'success' => false,
                'error'   => 'invalid_response',
                'message' => 'Central server returned incomplete permission configuration. Local permissions preserved.',
            ];
        } catch (ConnectionException $e) {
            // Offline / network failure: Keep local cache intact
            Log::info('Permission sync offline: ' . $e->getMessage());
            return [
                'success' => false,
                'offline' => true,
                'message' => 'Central server is unreachable. Offline mode active, using cached local permissions.',
            ];
        } catch (\Throwable $e) {
            Log::error('Permission sync exception: ' . $e->getMessage());
            return [
                'success' => false,
                'error'   => 'exception',
                'message' => 'Permission sync failed: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Save role permissions into local SQLite table
     */
    public static function storePermissionsLocally(?string $businessId, array $rolePermissions, ?string $syncedAt = null): void
    {
        $timestamp = $syncedAt ? date('Y-m-d H:i:s', strtotime($syncedAt)) : now();

        foreach ($rolePermissions as $rp) {
            $roleName = trim((string) ($rp['name'] ?? $rp['role'] ?? ''));
            if (!$roleName) continue;

            $norm = strcasecmp($roleName, 'Admin') === 0 ? 'Admin' : 'Employee';
            $features = [];

            if ($norm === 'Admin') {
                $features = self::ALL_FEATURES;
            } else {
                $raw = $rp['allowedFeatures'] ?? $rp['allowed_features'] ?? self::DEFAULT_EMPLOYEE_FEATURES;
                $features = array_values(array_intersect(self::ALL_FEATURES, (array) $raw));
            }

            PosPermission::updateOrCreate(
                ['role' => $norm],
                [
                    'business_id'      => $businessId,
                    'allowed_features' => $features,
                    'synced_at'        => $timestamp,
                    'version'          => '1.0',
                ]
            );
        }

        // Ensure Admin entry always exists locally
        PosPermission::updateOrCreate(
            ['role' => 'Admin'],
            [
                'business_id'      => $businessId,
                'allowed_features' => self::ALL_FEATURES,
                'synced_at'        => $timestamp,
                'version'          => '1.0',
            ]
        );
    }
}
