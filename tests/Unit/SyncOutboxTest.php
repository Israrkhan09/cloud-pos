<?php

namespace Tests\Unit;

use App\Models\AmrozaSale;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\Farmer;
use App\Models\FarmerBill;
use App\Models\InvestmentPartner;
use App\Models\InvestmentTransaction;
use App\Models\Item;
use App\Models\Merchant;
use App\Models\MerchantReceipt;
use App\Models\Option;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleDetail;
use App\Models\SyncOutbox;
use App\Models\User;
use App\Services\AmrozaService;
use App\Services\DeviceService;
use App\Services\SyncQueueService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class SyncOutboxTest extends TestCase
{
    use RefreshDatabase;

    protected SyncQueueService $syncQueue;

    protected function setUp(): void
    {
        parent::setUp();
        $this->syncQueue = app(SyncQueueService::class);
    }

    public function test_create_operations_are_recorded_for_primary_mandi_and_expense_entities(): void
    {
        $merchant = Merchant::create(['name_en' => 'Outbox Merchant', 'opening_balance' => 100]);
        $farmer = Farmer::create(['name_en' => 'Outbox Farmer', 'opening_balance' => 50]);
        $mark = $farmer->marks()->first();
        $item = Item::create(['name_en' => 'Outbox Onion', 'unit' => 'Nag', 'default_rate' => 1000]);

        $sale = AmrozaSale::create([
            'date'        => '2026-11-22',
            'merchant_id' => $merchant->id,
            'item_id'     => $item->id,
            'nag'         => 5,
            'weight'      => 0,
            'rate'        => 1000,
            'bardana'     => 50,
        ]);

        $receipt = MerchantReceipt::create([
            'date'        => '2026-11-22',
            'merchant_id' => $merchant->id,
            'amount'      => 2000,
            'type'        => 'recovery',
        ]);

        $bill = FarmerBill::create([
            'date'              => '2026-11-22',
            'farmer_id'         => $farmer->id,
            'farmer_mark_id'    => $mark->id,
            'item_id'           => $item->id,
            'nag'               => 5,
            'weight'            => 0,
            'rate'              => 1000,
            'commission_pct'    => 6,
            'bardana_per_nag'   => 10,
            'gross_amount'      => 5000,
            'commission_amount' => 300,
            'bardana_amount'    => 50,
            'net_amount'        => 4650,
        ]);

        $partner = InvestmentPartner::create([
            'name'            => 'Partner One',
            'role'            => 'partner',
            'opening_capital' => 100000,
        ]);

        $invTx = InvestmentTransaction::create([
            'ref_no'         => 'CI-9001',
            'date'           => '2026-11-22',
            'type'           => 'capital_in',
            'partner_id'     => $partner->id,
            'party_name'     => 'Partner One',
            'amount'         => 25000,
            'payment_method' => 'cash',
        ]);

        $expense = Expense::create([
            'date'        => '2026-11-22',
            'title'       => 'Ice & Loader',
            'amount'      => 500,
            'description' => 'Daily expense',
        ]);

        $entities = [
            ['Merchant', $merchant],
            ['Farmer', $farmer],
            ['FarmerMark', $mark],
            ['Item', $item],
            ['AmrozaSale', $sale],
            ['MerchantReceipt', $receipt],
            ['FarmerBill', $bill],
            ['InvestmentPartner', $partner],
            ['InvestmentTransaction', $invTx],
            ['Expense', $expense],
        ];

        $deviceId = DeviceService::id();
        $seenOutboxUuids = [];

        foreach ($entities as [$type, $model]) {
            $entry = SyncOutbox::where('entity_type', $type)
                ->where('entity_uuid', $model->uuid)
                ->where('operation', SyncOutbox::OP_CREATE)
                ->first();

            $this->assertNotNull($entry, "Missing create outbox entry for {$type}");
            $this->assertTrue(Str::isUuid($entry->uuid));
            $this->assertNotContains($entry->uuid, $seenOutboxUuids);
            $seenOutboxUuids[] = $entry->uuid;

            $this->assertSame($deviceId, $entry->device_id);
            $this->assertSame(SyncOutbox::STATUS_PENDING, $entry->status);
            $this->assertNull($entry->synced_at);
            $this->assertSame($type, $entry->payload['entity_type']);
            $this->assertSame($model->uuid, $entry->payload['entity_uuid']);
            $this->assertSame(SyncOutbox::OP_CREATE, $entry->payload['operation']);
            $this->assertSame($deviceId, $entry->payload['device_id']);
            $this->assertNotEmpty($entry->payload['timestamp']);
            $this->assertIsArray($entry->payload['attributes']);
        }
    }

    public function test_payload_includes_resolved_relationship_uuids(): void
    {
        $merchant = Merchant::create(['name_en' => 'Rel Merchant']);
        $farmer = Farmer::create(['name_en' => 'Rel Farmer']);
        $mark = $farmer->marks()->first();
        $item = Item::create(['name_en' => 'Rel Potato', 'unit' => 'Nag']);

        $sale = AmrozaSale::create([
            'date'        => '2026-11-22',
            'merchant_id' => $merchant->id,
            'item_id'     => $item->id,
            'nag'         => 2,
            'rate'        => 500,
        ]);

        $saleEntry = SyncOutbox::where('entity_type', 'AmrozaSale')
            ->where('entity_uuid', $sale->uuid)
            ->first();

        $this->assertNotNull($saleEntry);
        $this->assertSame($merchant->uuid, $saleEntry->payload['relationships']['merchant_uuid'] ?? null);
        $this->assertSame($item->uuid, $saleEntry->payload['relationships']['item_uuid'] ?? null);

        $bill = FarmerBill::create([
            'date'           => '2026-11-22',
            'farmer_id'      => $farmer->id,
            'farmer_mark_id' => $mark->id,
            'item_id'        => $item->id,
            'nag'            => 3,
            'rate'           => 800,
            'gross_amount'   => 2400,
            'net_amount'     => 2200,
        ]);

        $billEntry = SyncOutbox::where('entity_type', 'FarmerBill')
            ->where('entity_uuid', $bill->uuid)
            ->first();

        $this->assertNotNull($billEntry);
        $this->assertSame($farmer->uuid, $billEntry->payload['relationships']['farmer_uuid'] ?? null);
        $this->assertSame($mark->uuid, $billEntry->payload['relationships']['farmer_mark_uuid'] ?? null);
        $this->assertSame($item->uuid, $billEntry->payload['relationships']['item_uuid'] ?? null);
    }

    public function test_update_tracking_records_changes_and_suppresses_noop_saves(): void
    {
        $item = Item::create(['name_en' => 'Tomato', 'unit' => 'Nag', 'default_rate' => 400]);

        $initialCount = SyncOutbox::where('entity_uuid', $item->uuid)->count();
        $this->assertSame(1, $initialCount);

        // No-op save without dirty attributes must not create an update event
        $item->save();
        $this->assertSame(1, SyncOutbox::where('entity_uuid', $item->uuid)->count());

        // Real update must create an update event with changed_fields
        $item->update(['default_rate' => 550]);

        $entries = SyncOutbox::where('entity_uuid', $item->uuid)->orderBy('id')->get();
        $this->assertCount(2, $entries);

        $updateEntry = $entries->last();
        $this->assertSame(SyncOutbox::OP_UPDATE, $updateEntry->operation);
        $this->assertContains('default_rate', $updateEntry->payload['changed_fields']);
        $this->assertSame(550, (int) $updateEntry->payload['attributes']['default_rate']);
        $this->assertNotSame($entries->first()->uuid, $updateEntry->uuid);
    }

    public function test_delete_tracking_records_soft_and_hard_deletes(): void
    {
        // Soft-deleted model (AmrozaSale)
        $merchant = Merchant::create(['name_en' => 'Del Merchant']);
        $item = Item::create(['name_en' => 'Del Item', 'unit' => 'Nag']);
        $sale = AmrozaSale::create([
            'date'        => '2026-11-22',
            'merchant_id' => $merchant->id,
            'item_id'     => $item->id,
            'nag'         => 4,
            'rate'        => 300,
        ]);

        $saleUuid = $sale->uuid;
        $sale->delete();

        $deleteEntry = SyncOutbox::where('entity_type', 'AmrozaSale')
            ->where('entity_uuid', $saleUuid)
            ->where('operation', SyncOutbox::OP_DELETE)
            ->first();

        $this->assertNotNull($deleteEntry);
        $this->assertSame($saleUuid, $deleteEntry->payload['entity_uuid']);
        $this->assertNotEmpty($deleteEntry->payload['attributes']['deleted_at']);

        // Hard-deleted model (SaleDetail)
        $customer = Customer::create(['name' => 'Test Cust', 'phone' => '03001112223']);
        $product = Product::create([
            'title'          => 'Test Prod',
            'purchase_price' => 100,
            'sale_price'     => 150,
            'status'         => 'active',
        ]);
        $posSale = Sale::create([
            'date'            => '2026-11-22',
            'customer_id'     => $customer->id,
            'tax_percentage'  => 0,
            'tax_amount'      => 0,
            'discount_amount' => 0,
            'shipping_amount' => 0,
            'total_amount'    => 300,
            'paid_amount'     => 300,
            'due_amount'      => 0,
            'status'          => 'completed',
            'payment_status'  => 'paid',
            'payment_method'  => 'cash',
        ]);
        $detail = SaleDetail::create([
            'sale_id'    => $posSale->id,
            'product_id' => $product->id,
            'qty'        => 2,
            'price'      => 150,
            'sub_total'  => 300,
        ]);

        $detailUuid = $detail->uuid;
        $detail->delete();

        $hardDeleteEntry = SyncOutbox::where('entity_type', 'SaleDetail')
            ->where('entity_uuid', $detailUuid)
            ->where('operation', SyncOutbox::OP_DELETE)
            ->first();

        $this->assertNotNull($hardDeleteEntry);
        $this->assertSame($detailUuid, $hardDeleteEntry->payload['entity_uuid']);
        $this->assertSame($posSale->uuid, $hardDeleteEntry->payload['relationships']['sale_uuid'] ?? null);
    }

    public function test_transaction_atomicity_and_rollback_safety(): void
    {
        $merchant = Merchant::create(['name_en' => 'Tx Merchant', 'opening_balance' => 1000]);
        $item = Item::create([
            'name_en'       => 'Tx Item',
            'unit'          => 'Nag',
            'opening_stock' => 20,
            'current_stock' => 20,
        ]);

        // Verify AmrozaService::createSale preserves business logic AND creates outbox entries
        $amrozaService = app(AmrozaService::class);
        $sale = $amrozaService->createSale([
            'date'        => '2026-11-22',
            'merchant_id' => $merchant->id,
            'item_id'     => $item->id,
            'nag'         => 5,
            'weight'      => 0,
            'rate'        => 400,
            'bardana'     => 100,
        ]);

        $merchant->refresh();
        $item->refresh();

        $this->assertSame(2100.0, (float) $sale->gross_amount);
        $this->assertSame(3100.0, (float) $merchant->current_balance);
        $this->assertSame(15, (int) $item->current_stock);

        $this->assertTrue(
            SyncOutbox::where('entity_type', 'AmrozaSale')
                ->where('entity_uuid', $sale->uuid)
                ->where('operation', SyncOutbox::OP_CREATE)
                ->exists()
        );
        $this->assertTrue(
            SyncOutbox::where('entity_type', 'Merchant')
                ->where('entity_uuid', $merchant->uuid)
                ->where('operation', SyncOutbox::OP_UPDATE)
                ->exists()
        );

        // Verify transaction rollback removes both business record AND outbox entries
        $outboxCountBefore = SyncOutbox::count();
        $merchantCountBefore = Merchant::count();

        try {
            DB::transaction(function () {
                Merchant::create(['name_en' => 'Rolled Back Merchant']);
                throw new \RuntimeException('Simulated failure after local insert');
            });
        } catch (\RuntimeException $e) {
            // Expected rollback
        }

        $this->assertSame($merchantCountBefore, Merchant::count());
        $this->assertSame($outboxCountBefore, SyncOutbox::count());
    }

    public function test_queue_management_lifecycle_and_without_tracking(): void
    {
        $m1 = Merchant::create(['name_en' => 'Queue Merchant 1']);
        $m2 = Merchant::create(['name_en' => 'Queue Merchant 2']);

        $pending = $this->syncQueue->getPendingEvents(10);
        $this->assertGreaterThanOrEqual(2, $pending->count());

        $e1 = $pending->firstWhere('entity_uuid', $m1->uuid);
        $e2 = $pending->firstWhere('entity_uuid', $m2->uuid);
        $this->assertNotNull($e1);
        $this->assertNotNull($e2);

        // Mark processing & synced
        $this->assertTrue($this->syncQueue->markAsProcessing($e1));
        $this->assertSame(SyncOutbox::STATUS_PROCESSING, $e1->fresh()->status);

        $this->assertTrue($this->syncQueue->markAsSynced($e1));
        $e1Fresh = $e1->fresh();
        $this->assertSame(SyncOutbox::STATUS_SYNCED, $e1Fresh->status);
        $this->assertNotNull($e1Fresh->synced_at);

        // Mark failed, increment attempts, store error, and retry
        $this->assertTrue($this->syncQueue->markAsFailed($e2->uuid, 'Connection timed out'));
        $e2Fresh = $e2->fresh();
        $this->assertSame(SyncOutbox::STATUS_FAILED, $e2Fresh->status);
        $this->assertSame(1, $e2Fresh->attempts);
        $this->assertSame('Connection timed out', $e2Fresh->last_error);

        $this->assertTrue($this->syncQueue->incrementAttempts($e2->id, '502 Bad Gateway'));
        $this->assertSame(2, $e2->fresh()->attempts);
        $this->assertSame('502 Bad Gateway', $e2->fresh()->last_error);

        $this->assertTrue($this->syncQueue->storeLastError($e2->id, 'DNS lookup failed'));
        $this->assertSame('DNS lookup failed', $e2->fresh()->last_error);

        $failedEvents = $this->syncQueue->getFailedEvents();
        $this->assertTrue($failedEvents->contains('id', $e2->id));

        $retried = $this->syncQueue->retryFailed();
        $this->assertGreaterThanOrEqual(1, $retried);
        $this->assertSame(SyncOutbox::STATUS_PENDING, $e2->fresh()->status);

        $stats = $this->syncQueue->getQueueStats();
        $this->assertArrayHasKey('total', $stats);
        $this->assertArrayHasKey('pending', $stats);
        $this->assertArrayHasKey('processing', $stats);
        $this->assertArrayHasKey('synced', $stats);
        $this->assertArrayHasKey('failed', $stats);
        $this->assertSame(DeviceService::id(), $stats['device_id']);

        // Test withoutTracking suppression
        $countBefore = SyncOutbox::count();
        $suppressedMerchant = SyncQueueService::withoutTracking(function () {
            return Merchant::create(['name_en' => 'Suppressed Merchant']);
        });
        $this->assertNotEmpty($suppressedMerchant->uuid);
        $this->assertSame($countBefore, SyncOutbox::count());
        $this->assertTrue(SyncQueueService::isTrackingEnabled());
    }

    public function test_system_models_are_excluded_from_sync_outbox(): void
    {
        $countBefore = SyncOutbox::count();

        $user = User::create([
            'name'     => 'System User',
            'email'    => 'sysuser@example.com',
            'password' => bcrypt('secret123'),
        ]);
        $user->update(['name' => 'Updated System User']);

        Option::create([
            'meta_key'      => 'test_setting',
            'meta_value'    => 'enabled',
            'meta_category' => 'general',
        ]);

        $this->assertSame($countBefore, SyncOutbox::count());
    }
}
