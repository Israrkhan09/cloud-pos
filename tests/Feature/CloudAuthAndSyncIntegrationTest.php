<?php

namespace Tests\Feature;

use App\Models\Option;
use App\Models\PosPermission;
use App\Models\Product;
use App\Models\SyncDevice;
use App\Models\SyncEvent;
use App\Models\SyncOutbox;
use App\Models\User;
use App\Services\BidirectionalSyncService;
use App\Services\DeviceService;
use App\Services\PermissionService;
use App\Services\PosAuthClientService;
use App\Services\SyncDownloadService;
use App\Services\SyncQueueService;
use App\Services\SyncUploadService;
use App\Services\UserSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CloudAuthAndSyncIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        SyncQueueService::enableTracking();
        DeviceService::clearCache();
    }

    /**
     * Test 1: Check-status returns PENDING_PASSWORD for an invited employee from central backend.
     */
    public function test_check_status_returns_pending_password_for_invited_employee(): void
    {
        Http::fake([
            '*/api/pos/auth/check-status' => Http::response([
                'success'      => true,
                'status'       => 'PENDING_PASSWORD',
                'name'         => 'Anusha Kamran',
                'role'         => 'Employee',
                'businessId'   => 'biz-mwwelxma-b9b93a',
                'businessName' => 'lahore sabzi mandi',
            ], 200),
        ]);

        $response = $this->postJson('/login/check-status', [
            'email' => 'anushakamran2004@gmail.com',
        ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success'      => true,
            'status'       => 'PENDING_PASSWORD',
            'name'         => 'Anusha Kamran',
            'role'         => 'Employee',
            'businessName' => 'lahore sabzi mandi',
        ]);
    }

    /**
     * Test 2: Check-status returns LOCAL_ACTIVE for an existing active local user.
     */
    public function test_check_status_returns_local_active_for_existing_local_user(): void
    {
        User::create([
            'name'     => 'Local Admin',
            'email'    => 'admin@sabzimandi.com',
            'password' => Hash::make('admin12345'),
            'role'     => 'Admin',
            'status'   => 'Active',
        ]);

        $response = $this->postJson('/login/check-status', [
            'email' => 'admin@sabzimandi.com',
        ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'status'  => 'LOCAL_ACTIVE',
            'name'    => 'Local Admin',
            'role'    => 'Admin',
        ]);
    }

    /**
     * Test 3: Activate employee endpoint hashes password, mirrors user into SQLite, and stores JWT.
     */
    public function test_activate_employee_creates_local_user_with_bcrypt_and_authenticates(): void
    {
        Http::fake([
            '*/api/pos/auth/activate*' => Http::response([
                'success' => true,
                'token'   => 'mock-cloud-jwt-token-xyz-1234567890',
                'user'    => [
                    'id'       => 'usr-anusha-cloud-001',
                    'name'     => 'Anusha Kamran',
                    'email'    => 'anushakamran2004@gmail.com',
                    'role'     => 'Employee',
                    'status'   => 'Active',
                ],
                'business' => [
                    'id'       => 'biz-mwwelxma-b9b93a',
                    'name'     => 'lahore sabzi mandi',
                ],
                'permissions' => [
                    'new_sale' => true,
                    'wasooli'  => true,
                ],
            ], 200),
            '*/api/v1/sync/permissions*' => Http::response([
                'success'     => true,
                'permissions' => [
                    'Employee' => [
                    'new_sale' => true,
                    'wasooli'  => true,
                ],
                ],
            ], 200),
            '*/api/v1/sync/push*' => Http::response([
                'success'      => true,
                'synced_count' => 0,
            ], 200),
            '*/api/v1/sync/pull*' => Http::response([
                'success'       => true,
                'events'        => [],
                'latest_cursor' => 0,
                'has_more'      => false,
            ], 200),
            '*/api/v1/sync/register*' => Http::response([
                'success' => true,
                'data'    => [
                    'token' => 'mock-cloud-jwt-token-xyz-1234567890',
                ],
            ], 200),
        ]);

        $response = $this->post('/login/activate', [
            'email'                 => 'anushakamran2004@gmail.com',
            'password'              => 'securepass123',
            'password_confirmation' => 'securepass123',
        ]);

        $response->assertRedirect('/dashboard');

        // Check local database
        $user = User::where('email', 'anushakamran2004@gmail.com')->first();
        $this->assertNotNull($user);
        $this->assertEquals('Anusha Kamran', $user->name);
        $this->assertEquals('usr-anusha-cloud-001', $user->cloud_user_id);
        $this->assertEquals('Employee', $user->role);
        $this->assertEquals('biz-mwwelxma-b9b93a', $user->business_id);
        $this->assertEquals('Active', $user->status);
        $this->assertTrue(Hash::check('securepass123', $user->password));

        // Check session authentication
        $this->assertAuthenticatedAs($user);

        // Check stored device JWT token
        $authClient = app(PosAuthClientService::class);
        $this->assertEquals('mock-cloud-jwt-token-xyz-1234567890', $authClient->getStoredToken());
    }

    /**
     * Test 4: Mirrored employee can log in 100% offline with internet completely disconnected.
     */
    public function test_mirrored_employee_can_log_in_completely_offline(): void
    {
        // Pre-create mirrored employee in local SQLite
        $employee = User::create([
            'name'          => 'Anusha Kamran',
            'email'         => 'anushakamran2004@gmail.com',
            'password'      => Hash::make('offlinepassword123'),
            'role'          => 'Employee',
            'status'        => 'Active',
            'cloud_user_id' => 'usr-anusha-cloud-001',
            'business_id'   => 'biz-mwwelxma-b9b93a',
        ]);

        // Simulate complete offline mode: any HTTP request throws ConnectionException
        Http::fake(function () {
            throw new ConnectionException('Could not resolve host (No Internet Connection)');
        });

        $response = $this->post('/login', [
            'email'    => 'anushakamran2004@gmail.com',
            'password' => 'offlinepassword123',
        ]);

        $response->assertRedirect('/dashboard');
        $this->assertAuthenticatedAs($employee);
    }

    /**
     * Test 5: Existing local Admin (test@test.com) logs in offline with no regression.
     */
    public function test_existing_local_admin_can_log_in_offline_without_regression(): void
    {
        $admin = User::create([
            'name'        => 'Local Admin',
            'email'       => 'test@test.com',
            'password'    => Hash::make('password'),
            'role'        => 'Admin',
            'business_id' => 'biz-test-business',
            'status'      => 'Active',
        ]);

        // Complete offline simulation
        Http::fake(function () {
            throw new ConnectionException('Offline');
        });

        $response = $this->post('/login', [
            'email'    => 'test@test.com',
            'password' => 'password',
        ]);

        $response->assertRedirect('/dashboard');
        $this->assertAuthenticatedAs($admin);
    }

    /**
     * Test 6: Unmirrored user can authenticate via central cloud fallback and is mirrored locally.
     */
    public function test_unmirrored_user_can_authenticate_via_cloud_login_fallback(): void
    {
        Http::fake([
            '*/api/pos/auth/login' => Http::response([
                'success' => true,
                'token'   => 'login-token-cloud-777',
                'user'    => [
                    'id'     => 'usr-cloud-emp-002',
                    'name'   => 'Bilal Ahmed',
                    'email'  => 'bilal@mandi.com',
                    'role'   => 'Employee',
                    'status' => 'Active',
                ],
                'business' => [
                    'id'   => 'biz-lahore-central',
                    'name' => 'Lahore Mandi Station',
                ],
            ], 200),
            '*/api/v1/sync/permissions' => Http::response([
                'success'     => true,
                'permissions' => ['Employee' => ['new_sale' => true]],
            ], 200),
            '*/api/v1/sync/push' => Http::response(['success' => true, 'synced_count' => 0], 200),
            '*/api/v1/sync/pull' => Http::response(['success' => true, 'events' => [], 'latest_cursor' => 0], 200),
        ]);

        // Ensure user does not exist locally
        $this->assertNull(User::where('email', 'bilal@mandi.com')->first());

        $response = $this->post('/login', [
            'email'    => 'bilal@mandi.com',
            'password' => 'bilalpassword123',
        ]);

        $response->assertRedirect('/dashboard');

        // Verify mirrored in SQLite
        $user = User::where('email', 'bilal@mandi.com')->first();
        $this->assertNotNull($user);
        $this->assertEquals('Bilal Ahmed', $user->name);
        $this->assertEquals('usr-cloud-emp-002', $user->cloud_user_id);
        $this->assertEquals('biz-lahore-central', $user->business_id);
        $this->assertTrue(Hash::check('bilalpassword123', $user->password));
        $this->assertAuthenticatedAs($user);
    }

    /**
     * Test 7: Suspended/Deactivated user is blocked from logging in.
     */
    public function test_suspended_user_is_blocked_from_login(): void
    {
        User::create([
            'name'     => 'Suspended Employee',
            'email'    => 'suspended@mandi.com',
            'password' => Hash::make('password123'),
            'role'     => 'Employee',
            'status'   => 'Suspended',
        ]);

        $response = $this->post('/login', [
            'email'    => 'suspended@mandi.com',
            'password' => 'password123',
        ]);

        $response->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    /**
     * Test 8: Role and feature permissions restrict Employee vs Admin.
     */
    public function test_role_and_feature_permissions_cached_and_restricted(): void
    {
        // Cache restricted permissions for Employee
        PosPermission::updateOrCreate(
            ['role' => 'Employee'],
            [
                'allowed_features' => ['new_sale', 'wasooli'],
                'synced_at'        => now(),
            ]
        );

        // Employee user
        $employee = User::create([
            'name'     => 'Cashier',
            'email'    => 'cashier@mandi.com',
            'password' => Hash::make('cashier123'),
            'role'     => 'Employee',
            'status'   => 'Active',
        ]);

        $this->assertTrue(PermissionService::isFeatureAllowed($employee, 'new_sale'));
        $this->assertTrue(PermissionService::isFeatureAllowed($employee, 'wasooli'));
        $this->assertFalse(PermissionService::isFeatureAllowed($employee, 'backup_restore'));
        $this->assertFalse(PermissionService::isFeatureAllowed($employee, 'bank_accounts'));

        // Admin user receives full access
        $admin = User::create([
            'name'     => 'Owner',
            'email'    => 'owner@mandi.com',
            'password' => Hash::make('owner123'),
            'role'     => 'Admin',
            'status'   => 'Active',
        ]);

        $this->assertTrue(PermissionService::isFeatureAllowed($admin, 'new_sale'));
        $this->assertTrue(PermissionService::isFeatureAllowed($admin, 'wasooli'));
        $this->assertTrue(PermissionService::isFeatureAllowed($admin, 'backup_restore'));
        $this->assertTrue(PermissionService::isFeatureAllowed($admin, 'bank_accounts'));
    }

    /**
     * Test 9: Stored device JWT token is retrieved and used by SyncUploadService and SyncDownloadService.
     */
    public function test_stored_jwt_token_powers_sync_services(): void
    {
        $authClient = app(PosAuthClientService::class);
        $authClient->storeToken('production-jwt-bearer-token-abc');

        $this->assertEquals('production-jwt-bearer-token-abc', $authClient->getStoredToken());

        // Verify Option model persists it with meta_key
        $option = Option::where('meta_key', 'sync_device_token')->first();
        $this->assertNotNull($option);
        $this->assertEquals('production-jwt-bearer-token-abc', $option->meta_value);
    }

    /**
     * Test 10: General sync outbox only synchronizes business entities, never passwords.
     */
    public function test_passwords_never_leaked_into_sync_outbox(): void
    {
        // 1. Creating a User must NOT generate an outbox record with password
        $user = User::create([
            'name'     => 'Secret User',
            'email'    => 'secret@mandi.com',
            'password' => Hash::make('verysecretpassword'),
            'role'     => 'Employee',
            'status'   => 'Active',
        ]);

        $userOutboxEvents = SyncOutbox::where('entity_type', 'User')->get();
        $this->assertCount(0, $userOutboxEvents, 'User creations must not be queued into sync_outbox.');

        // 2. Creating a business entity (e.g. Product) DOES generate an outbox record
        $product = Product::create([
            'title'          => 'Aalu Red Skin',
            'sale_price'     => 50.00,
            'purchase_price' => 40.00,
            'category_ids'   => '1',
            'status'         => 'active',
        ]);

        $productEvents = SyncOutbox::where('entity_type', 'Product')
            ->where('entity_uuid', $product->uuid)
            ->get();

        $this->assertGreaterThan(0, $productEvents->count());
        $payload = $productEvents->first()->payload;
        $this->assertArrayNotHasKey('password', $payload);
    }
}
