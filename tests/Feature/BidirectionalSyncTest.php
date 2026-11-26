<?php

namespace Tests\Feature;

use App\Models\AmrozaSale;
use App\Models\Area;
use App\Models\Customer;
use App\Models\Farmer;
use App\Models\FarmerBill;
use App\Models\FarmerMark;
use App\Models\Item;
use App\Models\Merchant;
use App\Models\Option;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleDetail;
use App\Models\SyncDevice;
use App\Models\SyncEvent;
use App\Models\SyncOutbox;
use App\Services\BidirectionalSyncService;
use App\Services\CentralSyncService;
use App\Services\DeviceService;
use App\Services\SyncDownloadService;
use App\Services\SyncQueueService;
use App\Services\SyncUploadService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class BidirectionalSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        SyncQueueService::enableTracking();
        DeviceService::clearCache();
        app(SyncDownloadService::class)->resetCursor();
    }

    /**
     * Test incremental download with stable cursors.
     */
    public function test_incremental_download_tracks_and_advances_cursor(): void
    {
        $deviceAId = 'POS-TERMINAL-A';
        $deviceBId = 'POS-TERMINAL-B';

        // Register Device B locally
        Option::updateOrCreate(
            ['meta_key' => 'device_id'],
            ['meta_value' => $deviceBId, 'meta_category' => 'sync']
        );
        Option::updateOrCreate(
            ['meta_key' => 'sync_device_token'],
            ['meta_value' => 'token-device-b', 'meta_category' => 'sync']
        );

        // Server has 2 events created by Device A
        $areaUuid = (string) Str::uuid();
        $itemUuid = (string) Str::uuid();

        Http::fake([
            '*/api/v1/sync/pull*' => function ($request) use ($areaUuid, $itemUuid, $deviceAId) {
                $since = (int) ($request['since_cursor'] ?? 0);
                if ($since === 0) {
                    return Http::response([
                        'success' => true,
                        'data'    => [
                            'events' => [
                                [
                                    'cursor'      => 101,
                                    'event_uuid'  => (string) Str::uuid(),
                                    'device_id'   => $deviceAId,
                                    'entity_type' => 'Area',
                                    'entity_uuid' => $areaUuid,
                                    'operation'   => 'create',
                                    'payload'     => [
                                        'entity_type'   => 'Area',
                                        'entity_uuid'   => $areaUuid,
                                        'attributes'    => ['name_en' => 'Lahore'],
                                        'relationships' => [],
                                    ],
                                    'status'      => 'processed',
                                ],
                                [
                                    'cursor'      => 102,
                                    'event_uuid'  => (string) Str::uuid(),
                                    'device_id'   => $deviceAId,
                                    'entity_type' => 'Item',
                                    'entity_uuid' => $itemUuid,
                                    'operation'   => 'create',
                                    'payload'     => [
                                        'entity_type'   => 'Item',
                                        'entity_uuid'   => $itemUuid,
                                        'attributes'    => ['name_en' => 'Gobhi', 'unit' => 'Nag'],
                                        'relationships' => [],
                                    ],
                                    'status'      => 'processed',
                                ],
                            ],
                            'next_cursor'      => 102,
                            'has_more'         => false,
                            'server_timestamp' => now()->toIso8601String(),
                        ],
                    ], 200);
                }

                return Http::response([
                    'success' => true,
                    'data'    => [
                        'events'           => [],
                        'next_cursor'      => $since,
                        'has_more'         => false,
                        'server_timestamp' => now()->toIso8601String(),
                    ],
                ], 200);
            },
        ]);

        $downloadService = app(SyncDownloadService::class);
        $this->assertEquals(0, $downloadService->getStoredCursor());

        // First download run: applies 2 events and advances cursor to 102
        $result1 = $downloadService->downloadPending(100);

        $this->assertTrue($result1['success']);
        $this->assertEquals(2, $result1['applied_count']);
        $this->assertEquals(102, $result1['current_cursor']);
        $this->assertEquals(102, $downloadService->getStoredCursor());

        // Verify entities exist in local database
        $this->assertDatabaseHas('areas', ['uuid' => $areaUuid, 'name_en' => 'Lahore']);
        $this->assertDatabaseHas('items', ['uuid' => $itemUuid, 'name_en' => 'Gobhi']);

        // Verify no local outbox echo events were created
        $this->assertEquals(0, SyncOutbox::count());

        // Second download run: since_cursor=102 returns 0 new events
        $result2 = $downloadService->downloadPending(100);
        $this->assertTrue($result2['success']);
        $this->assertEquals(0, $result2['applied_count']);
        $this->assertEquals(102, $result2['current_cursor']);
    }

    /**
     * Test exclusion of self-originating events on pull.
     */
    public function test_pull_excludes_self_originating_events(): void
    {
        $deviceA = SyncDevice::create([
            'uuid'           => (string) Str::uuid(),
            'device_id'      => 'DEVICE-A',
            'api_token_hash' => hash('sha256', 'token-a'),
            'status'         => SyncDevice::STATUS_ACTIVE,
        ]);

        $deviceB = SyncDevice::create([
            'uuid'           => (string) Str::uuid(),
            'device_id'      => 'DEVICE-B',
            'api_token_hash' => hash('sha256', 'token-b'),
            'status'         => SyncDevice::STATUS_ACTIVE,
        ]);

        // Event from Device A
        SyncEvent::create([
            'event_uuid'  => (string) Str::uuid(),
            'device_id'   => 'DEVICE-A',
            'entity_type' => 'Area',
            'entity_uuid' => (string) Str::uuid(),
            'operation'   => 'create',
            'payload'     => ['attributes' => ['name_en' => 'Karachi']],
            'status'      => SyncEvent::STATUS_PROCESSED,
        ]);

        // Event from Device B
        SyncEvent::create([
            'event_uuid'  => (string) Str::uuid(),
            'device_id'   => 'DEVICE-B',
            'entity_type' => 'Item',
            'entity_uuid' => (string) Str::uuid(),
            'operation'   => 'create',
            'payload'     => ['attributes' => ['name_en' => 'Kheera']],
            'status'      => SyncEvent::STATUS_PROCESSED,
        ]);

        $centralSync = app(CentralSyncService::class);

        // Pull as Device A: should only receive Device B's event
        $pullA = $centralSync->pullChanges($deviceA, sinceCursor: 0);
        $this->assertCount(1, $pullA['events']);
        $this->assertEquals('Item', $pullA['events'][0]['entity_type']);
        $this->assertEquals('DEVICE-B', $pullA['events'][0]['device_id']);

        // Pull as Device B: should only receive Device A's event
        $pullB = $centralSync->pullChanges($deviceB, sinceCursor: 0);
        $this->assertCount(1, $pullB['events']);
        $this->assertEquals('Area', $pullB['events'][0]['entity_type']);
        $this->assertEquals('DEVICE-A', $pullB['events'][0]['device_id']);
    }

    /**
     * Test full bidirectional data exchange between two independent POS terminals.
     */
    public function test_bidirectional_exchange_between_terminals(): void
    {
        $centralSync = app(CentralSyncService::class);

        $terminalADevice = SyncDevice::create([
            'uuid'           => (string) Str::uuid(),
            'device_id'      => 'TERMINAL-A',
            'api_token_hash' => hash('sha256', 'token-terminal-a'),
            'status'         => SyncDevice::STATUS_ACTIVE,
        ]);

        $terminalBDevice = SyncDevice::create([
            'uuid'           => (string) Str::uuid(),
            'device_id'      => 'TERMINAL-B',
            'api_token_hash' => hash('sha256', 'token-terminal-b'),
            'status'         => SyncDevice::STATUS_ACTIVE,
        ]);

        // STEP 1: Terminal A creates Merchant and Item locally
        $merchantUuid = (string) Str::uuid();
        $itemUuid = (string) Str::uuid();

        $merchantEvent = [
            'event_uuid'  => (string) Str::uuid(),
            'device_id'   => 'TERMINAL-A',
            'entity_type' => 'Merchant',
            'entity_uuid' => $merchantUuid,
            'operation'   => 'create',
            'payload'     => [
                'entity_type'   => 'Merchant',
                'entity_uuid'   => $merchantUuid,
                'attributes'    => ['name_en' => 'Bismillah Vegetable Mart', 'code' => 20],
                'relationships' => [],
            ],
        ];

        $itemEvent = [
            'event_uuid'  => (string) Str::uuid(),
            'device_id'   => 'TERMINAL-A',
            'entity_type' => 'Item',
            'entity_uuid' => $itemUuid,
            'operation'   => 'create',
            'payload'     => [
                'entity_type'   => 'Item',
                'entity_uuid'   => $itemUuid,
                'attributes'    => ['name_en' => 'Shimla Mirch', 'unit' => 'Nag', 'default_rate' => 2500],
                'relationships' => [],
            ],
        ];

        // Terminal A uploads to central server
        $ingest1 = $centralSync->ingestEvents($terminalADevice, [$merchantEvent, $itemEvent]);
        $this->assertEquals(2, $ingest1['received_count']);
        $this->assertEquals(2, $ingest1['processed_count']);

        // STEP 2: Terminal B pulls changes from central server
        $pullResponseB = $centralSync->pullChanges($terminalBDevice, sinceCursor: 0);
        $this->assertCount(2, $pullResponseB['events']);

        // Setup Terminal B local environment
        Option::updateOrCreate(
            ['meta_key' => 'device_id'],
            ['meta_value' => 'TERMINAL-B', 'meta_category' => 'sync']
        );
        Option::updateOrCreate(
            ['meta_key' => 'sync_device_token'],
            ['meta_value' => 'token-terminal-b', 'meta_category' => 'sync']
        );

        Http::fake([
            '*/api/v1/sync/pull*' => Http::response(['success' => true, 'data' => $pullResponseB], 200),
        ]);

        $downloadService = app(SyncDownloadService::class);
        $downResult = $downloadService->downloadPending(100);

        $this->assertTrue($downResult['success']);
        $this->assertEquals(2, $downResult['applied_count']);

        // Verify Merchant and Item materialized in Terminal B's local database
        $bMerchant = Merchant::where('uuid', $merchantUuid)->first();
        $bItem = Item::where('uuid', $itemUuid)->first();
        $this->assertNotNull($bMerchant);
        $this->assertNotNull($bItem);
        $this->assertEquals('Bismillah Vegetable Mart', $bMerchant->name_en);

        // STEP 3: Terminal B creates an AmrozaSale referencing the downloaded Merchant and Item
        $sale = AmrozaSale::create([
            'merchant_id'  => $bMerchant->id,
            'item_id'      => $bItem->id,
            'date'         => '2026-11-23',
            'nag'          => 20,
            'weight'       => 0,
            'rate'         => 2500,
            'bardana'      => 400,
            'payment_type' => 'udhaar',
        ]);

        // Terminal B's local outbox should have 1 pending event (the sale)
        $this->assertEquals(1, SyncOutbox::pending()->count());
        $outboxSale = SyncOutbox::pending()->first();
        $this->assertEquals('AmrozaSale', $outboxSale->entity_type);
        $this->assertEquals($merchantUuid, $outboxSale->payload['relationships']['merchant_uuid']);
        $this->assertEquals($itemUuid, $outboxSale->payload['relationships']['item_uuid']);

        // Terminal B uploads sale to central server
        $saleEvent = [
            'event_uuid'  => $outboxSale->uuid,
            'device_id'   => 'TERMINAL-B',
            'entity_type' => 'AmrozaSale',
            'entity_uuid' => $outboxSale->entity_uuid,
            'operation'   => 'create',
            'payload'     => $outboxSale->payload,
        ];
        $ingest2 = $centralSync->ingestEvents($terminalBDevice, [$saleEvent]);
        $this->assertEquals(1, $ingest2['received_count']);
        $this->assertEquals(1, $ingest2['processed_count']);

        // STEP 4: Terminal A pulls changes from central server
        $pullResponseA = $centralSync->pullChanges($terminalADevice, sinceCursor: 0);
        $this->assertCount(1, $pullResponseA['events']);
        $this->assertEquals('AmrozaSale', $pullResponseA['events'][0]['entity_type']);
        $this->assertEquals('TERMINAL-B', $pullResponseA['events'][0]['device_id']);
    }

    /**
     * Test idempotency: re-downloading existing records does not duplicate data.
     */
    public function test_re_download_is_idempotent(): void
    {
        $itemUuid = (string) Str::uuid();

        Option::updateOrCreate(['meta_key' => 'device_id'], ['meta_value' => 'POS-TEST', 'meta_category' => 'sync']);
        Option::updateOrCreate(['meta_key' => 'sync_device_token'], ['meta_value' => 'token-test', 'meta_category' => 'sync']);

        $mockPayload = [
            'success' => true,
            'data'    => [
                'events' => [
                    [
                        'cursor'      => 50,
                        'event_uuid'  => (string) Str::uuid(),
                        'device_id'   => 'PEER-01',
                        'entity_type' => 'Item',
                        'entity_uuid' => $itemUuid,
                        'operation'   => 'create',
                        'payload'     => [
                            'entity_type'   => 'Item',
                            'entity_uuid'   => $itemUuid,
                            'attributes'    => ['name_en' => 'Saag', 'unit' => 'Nag'],
                            'relationships' => [],
                        ],
                    ],
                ],
                'next_cursor'      => 50,
                'has_more'         => false,
                'server_timestamp' => now()->toIso8601String(),
            ],
        ];

        Http::fake([
            '*/api/v1/sync/pull*' => Http::response($mockPayload, 200),
        ]);

        $downloadService = app(SyncDownloadService::class);

        // Download once
        $res1 = $downloadService->downloadPending(10);
        $this->assertTrue($res1['success']);
        $this->assertEquals(1, Item::where('uuid', $itemUuid)->count());

        // Reset cursor to 0 and re-download identical batch
        $downloadService->resetCursor();
        $this->assertEquals(0, $downloadService->getStoredCursor());

        $res2 = $downloadService->downloadPending(10);
        $this->assertTrue($res2['success']);
        // Verify still exactly 1 item exists in database (no duplicates!)
        $this->assertEquals(1, Item::where('uuid', $itemUuid)->count());
    }

    /**
     * Test download handles offline network failure safely without corrupting cursor.
     */
    public function test_download_handles_offline_network_failure(): void
    {
        Option::updateOrCreate(['meta_key' => 'device_id'], ['meta_value' => 'POS-OFFLINE', 'meta_category' => 'sync']);
        Option::updateOrCreate(['meta_key' => 'sync_device_token'], ['meta_value' => 'token-offline', 'meta_category' => 'sync']);
        Option::updateOrCreate(['meta_key' => 'sync_download_cursor'], ['meta_value' => '42', 'meta_category' => 'sync']);

        Http::fake([
            '*/api/v1/sync/pull*' => function () {
                throw new ConnectionException('Could not connect to central host');
            },
        ]);

        $downloadService = app(SyncDownloadService::class);
        $result = $downloadService->downloadPending(10);

        $this->assertFalse($result['success']);
        $this->assertEquals('network_unavailable', $result['error']);
        // Cursor must remain safe and uncorrupted
        $this->assertEquals(42, $downloadService->getStoredCursor());
    }

    /**
     * Test concurrency mutex locks prevent simultaneous download and bidirectional sync runs.
     */
    public function test_concurrency_mutex_locking(): void
    {
        Cache::lock('pos_sync_download_running', 60)->get();

        $downloadService = app(SyncDownloadService::class);
        $result = $downloadService->downloadPending(10);

        $this->assertFalse($result['success']);
        $this->assertEquals('sync_in_progress', $result['error']);
    }

    /**
     * Test pos:sync and pos:sync-download artisan commands.
     */
    public function test_artisan_bidirectional_commands(): void
    {
        Option::updateOrCreate(['meta_key' => 'device_id'], ['meta_value' => 'POS-CMD-TEST', 'meta_category' => 'sync']);
        Option::updateOrCreate(['meta_key' => 'sync_device_token'], ['meta_value' => 'token-cmd', 'meta_category' => 'sync']);

        Http::fake([
            '*/api/v1/sync/pull*' => Http::response([
                'success' => true,
                'data'    => [
                    'events'           => [],
                    'next_cursor'      => 0,
                    'has_more'         => false,
                    'server_timestamp' => now()->toIso8601String(),
                ],
            ], 200),
            '*/api/v1/sync/push*' => Http::response([
                'success' => true,
                'data'    => [
                    'received_count'           => 0,
                    'duplicate_count'          => 0,
                    'accepted_event_uuids'     => [],
                    'duplicate_event_uuids'    => [],
                    'acknowledged_event_uuids' => [],
                    'processed_count'          => 0,
                ],
            ], 200),
        ]);

        // 1. pos:sync command
        $this->artisan('pos:sync', ['--status' => true])
            ->expectsOutputToContain('Bidirectional sync completed successfully')
            ->assertExitCode(0);

        // 2. pos:sync-download command
        $this->artisan('pos:sync-download', ['--status' => true])
            ->expectsOutputToContain('Already up to date with central server')
            ->assertExitCode(0);

        // 3. pos:sync-status command
        $this->artisan('pos:sync-status')
            ->expectsOutputToContain('POS Synchronization Status')
            ->expectsOutputToContain('Download Cursor')
            ->assertExitCode(0);
    }

    /**
     * Test downloadAll drains multiple paginated batches until exhausted.
     */
    public function test_download_all_drains_multiple_batches(): void
    {
        Option::updateOrCreate(['meta_key' => 'device_id'], ['meta_value' => 'POS-BATCH-DRAIN', 'meta_category' => 'sync']);
        Option::updateOrCreate(['meta_key' => 'sync_device_token'], ['meta_value' => 'token-drain', 'meta_category' => 'sync']);

        $item1Uuid = (string) Str::uuid();
        $item2Uuid = (string) Str::uuid();

        $callCount = 0;
        Http::fake([
            '*/api/v1/sync/pull*' => function ($request) use (&$callCount, $item1Uuid, $item2Uuid) {
                $callCount++;
                $since = (int) ($request['since_cursor'] ?? 0);

                if ($since === 0) {
                    return Http::response([
                        'success' => true,
                        'data'    => [
                            'events' => [
                                [
                                    'cursor'      => 10,
                                    'event_uuid'  => (string) Str::uuid(),
                                    'device_id'   => 'PEER-X',
                                    'entity_type' => 'Item',
                                    'entity_uuid' => $item1Uuid,
                                    'operation'   => 'create',
                                    'payload'     => [
                                        'attributes'    => ['name_en' => 'Batch Item 1', 'unit' => 'Kg'],
                                        'relationships' => [],
                                    ],
                                ],
                            ],
                            'next_cursor' => 10,
                            'has_more'    => true,
                        ],
                    ], 200);
                }

                if ($since === 10) {
                    return Http::response([
                        'success' => true,
                        'data'    => [
                            'events' => [
                                [
                                    'cursor'      => 20,
                                    'event_uuid'  => (string) Str::uuid(),
                                    'device_id'   => 'PEER-X',
                                    'entity_type' => 'Item',
                                    'entity_uuid' => $item2Uuid,
                                    'operation'   => 'create',
                                    'payload'     => [
                                        'attributes'    => ['name_en' => 'Batch Item 2', 'unit' => 'Kg'],
                                        'relationships' => [],
                                    ],
                                ],
                            ],
                            'next_cursor' => 20,
                            'has_more'    => false,
                        ],
                    ], 200);
                }

                return Http::response([
                    'success' => true,
                    'data'    => ['events' => [], 'next_cursor' => $since, 'has_more' => false],
                ], 200);
            },
        ]);

        $downloadService = app(SyncDownloadService::class);
        $result = $downloadService->downloadAll(batchSize: 1, maxBatches: 10);

        $this->assertTrue($result['success']);
        $this->assertEquals(2, $result['applied_count']);
        $this->assertEquals(2, $result['batches_count']);
        $this->assertEquals(20, $downloadService->getStoredCursor());

        $this->assertDatabaseHas('items', ['uuid' => $item1Uuid, 'name_en' => 'Batch Item 1']);
        $this->assertDatabaseHas('items', ['uuid' => $item2Uuid, 'name_en' => 'Batch Item 2']);
    }

    /**
     * Test download with relationship UUID resolution for retail Sales and Customers.
     */
    public function test_download_resolves_foreign_uuids_to_local_ids(): void
    {
        Option::updateOrCreate(['meta_key' => 'device_id'], ['meta_value' => 'POS-REL-TEST', 'meta_category' => 'sync']);
        Option::updateOrCreate(['meta_key' => 'sync_device_token'], ['meta_value' => 'token-rel', 'meta_category' => 'sync']);

        $customerUuid = (string) Str::uuid();
        $saleUuid = (string) Str::uuid();

        Http::fake([
            '*/api/v1/sync/pull*' => Http::response([
                'success' => true,
                'data'    => [
                    'events' => [
                        [
                            'cursor'      => 1,
                            'event_uuid'  => (string) Str::uuid(),
                            'device_id'   => 'PEER-Y',
                            'entity_type' => 'Customer',
                            'entity_uuid' => $customerUuid,
                            'operation'   => 'create',
                            'payload'     => [
                                'attributes'    => ['name' => 'Downloaded Customer', 'phone' => '03111111111'],
                                'relationships' => [],
                            ],
                        ],
                        [
                            'cursor'      => 2,
                            'event_uuid'  => (string) Str::uuid(),
                            'device_id'   => 'PEER-Y',
                            'entity_type' => 'Sale',
                            'entity_uuid' => $saleUuid,
                            'operation'   => 'create',
                            'payload'     => [
                                'attributes' => [
                                    'date'            => '2026-11-24',
                                    'tax_percentage'  => 0,
                                    'tax_amount'      => 0,
                                    'discount_amount' => 0,
                                    'shipping_amount' => 0,
                                    'total_amount'    => 1500,
                                    'paid_amount'     => 1500,
                                    'due_amount'      => 0,
                                    'status'          => 'completed',
                                    'payment_status'  => 'paid',
                                    'payment_method'  => 'cash',
                                ],
                                'relationships' => [
                                    'customer_uuid' => $customerUuid,
                                ],
                            ],
                        ],
                    ],
                    'next_cursor' => 2,
                    'has_more'    => false,
                ],
            ], 200),
        ]);

        $downloadService = app(SyncDownloadService::class);
        $result = $downloadService->downloadPending(10);

        $this->assertTrue($result['success']);
        $this->assertEquals(2, $result['applied_count']);

        $customer = Customer::where('uuid', $customerUuid)->first();
        $this->assertNotNull($customer);

        $sale = Sale::where('uuid', $saleUuid)->first();
        $this->assertNotNull($sale);
        $this->assertEquals($customer->id, $sale->customer_id);
    }

    /**
     * Test downloaded records never trigger outbox events (loop prevention).
     */
    public function test_downloaded_records_do_not_populate_local_outbox(): void
    {
        Option::updateOrCreate(['meta_key' => 'device_id'], ['meta_value' => 'POS-NO-ECHO', 'meta_category' => 'sync']);
        Option::updateOrCreate(['meta_key' => 'sync_device_token'], ['meta_value' => 'token-echo', 'meta_category' => 'sync']);

        $productUuid = (string) Str::uuid();

        Http::fake([
            '*/api/v1/sync/pull*' => Http::response([
                'success' => true,
                'data'    => [
                    'events' => [
                        [
                            'cursor'      => 1,
                            'event_uuid'  => (string) Str::uuid(),
                            'device_id'   => 'PEER-Z',
                            'entity_type' => 'Product',
                            'entity_uuid' => $productUuid,
                            'operation'   => 'create',
                            'payload'     => [
                                'attributes' => [
                                    'title'          => 'Imported Mango Box',
                                    'purchase_price' => 1200,
                                    'sale_price'     => 1800,
                                    'status'         => 'active',
                                ],
                                'relationships' => [],
                            ],
                        ],
                    ],
                    'next_cursor' => 1,
                    'has_more'    => false,
                ],
            ], 200),
        ]);

        $this->assertEquals(0, SyncOutbox::count());

        $downloadService = app(SyncDownloadService::class);
        $result = $downloadService->downloadPending(10);

        $this->assertTrue($result['success']);
        $this->assertDatabaseHas('products', ['uuid' => $productUuid, 'title' => 'Imported Mango Box']);

        // Outbox must remain completely untouched!
        $this->assertEquals(0, SyncOutbox::count());
    }

    /**
     * Test resetCursor deletes both options record and JSON file.
     */
    public function test_reset_cursor_cleans_db_and_storage_file(): void
    {
        $downloadService = app(SyncDownloadService::class);

        $downloadService->storeCursor(777);
        $this->assertEquals(777, $downloadService->getStoredCursor());

        $filePath = storage_path('app/sync_cursor.json');
        $this->assertTrue(File::exists($filePath));

        $downloadService->resetCursor();
        $this->assertEquals(0, $downloadService->getStoredCursor());
        $this->assertFalse(File::exists($filePath));
    }
}
