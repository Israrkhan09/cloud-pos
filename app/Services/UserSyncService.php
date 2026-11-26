<?php

namespace App\Services;

use App\Models\Option;
use App\Models\PosPermission;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class UserSyncService
{
    public function __construct(
        protected PosAuthClientService $authClient
    ) {}

    /**
     * Map central role to local POS role convention.
     */
    public static function normalizeRole(string $rawRole): string
    {
        $norm = strtoupper(trim($rawRole));

        if ($norm === 'SUPER_ADMIN' || $norm === 'CUSTOMER_ADMIN' || $norm === 'ADMIN') {
            return 'Admin';
        }

        return 'Employee';
    }

    /**
     * Mirror a centrally activated/authenticated user safely into local SQLite.
     * Preserves SQLite integer primary key and maps cloud_user_id.
     *
     * @param array{
     *     id?: string,
     *     name: string,
     *     email: string,
     *     role?: string,
     *     businessId?: string,
     *     status?: string
     * } $cloudUser
     */
    public function mirrorCloudUser(array $cloudUser, string $password, ?string $jwtToken = null): User
    {
        $cleanEmail = trim(strtolower($cloudUser['email']));
        $name = trim($cloudUser['name'] ?? explode('@', $cleanEmail)[0]);
        $cloudId = $cloudUser['id'] ?? null;
        $businessId = $cloudUser['businessId'] ?? ($cloudUser['business_id'] ?? null);
        $role = self::normalizeRole($cloudUser['role'] ?? 'Employee');
        $status = $cloudUser['status'] ?? 'Active';

        return DB::transaction(function () use ($cleanEmail, $name, $cloudId, $businessId, $role, $status, $password, $jwtToken) {
            // Find existing user by cloud_user_id or email
            $user = null;
            if (!empty($cloudId)) {
                $user = User::where('cloud_user_id', $cloudId)->first();
            }
            if (!$user) {
                $user = User::where('email', $cleanEmail)->first();
            }

            $attributes = [
                'name'           => $name,
                'email'          => $cleanEmail,
                'role'           => $role,
                'status'         => $status,
                'password'       => Hash::make($password),
                'last_synced_at' => now(),
            ];

            if (!empty($cloudId)) {
                $attributes['cloud_user_id'] = $cloudId;
            }
            if (!empty($businessId)) {
                $attributes['business_id'] = $businessId;
            }

            if ($user) {
                // Update existing local record without altering its local auto-increment id
                $user->update($attributes);
            } else {
                // Create new local record
                $attributes['locale'] = 'en';
                $user = User::create($attributes);
            }

            // Persist the authenticated token for subsequent business synchronization
            if (!empty($jwtToken)) {
                $this->authClient->storeToken($jwtToken);
            }

            // Persist the business ID in options table for device context
            if (!empty($businessId)) {
                Option::updateOrCreate(
                    ['meta_key' => 'business_id'],
                    ['meta_value' => (string) $businessId, 'meta_category' => 'sync']
                );

                // Ensure the Business model is created or updated in local SQLite
                $existingBiz = \App\Models\Business::find((string) $businessId);
                $bizName = $cloudUser['businessName'] 
                    ?? ($cloudUser['business_name'] 
                    ?? ($existingBiz?->name ?? 'Kashmir Sabzi Mandi'));
                
                $mandiLoc = $cloudUser['mandiLocation'] 
                    ?? ($cloudUser['mandi_location'] 
                    ?? ($existingBiz?->mandi_location ?? $bizName));
                
                $city = $cloudUser['city'] ?? ($existingBiz?->city ?? null);
                $ownerName = $cloudUser['ownerName'] ?? ($cloudUser['owner_name'] ?? ($existingBiz?->owner_name ?? null));

                $bizAttributes = [
                    'name'   => $bizName,
                    'status' => 'Active',
                ];
                if (!empty($mandiLoc)) {
                    $bizAttributes['mandi_location'] = $mandiLoc;
                }
                if (!empty($city)) {
                    $bizAttributes['city'] = $city;
                }
                if (!empty($ownerName)) {
                    $bizAttributes['owner_name'] = $ownerName;
                }

                \App\Models\Business::updateOrCreate(
                    ['id' => (string) $businessId],
                    $bizAttributes
                );
            }

            return $user;
        });
    }

    /**
     * Synchronize permissions from central backend into local SQLite pos_permissions table.
     */
    public function syncPermissionsFromCloud(?string $businessId = null, ?string $jwtToken = null): array
    {
        $response = $this->authClient->syncPermissions($businessId, $jwtToken);

        if (!$response['success'] || empty($response['rolePermissions'])) {
            return [];
        }

        $bizId = $response['businessId'] ?? $businessId;
        $syncedRoles = [];

        foreach ($response['rolePermissions'] as $item) {
            $roleName = self::normalizeRole($item['name'] ?? 'Employee');
            $allowedFeatures = $item['allowedFeatures'] ?? [];

            if (is_array($allowedFeatures) && count($allowedFeatures) > 0) {
                try {
                    PosPermission::updateOrCreate(
                        [
                            'role'        => $roleName,
                            'business_id' => $bizId,
                        ],
                        [
                            'allowed_features' => $allowedFeatures,
                            'synced_at'        => now(),
                            'version'          => 'v2',
                        ]
                    );
                    $syncedRoles[$roleName] = $allowedFeatures;
                } catch (\Throwable $e) {
                    Log::warning("UserSyncService::syncPermissionsFromCloud failed for role {$roleName}: " . $e->getMessage());
                }
            }
        }

        return $syncedRoles;
    }

    /**
     * Refresh the local user record from cloud to detect central role changes or suspensions.
     */
    public function refreshUserFromCloud(User $localUser, ?string $jwtToken = null): bool
    {
        $syncData = $this->authClient->getSyncData($jwtToken);

        if (!$syncData['success'] || empty($syncData['user'])) {
            return false;
        }

        $cloudUser = $syncData['user'];
        $updates = [];

        if (!empty($cloudUser['name']) && $cloudUser['name'] !== $localUser->name) {
            $updates['name'] = $cloudUser['name'];
        }

        if (!empty($cloudUser['role'])) {
            $newRole = self::normalizeRole($cloudUser['role']);
            if ($newRole !== $localUser->role) {
                $updates['role'] = $newRole;
            }
        }

        if (!empty($cloudUser['id']) && $cloudUser['id'] !== $localUser->cloud_user_id) {
            $updates['cloud_user_id'] = $cloudUser['id'];
        }

        if (!empty($cloudUser['businessId']) && $cloudUser['businessId'] !== $localUser->business_id) {
            $updates['business_id'] = $cloudUser['businessId'];
        }

        $updates['last_synced_at'] = now();

        $localUser->update($updates);

        return true;
    }
}
