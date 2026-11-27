<?php

namespace Tests\Feature;

use App\Models\AmrozaSale;
use App\Models\Area;
use App\Models\Business;
use App\Models\Customer;
use App\Models\Farmer;
use App\Models\Item;
use App\Models\Merchant;
use App\Models\MerchantReceipt;
use App\Models\PosPermission;
use App\Models\Product;
use App\Models\SyncDevice;
use App\Models\SyncEvent;
use App\Models\SyncOutbox;
use App\Models\User;
use App\Services\CentralSyncService;
use App\Services\PermissionService;
use App\Services\TenantContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class TenantIsolationComprehensiveTest extends TestCase
{
    use RefreshDatabase;

    protected Business $bizA;
    protected Business $bizB;
    protected Business $bizDemo;

    protected User $userAdminA;
    protected User $userEmpA;
    protected User $userAdminB;
    protected User $userEmpB;
    protected User $userDemo;

    protected function setUp(): void
    {
        parent::setUp();
        app(TenantContext::class)->clear();

        // 1. Business A: Kashmir Sabzi Mandi
        $this->bizA = Business::create([
            'id'             => 'biz-kashmir-001',
            'name'           => 'Kashmir Sabzi Mandi',
            'owner_name'     => 'Chaudhry Ali',
            'email'          => 'kashmir@example.com',
            'city'           => 'Kashmir',
            'mandi_location' => 'Kashmir Wholesale Mandi',
            'status'         => 'Active',
        ]);

        // 2. Business B: Karachi Sabzi Mandi
        $this->bizB = Business::create([
            'id'             => 'biz-karachi-002',
            'name'           => 'Karachi Sabzi Mandi',
            'owner_name'     => 'Chaudhry Ahmed',
            'email'          => 'karachi@example.com',
            'city'           => 'Karachi',
            'mandi_location' => 'Karachi Wholesale Mandi',
            'status'         => 'Active',
        ]);

        // 3. Protected Demo Business: Test Business (seeded by migration)
        $this->bizDemo = Business::firstOrCreate(
            ['id' => 'biz-test-business'],
            [
                'name'           => 'Test Business',
                'owner_name'     => 'Test Owner',
                'email'          => 'test@test.com',
                'city'           => 'Lahore',
                'mandi_location' => 'Lahore Wholesale Mandi',
                'status'         => 'Active',
            ]
        );

        // Users for Business A
        $this->userAdminA = User::create([
            'name'        => 'Admin A',
            'email'       => 'adminA@example.com',
            'password'    => bcrypt('password'),
            'role'        => 'Admin',
            'business_id' => $this->bizA->id,
            'status'      => 'Active',
        ]);

        $this->userEmpA = User::create([
            'name'        => 'Employee A',
            'email'       => 'empA@example.com',
            'password'    => bcrypt('password'),
            'role'        => 'Employee',
            'business_id' => $this->bizA->id,
            'status'      => 'Active',
        ]);

        // Users for Business B
        $this->userAdminB = User::create([
            'name'        => 'Admin B',
            'email'       => 'adminB@example.com',
            'password'    => bcrypt('password'),
            'role'        => 'Admin',
            'business_id' => $this->bizB->id,
            'status'      => 'Active',
        ]);

        $this->userEmpB = User::create([
            'name'        => 'Employee B',
            'email'       => 'empB@example.com',
            'password'    => bcrypt('password'),
            'role'        => 'Employee',
            'business_id' => $this->bizB->id,
            'status'      => 'Active',
        ]);

        // Protected Test User
        $this->userDemo = User::firstOrCreate(
            ['email' => 'test@test.com'],
            [
                'name'        => 'Test User',
                'password'    => bcrypt('password'),
                'role'        => 'Admin',
                'business_id' => $this->bizDemo->id,
                'status'      => 'Active',
            ]
        );
    }

    /**
     * Test: Business A records are completely invisible to Business B and vice versa
     */
    public function test_tenant_data_isolation_between_businesses()
    {
        // Act as Business A Admin: create entities
        $this->actingAs($this->userAdminA);
        app(TenantContext::class)->setBusinessId($this->bizA->id);

        $farmerA = Farmer::create([
            'name'            => 'Haji Bashir Kisan',
            'code'            => 'F-001',
            'phone'           => '03001111111',
            'current_balance' => 50000,
            'status'          => 'active',
        ]);

        $merchantA = Merchant::create([
            'name'            => 'Raza Traders',
            'code'            => 'M-001',
            'phone'           => '03002222222',
            'current_balance' => 75000,
            'status'          => 'active',
        ]);

        $itemA = Item::create([
            'name'          => 'Aloo (Potato)',
            'code'          => 'ITM-01',
            'current_stock' => 100,
            'status'        => 'active',
        ]);

        // Assert they belong to bizA
        $this->assertEquals($this->bizA->id, $farmerA->business_id);
        $this->assertEquals($this->bizA->id, $merchantA->business_id);
        $this->assertEquals($this->bizA->id, $itemA->business_id);

        // Switch to Business B
        $this->actingAs($this->userAdminB);
        app(TenantContext::class)->setBusinessId($this->bizB->id);

        // Business B should see 0 farmers, merchants, items
        $this->assertCount(0, Farmer::all());
        $this->assertCount(0, Merchant::all());
        $this->assertCount(0, Item::all());

        // Same codes and names can safely exist in Business B
        $farmerB = Farmer::create([
            'name'            => 'Haji Bashir Kisan', // Same name
            'code'            => 'F-001',             // Same code
            'phone'           => '03219999999',
            'current_balance' => 0,
            'status'          => 'active',
        ]);

        $this->assertEquals($this->bizB->id, $farmerB->business_id);
        $this->assertCount(1, Farmer::all());

        // Switch back to Business A
        $this->actingAs($this->userAdminA);
        app(TenantContext::class)->setBusinessId($this->bizA->id);

        $this->assertCount(1, Farmer::all());
        $this->assertEquals(50000, Farmer::first()->current_balance);
    }

    /**
     * Test: Employee permissions are strictly tenant-isolated
     */
    public function test_employee_permissions_are_tenant_isolated()
    {
        // Business A grants only 'new_sale' and 'wasooli' to its employees
        PosPermission::withoutGlobalScopes()->create([
            'role'             => 'Employee',
            'business_id'      => $this->bizA->id,
            'allowed_features' => ['new_sale', 'wasooli'],
            'version'          => '1.0',
        ]);

        // Business B grants 'stock_management', 'reports', 'banking_accounts' to its employees
        PosPermission::withoutGlobalScopes()->create([
            'role'             => 'Employee',
            'business_id'      => $this->bizB->id,
            'allowed_features' => ['stock_management', 'reports', 'bank_accounts'],
            'version'          => '1.0',
        ]);

        // Employee A permissions check
        $featuresA = PermissionService::getAllowedFeaturesForUser($this->userEmpA);
        $this->assertEquals(['new_sale', 'wasooli'], $featuresA);
        $this->assertTrue(PermissionService::isRouteAllowed($this->userEmpA, 'amroza'));
        $this->assertTrue(PermissionService::isRouteAllowed($this->userEmpA, 'wasooli'));
        $this->assertFalse(PermissionService::isRouteAllowed($this->userEmpA, 'reports'));
        $this->assertFalse(PermissionService::isRouteAllowed($this->userEmpA, 'banking/accounts'));

        // Employee B permissions check
        $featuresB = PermissionService::getAllowedFeaturesForUser($this->userEmpB);
        $this->assertEqualsCanonicalizing(['stock_management', 'reports', 'bank_accounts'], $featuresB);
        $this->assertFalse(PermissionService::isRouteAllowed($this->userEmpB, 'amroza'));
        $this->assertTrue(PermissionService::isRouteAllowed($this->userEmpB, 'reports'));
        $this->assertTrue(PermissionService::isRouteAllowed($this->userEmpB, 'banking/accounts'));

        // Updating Business A permissions does NOT affect Business B
        PermissionService::storePermissionsLocally($this->bizA->id, [
            ['role' => 'Employee', 'allowedFeatures' => ['new_sale']]
        ]);

        $featuresAAfter = PermissionService::getAllowedFeaturesForUser($this->userEmpA);
        $this->assertEqualsCanonicalizing(['new_sale'], $featuresAAfter);

        $featuresBAfter = PermissionService::getAllowedFeaturesForUser($this->userEmpB);
        $this->assertEqualsCanonicalizing(['stock_management', 'reports', 'bank_accounts'], $featuresBAfter);
    }

    /**
     * Test: Central sync changes pull does not leak records between tenants
     */
    public function test_central_sync_pull_does_not_leak_other_tenant_data()
    {
        // Device A for Business A
        $deviceA = SyncDevice::withoutGlobalScopes()->create([
            'uuid'           => 'dev-uuid-a',
            'device_id'      => 'POS-DEV-AAA',
            'business_id'    => $this->bizA->id,
            'api_token_hash' => hash('sha256', 'token-a'),
            'status'         => 'active',
        ]);

        // Device B for Business B
        $deviceB = SyncDevice::withoutGlobalScopes()->create([
            'uuid'           => 'dev-uuid-b',
            'device_id'      => 'POS-DEV-BBB',
            'business_id'    => $this->bizB->id,
            'api_token_hash' => hash('sha256', 'token-b'),
            'status'         => 'active',
        ]);

        // Create sync events belonging to Business A
        SyncEvent::withoutGlobalScopes()->create([
            'event_uuid'  => 'event-a-001',
            'business_id' => $this->bizA->id,
            'device_id'   => 'POS-DEV-AAA-2',
            'entity_type' => 'Merchant',
            'entity_uuid' => 'merchant-uuid-a',
            'operation'   => 'create',
            'payload'     => ['name' => 'Kashmir Merchant', 'business_id' => $this->bizA->id],
            'status'      => 'received',
            'received_at' => now(),
        ]);

        // Create sync events belonging to Business B
        SyncEvent::withoutGlobalScopes()->create([
            'event_uuid'  => 'event-b-001',
            'business_id' => $this->bizB->id,
            'device_id'   => 'POS-DEV-BBB-2',
            'entity_type' => 'Merchant',
            'entity_uuid' => 'merchant-uuid-b',
            'operation'   => 'create',
            'payload'     => ['name' => 'Karachi Merchant', 'business_id' => $this->bizB->id],
            'status'      => 'received',
            'received_at' => now(),
        ]);

        $syncService = app(CentralSyncService::class);

        // Device A pulls changes
        $pullA = $syncService->pullChanges($deviceA);
        $this->assertCount(1, $pullA['events']);
        $this->assertEquals('event-a-001', $pullA['events'][0]['event_uuid']);

        // Device B pulls changes
        $pullB = $syncService->pullChanges($deviceB);
        $this->assertCount(1, $pullB['events']);
        $this->assertEquals('event-b-001', $pullB['events'][0]['event_uuid']);
    }

    /**
     * Test: Protected demo account test@test.com retains admin privileges and business identity
     */
    public function test_protected_account_preservation()
    {
        $this->assertEquals('test@test.com', $this->userDemo->email);
        $this->assertEquals('Admin', $this->userDemo->role);
        $this->assertEquals('biz-test-business', $this->userDemo->business_id);

        $features = PermissionService::getAllowedFeaturesForUser($this->userDemo);
        $this->assertEquals(PermissionService::ALL_FEATURES, $features);

        $this->assertTrue(PermissionService::isRouteAllowed($this->userDemo, 'dashboard'));
        $this->assertTrue(PermissionService::isRouteAllowed($this->userDemo, 'amroza'));
        $this->assertTrue(PermissionService::isRouteAllowed($this->userDemo, 'banking/accounts'));
        $this->assertTrue(PermissionService::isRouteAllowed($this->userDemo, 'reports'));
        $this->assertTrue(PermissionService::isRouteAllowed($this->userDemo, 'backup'));
    }

    /**
     * Test: Unauthorized employee route access is properly redirected with flash message
     */
    public function test_unauthorized_employee_access_returns_proper_response()
    {
        // Business A employee has only 'new_sale' and 'wasooli'
        PosPermission::withoutGlobalScopes()->create([
            'role'             => 'Employee',
            'business_id'      => $this->bizA->id,
            'allowed_features' => ['new_sale', 'wasooli'],
            'version'          => '1.0',
        ]);

        $this->actingAs($this->userEmpA);
        app(TenantContext::class)->setBusinessId($this->bizA->id);

        // Allowed route
        $allowedResponse = $this->get('/amroza');
        $allowedResponse->assertOk();

        // Disallowed route: should redirect to dashboard with error flash
        $disallowedResponse = $this->get('/reports');
        $disallowedResponse->assertRedirect(route('dashboard'));
        $disallowedResponse->assertSessionHas('error');
    }
}
