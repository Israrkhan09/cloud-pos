<?php

namespace Tests\Feature;

use App\Models\AmrozaSale;
use App\Models\Business;
use App\Models\Customer;
use App\Models\Farmer;
use App\Models\Item;
use App\Models\Merchant;
use App\Models\MerchantReceipt;
use App\Models\Option;
use App\Models\Product;
use App\Models\SyncDevice;
use App\Models\SyncEvent;
use App\Models\SyncOutbox;
use App\Models\User;
use App\Services\DashboardService;
use App\Services\DeviceService;
use App\Services\SyncDownloadService;
use App\Services\SyncQueueService;
use App\Services\SyncUploadService;
use App\Services\TenantContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class MultiTenantBusinessIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected User $testAdmin;
    protected User $lahoreEmployee;
    protected Business $bizTest;
    protected Business $bizLahore;

    protected function setUp(): void
    {
        parent::setUp();
        SyncQueueService::enableTracking();
        DeviceService::clearCache();
        app(TenantContext::class)->clear();

        // 1. Seed/Retrieve Business A: Test Business
        $this->bizTest = Business::firstOrCreate(
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

        // 2. Seed/Retrieve Business B: Kashmir Sabzi Mandi
        $this->bizLahore = Business::firstOrCreate(
            ['id' => 'biz-mwwelxma-b9b93a'],
            [
                'name'           => 'Kashmir Sabzi Mandi',
                'owner_name'     => 'Chaudhry Ali',
                'email'          => 'anushakamran20@gmail.com',
                'city'           => 'Kashmir',
                'mandi_location' => 'Kashmir Sabzi Mandi',
                'status'         => 'Active',
            ]
        );

        // 3. Seed/Retrieve users
        $this->testAdmin = User::firstOrCreate(
            ['email' => 'test@test.com'],
            [
                'name'          => 'Test User',
                'password'      => Hash::make('password'),
                'role'          => 'Admin',
                'business_id'   => 'biz-test-business',
                'status'        => 'Active',
            ]
        );
        $this->testAdmin->update(['business_id' => 'biz-test-business']);

        $this->lahoreEmployee = User::firstOrCreate(
            ['email' => 'anushakamran2004@gmail.com'],
            [
                'name'          => 'Anusha Kamran',
                'password'      => Hash::make('securepass123'),
                'role'          => 'Employee',
                'business_id'   => 'biz-mwwelxma-b9b93a',
                'cloud_user_id' => 'usr-mwweohim-f591b8',
                'status'        => 'Active',
            ]
        );
        $this->lahoreEmployee->update(['business_id' => 'biz-mwwelxma-b9b93a']);
    }

    /**
     * Test 1: Existing Test Business data remains preserved and accessible to test@test.com.
     */
    public function test_existing_test_business_data_preserved_and_accessible_to_test_user(): void
    {
        // Seed sample test records belonging to biz-test-business
        $merchant = Merchant::create([
            'business_id'     => 'biz-test-business',
            'name_en'         => 'Haji Aslam Test',
            'current_balance' => 15000.00,
            'status'          => 'active',
        ]);

        $item = Item::create([
            'business_id'   => 'biz-test-business',
            'name_en'       => 'Aalu Red Skin',
            'code'          => 'AALU-01',
            'current_stock' => 100,
            'status'        => 'active',
        ]);

        $sale = AmrozaSale::create([
            'business_id'   => 'biz-test-business',
            'date'          => date('Y-m-d'),
            'merchant_id'   => $merchant->id,
            'item_id'       => $item->id,
            'nag'           => 10,
            'weight'        => 500,
            'rate'          => 40,
            'gross_amount'  => 400.00,
            'payment_type'  => 'cash',
        ]);

        $customer = Customer::create([
            'business_id' => 'biz-test-business',
            'name'        => 'Chaudhry Akram',
            'phone'       => '03001234567',
            'status'      => 'active',
        ]);

        $farmer = Farmer::create([
            'business_id'     => 'biz-test-business',
            'name_en'         => 'Kisan Ghulam',
            'current_balance' => 25000.00,
            'status'          => 'active',
        ]);

        // Log in as test@test.com
        $response = $this->actingAs($this->testAdmin)->get('/dashboard');
        $response->assertStatus(200);

        // Verify active tenant context
        $tenant = app(TenantContext::class);
        $this->assertEquals('biz-test-business', $tenant->getBusinessId());
        $this->assertEquals('Test Business', $tenant->getBusiness()->name);

        // Verify data visibility
        $this->assertEquals(1, AmrozaSale::count());
        $this->assertEquals(1, Item::count());
        $this->assertEquals(1, Merchant::count());
        $this->assertEquals(1, Customer::count());
        $this->assertEquals(1, Farmer::count());

        // Verify dashboard numbers
        $dash = app(DashboardService::class)->getDashboardItems('today');
        $this->assertGreaterThanOrEqual(400.00, $dash['stats']['todaysSale']);
        $this->assertEquals(15000.00, $dash['stats']['merchantsBalance']);
        $this->assertEquals(25000.00, $dash['stats']['farmersBalance']);
    }

    /**
     * Test 2: New Business Employee starts with a clean, empty workspace.
     */
    public function test_new_business_employee_starts_with_clean_empty_workspace(): void
    {
        // Seed records for Business A (Test Business)
        $merchant = Merchant::create([
            'business_id'     => 'biz-test-business',
            'name_en'         => 'Haji Aslam Test',
            'current_balance' => 50000.00,
            'status'          => 'active',
        ]);

        $item = Item::create([
            'business_id'   => 'biz-test-business',
            'name_en'       => 'Pyaz White',
            'code'          => 'PYAZ-01',
            'current_stock' => 50,
            'status'        => 'active',
        ]);

        AmrozaSale::create([
            'business_id'  => 'biz-test-business',
            'date'         => date('Y-m-d'),
            'merchant_id'  => $merchant->id,
            'item_id'      => $item->id,
            'nag'          => 10,
            'weight'       => 500,
            'rate'         => 24,
            'gross_amount' => 12000.00,
            'payment_type' => 'cash',
        ]);

        // Log in as Anusha Kamran (New Mandi Employee)
        $response = $this->actingAs($this->lahoreEmployee)->get('/dashboard');
        $response->assertStatus(200);

        // Verify active tenant context
        $tenant = app(TenantContext::class);
        $this->assertEquals('biz-mwwelxma-b9b93a', $tenant->getBusinessId());
        $this->assertEquals('Kashmir Sabzi Mandi', $tenant->getBusiness()->name);

        // Verify clean empty workspace for Business B
        $this->assertEquals(0, AmrozaSale::count(), 'New Mandi must see 0 sales.');
        $this->assertEquals(0, Item::count(), 'New Mandi must see empty inventory.');
        $this->assertEquals(0, Merchant::count(), 'New Mandi must see 0 merchants.');
        $this->assertEquals(0, Customer::count(), 'New Mandi must see 0 customers.');
        $this->assertEquals(0, Farmer::count(), 'New Mandi must see 0 farmers.');

        // Verify dashboard metrics are all 0
        $dash = app(DashboardService::class)->getDashboardItems('today');
        $this->assertEquals(0, $dash['stats']['todaysSale']);
        $this->assertEquals(0, $dash['stats']['merchantsBalance']);
        $this->assertEquals(0, $dash['stats']['farmersBalance']);
        $this->assertEquals(0, $dash['stats']['totalCashAndBank']);
        $this->assertCount(0, $dash['topMerchants']);
        $this->assertCount(0, $dash['recentSales']);
    }

    /**
     * Test 3: Strict query isolation prevents direct ID or UUID retrieval across business boundaries.
     */
    public function test_strict_query_isolation_between_businesses(): void
    {
        // Business A creates customer and product
        $customerBizA = Customer::create([
            'business_id' => 'biz-test-business',
            'name'        => 'Confidential Customer A',
            'phone'       => '03009999999',
            'status'      => 'active',
        ]);

        $itemBizA = Item::create([
            'business_id' => 'biz-test-business',
            'name_en'     => 'Confidential Item A',
            'code'        => 'CONF-01',
            'status'      => 'active',
        ]);

        // Authenticate as Business B
        $this->actingAs($this->lahoreEmployee);

        // 1. Direct Model::find() by primary key must return null
        $this->assertNull(Customer::find($customerBizA->id));
        $this->assertNull(Item::find($itemBizA->id));

        // 2. Querying by UUID must return null
        $this->assertNull(Customer::where('uuid', $customerBizA->uuid)->first());
        $this->assertNull(Item::where('uuid', $itemBizA->uuid)->first());

        // 3. Search queries must return empty collection
        $this->assertCount(0, Customer::where('name', 'like', '%Confidential%')->get());
        $this->assertCount(0, Item::where('name_en', 'like', '%Confidential%')->get());

        // 4. Business B creates its own item with the same code
        $itemBizB = Item::create([
            'name_en' => 'Lahore Item B',
            'code'    => 'CONF-01',
            'status'  => 'active',
        ]);

        // Business B should only see its own item
        $this->assertEquals(1, Item::count());
        $this->assertEquals('Lahore Item B', Item::first()->name_en);
        $this->assertEquals('biz-mwwelxma-b9b93a', $itemBizB->business_id);

        // Switch to Business A and confirm Business A cannot see Business B's item
        $this->actingAs($this->testAdmin);
        $this->assertNull(Item::where('name_en', 'Lahore Item B')->first());
        $this->assertEquals(1, Item::count());
        $this->assertEquals('Confidential Item A', Item::first()->name_en);
    }

    /**
     * Test 4: Switching accounts invalidates and replaces tenant context without residual cache.
     */
    public function test_switching_accounts_invalidates_and_replaces_tenant_context(): void
    {
        // Step 1: Admin logs in to Test Business
        $loginTest = $this->post('/login', [
            'email'    => 'test@test.com',
            'password' => 'password',
        ]);
        $loginTest->assertRedirect('/dashboard');
        $this->assertEquals('biz-test-business', session('active_business_id'));

        // Step 2: Admin logs out
        $this->post('/logout');
        $this->assertNull(session('active_business_id'));

        // Step 3: Employee logs in to New Mandi
        $loginLahore = $this->post('/login', [
            'email'    => 'anushakamran2004@gmail.com',
            'password' => 'securepass123',
        ]);
        $loginLahore->assertRedirect('/dashboard');
        $this->assertEquals('biz-mwwelxma-b9b93a', session('active_business_id'));

        // Step 4: Employee logs out and Admin logs back in
        $this->post('/logout');
        $this->post('/login', [
            'email'    => 'test@test.com',
            'password' => 'password',
        ]);
        $this->assertEquals('biz-test-business', session('active_business_id'));
    }

    /**
     * Test 5: Offline tenant isolation works with internet completely disconnected.
     */
    public function test_offline_tenant_isolation_with_network_disconnected(): void
    {
        // Simulate offline environment
        Http::fake(function () {
            throw new ConnectionException('No internet connection');
        });

        // 1. Log in offline as Test Admin
        $res1 = $this->post('/login', [
            'email'    => 'test@test.com',
            'password' => 'password',
        ]);
        $res1->assertRedirect('/dashboard');
        $this->assertEquals('biz-test-business', session('active_business_id'));

        $this->post('/logout');

        // 2. Log in offline as Lahore Employee
        $res2 = $this->post('/login', [
            'email'    => 'anushakamran2004@gmail.com',
            'password' => 'securepass123',
        ]);
        $res2->assertRedirect('/dashboard');
        $this->assertEquals('biz-mwwelxma-b9b93a', session('active_business_id'));
    }

    /**
     * Test 6: Synchronization prevents cross-tenant event upload and download leakage.
     */
    public function test_sync_isolation_prevents_cross_tenant_event_leakage(): void
    {
        // Authenticate as Business A and create an item
        $this->actingAs($this->testAdmin);
        $itemA = Item::create([
            'name_en' => 'Tamatar Test A',
            'code'    => 'TAM-01',
            'status'  => 'active',
        ]);

        // Outbox event must have business_id = biz-test-business
        $outboxA = SyncOutbox::where('entity_uuid', $itemA->uuid)->first();
        $this->assertNotNull($outboxA);
        $this->assertEquals('biz-test-business', $outboxA->business_id);

        // Switch context to Business B
        $this->actingAs($this->lahoreEmployee);

        // When Business B queries pending events, it must NOT receive Business A's outbox events
        $pendingForB = app(SyncQueueService::class)->getPendingEvents(100);
        $this->assertCount(0, $pendingForB);

        // Download cursor key must be isolated per business
        $downloadService = app(SyncDownloadService::class);
        $downloadService->storeCursor(42, 'biz-test-business');
        $downloadService->storeCursor(99, 'biz-mwwelxma-b9b93a');

        $this->assertEquals(42, $downloadService->getStoredCursor('biz-test-business'));
        $this->assertEquals(99, $downloadService->getStoredCursor('biz-mwwelxma-b9b93a'));
    }

    /**
     * Test 7: Data integrity verification (no orphaned records or broken foreign keys).
     */
    public function test_data_integrity_no_orphaned_records(): void
    {
        $this->actingAs($this->testAdmin);

        $merchant = Merchant::create([
            'name_en' => 'Test Merchant Integrity',
            'status'  => 'active',
        ]);

        $item = Item::create([
            'name_en' => 'Test Item Integrity',
            'code'    => 'INT-01',
            'status'  => 'active',
        ]);

        $sale = AmrozaSale::create([
            'date'         => date('Y-m-d'),
            'merchant_id'  => $merchant->id,
            'item_id'      => $item->id,
            'nag'          => 5,
            'weight'       => 250,
            'rate'         => 30,
            'gross_amount' => 150.00,
            'payment_type' => 'cash',
        ]);

        // Check relational business consistency
        $this->assertEquals('biz-test-business', $merchant->business_id);
        $this->assertEquals('biz-test-business', $item->business_id);
        $this->assertEquals('biz-test-business', $sale->business_id);
        $this->assertEquals($merchant->business_id, $sale->merchant->business_id);
        $this->assertEquals($item->business_id, $sale->item->business_id);
    }

    /**
     * Test 8: Invalid credentials must be rejected and cannot authenticate.
     */
    public function test_invalid_credentials_rejected_and_cannot_log_in(): void
    {
        $response = $this->post('/login', [
            'email'    => 'test@test.com',
            'password' => 'wrong-password-1234',
        ]);

        $response->assertSessionHasErrors('email');
        $this->assertGuest();
        $this->assertNull(session('active_business_id'));
    }

    /**
     * Test 9: Unassigned user without business_id cannot log in and is denied.
     */
    public function test_unassigned_user_cannot_log_in_and_is_denied(): void
    {
        $unassignedUser = User::create([
            'name'        => 'Orphan User',
            'email'       => 'orphan@example.com',
            'password'    => Hash::make('password123'),
            'role'        => 'Employee',
            'business_id' => null,
            'status'      => 'Active',
        ]);

        $response = $this->post('/login', [
            'email'    => 'orphan@example.com',
            'password' => 'password123',
        ]);

        $response->assertSessionHasErrors('email');
        $this->assertGuest();
        $this->assertNull(session('active_business_id'));
    }

    /**
     * Test 10: User assigned to inactive or suspended business is denied login.
     */
    public function test_inactive_business_user_cannot_log_in(): void
    {
        $inactiveBiz = Business::create([
            'id'     => 'biz-inactive-mandi',
            'name'   => 'Suspended Mandi',
            'status' => 'Suspended',
        ]);

        $suspendedBizUser = User::create([
            'name'        => 'Suspended Employee',
            'email'       => 'suspended@mandi.com',
            'password'    => Hash::make('password123'),
            'role'        => 'Employee',
            'business_id' => 'biz-inactive-mandi',
            'status'      => 'Active',
        ]);

        $response = $this->post('/login', [
            'email'    => 'suspended@mandi.com',
            'password' => 'password123',
        ]);

        $response->assertSessionHasErrors('email');
        $this->assertGuest();
        $this->assertNull(session('active_business_id'));
    }

    /**
     * Test 11: Unauthenticated or unassigned query returns zero records (1 = 0 defense).
     */
    public function test_unauthenticated_or_unassigned_query_returns_zero_records(): void
    {
        // Populate records under Business A and Business B
        $this->actingAs($this->testAdmin);
        Item::create(['name_en' => 'Test Item Scope', 'code' => 'SCP-01', 'status' => 'active']);

        $this->actingAs($this->lahoreEmployee);
        Item::create(['name_en' => 'Lahore Item Scope', 'code' => 'SCP-02', 'status' => 'active']);

        // Authenticate as a user with NO business_id assigned
        $orphanUser = User::create([
            'name'        => 'Unassigned User',
            'email'       => 'unassigned_scope@test.com',
            'password'    => Hash::make('password'),
            'business_id' => null,
            'status'      => 'Active',
        ]);
        $this->actingAs($orphanUser);

        // Eloquent queries on scoped models must return 0 records
        $items = Item::all();
        $this->assertCount(0, $items);

        $merchants = Merchant::all();
        $this->assertCount(0, $merchants);
    }

    /**
     * Test 12: Logout completely terminates session, clears tenant context and redirects.
     */
    public function test_logout_completely_terminates_session_and_clears_tenant_context(): void
    {
        // Log in
        $this->post('/login', [
            'email'    => 'test@test.com',
            'password' => 'password',
        ]);
        $this->assertAuthenticatedAs($this->testAdmin);
        $this->assertEquals('biz-test-business', session('active_business_id'));

        // Post logout
        $logoutResponse = $this->post('/logout');
        $logoutResponse->assertRedirect('/');

        $this->assertGuest();
        $this->assertNull(session('active_business_id'));
        $this->assertNull(app(TenantContext::class)->getBusinessId());

        // GET logout also works safely
        $this->actingAs($this->testAdmin);
        session(['active_business_id' => 'biz-test-business']);
        $getLogoutResponse = $this->get('/logout');
        $getLogoutResponse->assertRedirect('/');
        $this->assertGuest();
    }

    /**
     * Test 13: Chaudhry Ali / Kashmir Sabzi Mandi strict data isolation.
     */
    public function test_kashmir_sabzi_mandi_chaudhry_ali_isolation(): void
    {
        $chaudhryAli = User::firstOrCreate(
            ['email' => 'chaudhryali@kashmirmandi.com'],
            [
                'name'        => 'Chaudhry Ali',
                'password'    => Hash::make('password123'),
                'role'        => 'Admin',
                'business_id' => 'biz-mwwelxma-b9b93a',
                'status'      => 'Active',
            ]
        );

        // Chaudhry Ali logs in
        $loginRes = $this->post('/login', [
            'email'    => 'chaudhryali@kashmirmandi.com',
            'password' => 'password123',
        ]);
        $loginRes->assertRedirect('/dashboard');
        $this->assertEquals('biz-mwwelxma-b9b93a', session('active_business_id'));

        // Chaudhry Ali creates a Kashmir Mandi item
        $this->actingAs($chaudhryAli);
        $kashmirItem = Item::create([
            'name_en' => 'Kashmir Seb Special',
            'code'    => 'KAS-01',
            'status'  => 'active',
        ]);
        $this->assertEquals('biz-mwwelxma-b9b93a', $kashmirItem->business_id);

        // Chaudhry Ali cannot see Test Business items
        $this->actingAs($this->testAdmin);
        Item::create(['name_en' => 'Test Business Special', 'code' => 'TBS-01', 'status' => 'active']);

        $this->actingAs($chaudhryAli);
        $itemsVisibleToChaudhry = Item::pluck('name_en')->toArray();
        $this->assertContains('Kashmir Seb Special', $itemsVisibleToChaudhry);
        $this->assertNotContains('Test Business Special', $itemsVisibleToChaudhry);

        // Verify business metadata matches employee exactly
        $adminBizSummary = app(TenantContext::class)->getBusinessSummary();
        $this->assertEquals('biz-mwwelxma-b9b93a', $adminBizSummary['id']);
        $this->assertEquals('Kashmir Sabzi Mandi', $adminBizSummary['name']);
        $this->assertEquals('Kashmir Sabzi Mandi', $adminBizSummary['mandi_location']);

        // Check employee resolution matches admin canonical ID and metadata
        $this->actingAs($this->lahoreEmployee);
        $empBizSummary = app(TenantContext::class)->getBusinessSummary();
        $this->assertEquals($adminBizSummary['id'], $empBizSummary['id']);
        $this->assertEquals($adminBizSummary['name'], $empBizSummary['name']);
        $this->assertEquals($adminBizSummary['mandi_location'], $empBizSummary['mandi_location']);
    }
}
