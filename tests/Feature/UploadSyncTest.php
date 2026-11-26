<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Item;
use App\Models\Merchant;
use App\Models\Option;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleDetail;
use App\Models\SyncDevice;
use App\Models\SyncEvent;
use App\Models\SyncOutbox;
use App\Services\DeviceService;
use App\Services\SaleService;
use App\Services\SyncQueueService;
use App\Services\SyncUploadService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class UploadSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        DeviceService::clearCache();
        SyncQueueService::enableTracking();
    }

    /**
     * Test SyncUploadService pushes local outbox events to central API and marks them synced.
     */
    public function test_sync_upload_service_uploads_batch_and_marks_outbox_synced(): void
    {
        // 1. Create a registered device on server
        SyncDevice::create([
            'uuid'           => (string) Str::uuid(),
            'device_id'      => 'POS-DESKTOP-TEST',
            'api_token_hash' => hash('sha256', 'valid-test-token'),
            'status'         => SyncDevice::STATUS_ACTIVE,
        ]);

        // Configure local device service to match
        Option::updateOrCreate(
            ['meta_key' => 'device_id'],
            ['meta_value' => 'POS-DESKTOP-TEST', 'meta_category' => 'sync']
        );
        Option::updateOrCreate(
            ['meta_key' => 'sync_device_token'],
            ['meta_value' => 'valid-test-token', 'meta_category' => 'sync']
        );

        // 2. Queue local outbox events
        Item::create(['name_en' => 'Mooli', 'unit' => 'Nag']);
        Merchant::create(['name_en' => 'Haji Bashir', 'code' => 50]);

        $this->assertGreaterThanOrEqual(2, SyncOutbox::pending()->count());

        // 3. Mock central server HTTP response
        $pendingEvents = SyncOutbox::pending()->get();
        $eventUuids = $pendingEvents->pluck('uuid')->all();

        Http::fake([
            '*/api/v1/sync/push' => Http::response([
                'success' => true,
                'data'    => [
                    'received_count'           => count($eventUuids),
                    'duplicate_count'          => 0,
                    'accepted_event_uuids'     => $eventUuids,
                    'duplicate_event_uuids'    => [],
                    'acknowledged_event_uuids' => $eventUuids,
                    'processed_count'          => count($eventUuids),
                    'server_timestamp'         => now()->toIso8601String(),
                ],
            ], 200),
        ]);

        $uploadService = app(SyncUploadService::class);
        $uploadResult = $uploadService->uploadPending(100);

        $this->assertTrue($uploadResult['success']);
        $this->assertEquals(count($eventUuids), $uploadResult['synced_count']);

        // Verify outbox rows are now STATUS_SYNCED with synced_at set
        foreach ($pendingEvents as $outbox) {
            $refreshed = $outbox->fresh();
            $this->assertEquals(SyncOutbox::STATUS_SYNCED, $refreshed->status);
            $this->assertNotNull($refreshed->synced_at);
        }

        $this->assertEquals(0, SyncOutbox::pending()->count());
    }

    /**
     * Test SyncUploadService survives network outage without crashing and leaves events pending.
     */
    public function test_sync_upload_service_handles_offline_network_failure_safely(): void
    {
        Option::updateOrCreate(
            ['meta_key' => 'device_id'],
            ['meta_value' => 'POS-OFFLINE-TEST', 'meta_category' => 'sync']
        );
        Option::updateOrCreate(
            ['meta_key' => 'sync_device_token'],
            ['meta_value' => 'any-token', 'meta_category' => 'sync']
        );

        // Create an item to generate an outbox event
        $item = Item::create(['name_en' => 'Adrak', 'unit' => 'Kg']);
        $outbox = SyncOutbox::where('entity_uuid', $item->uuid)->first();
        $this->assertNotNull($outbox);
        $this->assertEquals(SyncOutbox::STATUS_PENDING, $outbox->status);

        // Simulate network connection failure
        Http::fake([
            '*/api/v1/sync/push' => function () {
                throw new ConnectionException('Could not resolve host: central.server.local');
            },
        ]);

        $uploadService = app(SyncUploadService::class);
        $result = $uploadService->uploadPending(10);

        // System must report offline failure gracefully
        $this->assertFalse($result['success']);
        $this->assertEquals('network_unavailable', $result['error']);

        // Outbox event must remain in queue, attempts incremented
        $refreshed = $outbox->fresh();
        $this->assertNotEquals(SyncOutbox::STATUS_SYNCED, $refreshed->status);
        $this->assertGreaterThanOrEqual(1, $refreshed->attempts);
        $this->assertStringContainsString('Network connection failed', $refreshed->last_error);
    }

    /**
     * Test concurrency lock prevents duplicate simultaneous upload executions.
     */
    public function test_sync_upload_service_prevents_concurrent_runs_via_lock(): void
    {
        Cache::lock('pos_sync_upload_running', 60)->get();

        $uploadService = app(SyncUploadService::class);
        $result = $uploadService->uploadPending(10);

        $this->assertFalse($result['success']);
        $this->assertEquals('sync_in_progress', $result['error']);
        $this->assertStringContainsString('already in progress', $result['message']);
    }

    /**
     * Test partial acknowledgments: only acknowledged events become synced, unacknowledged remain pending.
     */
    public function test_sync_upload_service_handles_partial_acknowledgments(): void
    {
        Option::updateOrCreate(
            ['meta_key' => 'device_id'],
            ['meta_value' => 'POS-PARTIAL-TEST', 'meta_category' => 'sync']
        );
        Option::updateOrCreate(
            ['meta_key' => 'sync_device_token'],
            ['meta_value' => 'test-token', 'meta_category' => 'sync']
        );

        $item1 = Item::create(['name_en' => 'Partial Item 1', 'unit' => 'Nag']);
        $item2 = Item::create(['name_en' => 'Partial Item 2', 'unit' => 'Nag']);

        $outbox1 = SyncOutbox::where('entity_uuid', $item1->uuid)->first();
        $outbox2 = SyncOutbox::where('entity_uuid', $item2->uuid)->first();

        // Server acknowledges ONLY event 1
        Http::fake([
            '*/api/v1/sync/push' => Http::response([
                'success' => true,
                'data'    => [
                    'received_count'           => 1,
                    'duplicate_count'          => 0,
                    'accepted_event_uuids'     => [$outbox1->uuid],
                    'duplicate_event_uuids'    => [],
                    'acknowledged_event_uuids' => [$outbox1->uuid], // Only outbox1 acknowledged
                ],
            ], 200),
        ]);

        $uploadService = app(SyncUploadService::class);
        $result = $uploadService->uploadPending(10);

        $this->assertTrue($result['success']);
        $this->assertEquals(1, $result['synced_count']);

        // Event 1 marked synced
        $this->assertEquals(SyncOutbox::STATUS_SYNCED, $outbox1->fresh()->status);
        $this->assertNotNull($outbox1->fresh()->synced_at);

        // Event 2 remains pending for retry with incremented attempts
        $this->assertEquals(SyncOutbox::STATUS_PENDING, $outbox2->fresh()->status);
        $this->assertEquals(1, $outbox2->fresh()->attempts);
        $this->assertEquals('Server did not acknowledge event UUID', $outbox2->fresh()->last_error);
    }

    /**
     * Test HTTP server error leaves events pending with error recorded.
     */
    public function test_sync_upload_service_handles_http_server_error(): void
    {
        Option::updateOrCreate(
            ['meta_key' => 'device_id'],
            ['meta_value' => 'POS-HTTP-ERR', 'meta_category' => 'sync']
        );
        Option::updateOrCreate(
            ['meta_key' => 'sync_device_token'],
            ['meta_value' => 'test-token', 'meta_category' => 'sync']
        );

        $item = Item::create(['name_en' => 'Server Error Item', 'unit' => 'Nag']);
        $outbox = SyncOutbox::where('entity_uuid', $item->uuid)->first();

        Http::fake([
            '*/api/v1/sync/push' => Http::response([
                'success' => false,
                'message' => 'Internal server error occurred',
            ], 500),
        ]);

        $uploadService = app(SyncUploadService::class);
        $result = $uploadService->uploadPending(10);

        $this->assertFalse($result['success']);
        $this->assertEquals('http_500', $result['error']);
        $this->assertEquals(SyncOutbox::STATUS_PENDING, $outbox->fresh()->status);
        $this->assertEquals(1, $outbox->fresh()->attempts);
        $this->assertStringContainsString('500', $outbox->fresh()->last_error);
    }

    /**
     * Test 401 Unauthorized clears stored token and re-registers once.
     */
    public function test_sync_upload_service_recovers_from_expired_token_via_reregistration(): void
    {
        DeviceService::clearCache();
        Option::updateOrCreate(
            ['meta_key' => 'device_id'],
            ['meta_value' => 'POS-TOKEN-EXPIRED', 'meta_category' => 'sync']
        );
        DeviceService::clearCache();
        Option::updateOrCreate(
            ['meta_key' => 'sync_device_token'],
            ['meta_value' => 'expired-token', 'meta_category' => 'sync']
        );

        $item = Item::create(['name_en' => 'Re-auth Item', 'unit' => 'Nag']);
        $outbox = SyncOutbox::where('entity_uuid', $item->uuid)->first();

        $callCount = 0;
        Http::fake([
            '*/api/v1/sync/register' => Http::response([
                'success' => true,
                'data'    => [
                    'device_uuid' => (string) Str::uuid(),
                    'device_id'   => 'POS-TOKEN-EXPIRED',
                    'api_token'   => 'fresh-new-token',
                    'created'     => false,
                ],
            ], 200),
            '*/api/v1/sync/push' => function ($request) use (&$callCount, $outbox) {
                $callCount++;
                if ($request->hasHeader('Authorization', 'Bearer expired-token')) {
                    return Http::response(['message' => 'Unauthenticated'], 401);
                }
                if ($request->hasHeader('Authorization', 'Bearer fresh-new-token')) {
                    return Http::response([
                        'success' => true,
                        'data'    => [
                            'acknowledged_event_uuids' => [$outbox->uuid],
                        ],
                    ], 200);
                }
                return Http::response(['message' => 'Forbidden'], 403);
            },
        ]);

        $uploadService = app(SyncUploadService::class);
        $result = $uploadService->uploadPending(10);

        $this->assertTrue($result['success']);
        $this->assertEquals(1, $result['synced_count']);
        $this->assertEquals(SyncOutbox::STATUS_SYNCED, $outbox->fresh()->status);
        $this->assertEquals('fresh-new-token', Option::where('meta_key', 'sync_device_token')->value('meta_value'));
    }

    /**
     * Test pos:sync-upload artisan command execution and retry-failed option.
     */
    public function test_artisan_sync_upload_command(): void
    {
        // 1. pos:sync-upload with no pending events
        $this->artisan('pos:sync-upload', ['--status' => true])
            ->expectsOutputToContain('No pending events found in outbox')
            ->assertExitCode(0);

        // 2. Create local event
        $item = Item::create(['name_en' => 'Shalgam', 'unit' => 'Nag']);
        $this->assertGreaterThanOrEqual(1, SyncOutbox::pending()->count());

        $outbox = SyncOutbox::pending()->first();

        // Mock upload endpoint
        Http::fake([
            '*/api/v1/sync/push' => Http::response([
                'success' => true,
                'data'    => [
                    'received_count'           => 1,
                    'duplicate_count'          => 0,
                    'accepted_event_uuids'     => [$outbox->uuid],
                    'duplicate_event_uuids'    => [],
                    'acknowledged_event_uuids' => [$outbox->uuid],
                    'processed_count'          => 1,
                ],
            ], 200),
        ]);

        Option::updateOrCreate(
            ['meta_key' => 'sync_device_token'],
            ['meta_value' => 'mock-artisan-token', 'meta_category' => 'sync']
        );

        $this->artisan('pos:sync-upload', ['--batch' => 50, '--status' => true])
            ->assertExitCode(0);

        $this->assertEquals(SyncOutbox::STATUS_SYNCED, $outbox->fresh()->status);
    }

    /**
     * Test offline sales and purchases continue functioning without errors when upload is not triggered.
     */
    public function test_offline_pos_sales_and_purchases_continue_working_without_upload(): void
    {
        $customer = Customer::create(['name' => 'Offline Customer', 'phone' => '03001234567']);
        $product = Product::create([
            'title'          => 'Offline Product',
            'purchase_price' => 200,
            'sale_price'     => 350,
            'status'         => 'active',
        ]);

        $sale = Sale::create([
            'customer_id'     => $customer->id,
            'date'            => '2026-11-24',
            'tax_percentage'  => 0,
            'tax_amount'      => 0,
            'discount_amount' => 0,
            'shipping_amount' => 0,
            'total_amount'    => 700,
            'paid_amount'     => 700,
            'due_amount'      => 0,
            'status'          => 'completed',
            'payment_status'  => 'paid',
            'payment_method'  => 'cash',
        ]);

        app(SaleService::class)->createSaleDetail([
            'products' => [
                [
                    'id'    => $product->id,
                    'price' => 350,
                    'qty'   => 2,
                ],
            ],
        ], $sale->id);

        $this->assertDatabaseHas('sales', ['id' => $sale->id]);
        $this->assertDatabaseHas('sale_details', ['sale_id' => $sale->id]);

        // Outbox recorded both Sale and SaleDetail events
        $this->assertTrue(SyncOutbox::where('entity_type', 'Sale')->where('entity_uuid', $sale->uuid)->exists());
        $this->assertTrue(SyncOutbox::where('entity_type', 'SaleDetail')->exists());
    }
}
