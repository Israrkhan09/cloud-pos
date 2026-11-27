<?php

namespace App\Services;

use App\Models\SyncDevice;
use App\Models\SyncEvent;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class CentralEventProcessor
{
    /**
     * Map of synchronizable entity_type strings to their Eloquent model classes.
     */
    protected array $modelMap = [
        'Area'                  => \App\Models\Area::class,
        'Merchant'              => \App\Models\Merchant::class,
        'Farmer'                => \App\Models\Farmer::class,
        'FarmerMark'            => \App\Models\FarmerMark::class,
        'Item'                  => \App\Models\Item::class,
        'AmrozaSale'            => \App\Models\AmrozaSale::class,
        'MerchantReceipt'       => \App\Models\MerchantReceipt::class,
        'FarmerBill'            => \App\Models\FarmerBill::class,
        'InvestmentPartner'     => \App\Models\InvestmentPartner::class,
        'InvestmentLoan'        => \App\Models\InvestmentLoan::class,
        'InvestmentSurplus'     => \App\Models\InvestmentSurplus::class,
        'InvestmentTransaction' => \App\Models\InvestmentTransaction::class,
        'InvestmentAuditLog'    => \App\Models\InvestmentAuditLog::class,
        'InvestmentAlert'       => \App\Models\InvestmentAlert::class,
        'Expense'               => \App\Models\Expense::class,
        'Customer'              => \App\Models\Customer::class,
        'Employee'              => \App\Models\Employee::class,
        'Supplier'              => \App\Models\Supplier::class,
        'Category'              => \App\Models\Category::class,
        'Brand'                 => \App\Models\Brand::class,
        'Attribute'             => \App\Models\Attribute::class,
        'Product'               => \App\Models\Product::class,
        'Purchase'              => \App\Models\Purchase::class,
        'PurchaseDetail'        => \App\Models\PurchaseDetail::class,
        'PurchasePayment'       => \App\Models\PurchasePayment::class,
        'Sale'                  => \App\Models\Sale::class,
        'SaleDetail'            => \App\Models\SaleDetail::class,
        'SalePayment'           => \App\Models\SalePayment::class,
        'Currency'              => \App\Models\Currency::class,
        'PurchaseReturn'        => \App\Models\PurchaseReturn::class,
        'PurchseReturnDetail'   => \App\Models\PurchseReturnDetail::class,
        'SaleReturn'            => \App\Models\SaleReturn::class,
        'SaleReturnDetail'      => \App\Models\SaleReturnDetail::class,
    ];

    /**
     * Dependency tier weights for ordering incoming events.
     * Lower tier weight = processed first.
     */
    protected array $tierWeights = [
        // Tier 1: Independent master lookups
        'Area'                  => 10,
        'Item'                  => 10,
        'InvestmentPartner'     => 10,
        'InvestmentLoan'        => 10,
        'InvestmentSurplus'     => 10,
        'Customer'              => 10,
        'Supplier'              => 10,
        'Category'              => 10,
        'Brand'                 => 10,
        'Attribute'             => 10,
        'Employee'              => 10,
        'Currency'              => 10,
        'Expense'               => 10,

        // Tier 2: Primary parties
        'Farmer'                => 20,
        'Merchant'              => 20,

        // Tier 3: Secondary dependencies
        'FarmerMark'            => 30,
        'Product'               => 30,

        // Tier 4: Transaction headers
        'AmrozaSale'            => 40,
        'MerchantReceipt'       => 40,
        'FarmerBill'            => 40,
        'InvestmentTransaction' => 40,
        'Sale'                  => 40,
        'Purchase'              => 40,
        'SaleReturn'            => 40,
        'PurchaseReturn'        => 40,

        // Tier 5: Transaction details & logs
        'SaleDetail'            => 50,
        'SalePayment'           => 50,
        'PurchaseDetail'        => 50,
        'PurchasePayment'       => 50,
        'SaleReturnDetail'      => 50,
        'PurchseReturnDetail'   => 50,
        'InvestmentAuditLog'    => 50,
        'InvestmentAlert'       => 50,
    ];

    /**
     * Map of foreign keys to their central lookup table and relationship UUID key.
     */
    protected array $foreignKeyMap = [
        'area_id'            => ['table' => 'areas',                   'key' => 'area_uuid',            'required' => false],
        'farmer_id'          => ['table' => 'farmers',                 'key' => 'farmer_uuid',          'required' => true],
        'farmer_mark_id'     => ['table' => 'farmer_marks',            'key' => 'farmer_mark_uuid',     'required' => false],
        'merchant_id'        => ['table' => 'merchants',               'key' => 'merchant_uuid',        'required' => true],
        'item_id'            => ['table' => 'items',                   'key' => 'item_uuid',            'required' => true],
        'partner_id'         => ['table' => 'investment_partners',     'key' => 'partner_uuid',         'required' => false],
        'loan_id'            => ['table' => 'investment_loans',        'key' => 'loan_uuid',            'required' => false],
        'surplus_id'         => ['table' => 'investment_surplus',      'key' => 'surplus_uuid',         'required' => false],
        'transaction_id'     => ['table' => 'investment_transactions', 'key' => 'transaction_uuid',     'required' => false],
        'customer_id'        => ['table' => 'customers',               'key' => 'customer_uuid',        'required' => false],
        'supplier_id'        => ['table' => 'suppliers',               'key' => 'supplier_uuid',        'required' => false],
        'brand_id'           => ['table' => 'brands',                  'key' => 'brand_uuid',           'required' => false],
        'product_id'         => ['table' => 'products',                'key' => 'product_uuid',         'required' => true],
        'purchase_id'        => ['table' => 'purchases',               'key' => 'purchase_uuid',        'required' => true],
        'purchase_detail_id' => ['table' => 'purchase_details',        'key' => 'purchase_detail_uuid', 'required' => false],
        'sale_id'            => ['table' => 'sales',                   'key' => 'sale_uuid',            'required' => true],
        'employee_id'        => ['table' => 'employees',               'key' => 'employee_uuid',        'required' => false],
        'parent_id'          => ['table' => 'categories',              'key' => 'parent_uuid',          'required' => false],
    ];

    /**
     * Process an ordered batch of sync events into central database business tables.
     * Accepts either Eloquent SyncEvent instances or raw deserialized sync event dictionaries.
     *
     * @param array<SyncEvent|array>|Collection<int, SyncEvent> $events
     * @return array{total: int, processed: int, failed: int, skipped: int, errors: array}
     */
    public function processBatch(array|Collection $events): array
    {
        $ordered = $this->sortEventsByDependency($events);

        $processedCount = 0;
        $failedCount = 0;
        $skippedCount = 0;
        $errors = [];

        foreach ($ordered as $event) {
            $result = $this->processEvent($event);

            $eventUuid = $event instanceof SyncEvent ? $event->event_uuid : ($event['event_uuid'] ?? 'unknown');
            $entityType = $event instanceof SyncEvent ? $event->entity_type : ($event['entity_type'] ?? 'unknown');
            $entityUuid = $event instanceof SyncEvent ? $event->entity_uuid : ($event['entity_uuid'] ?? 'unknown');

            if ($result['success']) {
                if (($result['action'] ?? '') === 'already_processed') {
                    $skippedCount++;
                } else {
                    $processedCount++;
                }
            } else {
                $failedCount++;
                $errors[] = [
                    'event_uuid'  => $eventUuid,
                    'entity_type' => $entityType,
                    'entity_uuid' => $entityUuid,
                    'error'       => $result['error'] ?? 'Unknown processing error',
                ];
            }
        }

        return [
            'total'     => count($ordered),
            'processed' => $processedCount,
            'failed'    => $failedCount,
            'skipped'   => $skippedCount,
            'errors'    => $errors,
        ];
    }

    /**
     * Process all unprocessed (received or failed) events for a given device.
     */
    public function processEventsForDevice(SyncDevice|string $device, int $limit = 100): array
    {
        $deviceId = $device instanceof SyncDevice ? $device->device_id : (string) $device;

        $events = SyncEvent::where('device_id', $deviceId)
            ->whereIn('status', [SyncEvent::STATUS_RECEIVED, SyncEvent::STATUS_FAILED])
            ->orderBy('id', 'asc')
            ->limit($limit)
            ->get();

        if ($events->isEmpty()) {
            return [
                'total'     => 0,
                'processed' => 0,
                'failed'    => 0,
                'skipped'   => 0,
                'errors'    => [],
            ];
        }

        return $this->processBatch($events);
    }

    /**
     * Process pending/received events across all devices.
     */
    public function processPendingEvents(int $limit = 100): array
    {
        $events = SyncEvent::whereIn('status', [SyncEvent::STATUS_RECEIVED, SyncEvent::STATUS_FAILED])
            ->orderBy('id', 'asc')
            ->limit($limit)
            ->get();

        if ($events->isEmpty()) {
            return [
                'total'     => 0,
                'processed' => 0,
                'failed'    => 0,
                'skipped'   => 0,
                'errors'    => [],
            ];
        }

        return $this->processBatch($events);
    }

    /**
     * Materialize a single SyncEvent (or event array) into business tables.
     * Execution runs with change tracking disabled to prevent outbox recursion.
     */
    public function processEvent(SyncEvent|array $event): array
    {
        $isModel = $event instanceof SyncEvent;

        if ($isModel && $event->status === SyncEvent::STATUS_PROCESSED) {
            return ['success' => true, 'action' => 'already_processed'];
        }

        $eventUuid = $isModel ? $event->event_uuid : ($event['event_uuid'] ?? 'unknown');
        $entityType = $isModel ? $event->entity_type : ($event['entity_type'] ?? '');
        $entityUuid = $isModel ? $event->entity_uuid : ($event['entity_uuid'] ?? '');
        $operation = $isModel ? $event->operation : ($event['operation'] ?? '');
        $payload = $isModel ? ($event->payload ?? []) : ($event['payload'] ?? []);

        return SyncQueueService::withoutTracking(function () use ($event, $isModel, $eventUuid, $entityType, $entityUuid, $operation, $payload) {
            try {
                return DB::transaction(function () use ($event, $isModel, $entityType, $entityUuid, $operation, $payload) {
                    $modelClass = $this->modelMap[$entityType] ?? null;
                    if (!$modelClass || !class_exists($modelClass)) {
                        throw new \InvalidArgumentException("Unsupported or unknown entity type: {$entityType}");
                    }

                    $actionResult = match ($operation) {
                        SyncEvent::OP_CREATE => $this->handleUpsert($modelClass, $entityType, $entityUuid, $payload),
                        SyncEvent::OP_UPDATE => $this->handleUpsert($modelClass, $entityType, $entityUuid, $payload),
                        SyncEvent::OP_DELETE => $this->handleDelete($modelClass, $entityUuid),
                        default              => throw new \InvalidArgumentException("Unsupported sync operation: {$operation}"),
                    };

                    if ($isModel) {
                        $event->update([
                            'status'        => SyncEvent::STATUS_PROCESSED,
                            'processed_at'  => now(),
                            'error_message' => null,
                        ]);
                    }

                    return [
                        'success' => true,
                        'action'  => $actionResult['action'],
                        'id'      => $actionResult['id'] ?? null,
                    ];
                });
            } catch (\Throwable $e) {
                Log::warning("CentralEventProcessor failed for event [{$eventUuid}]: {$e->getMessage()}", [
                    'entity_type' => $entityType,
                    'entity_uuid' => $entityUuid,
                    'operation'   => $operation,
                    'trace'       => $e->getTraceAsString(),
                ]);

                if ($isModel) {
                    try {
                        $event->update([
                            'status'        => SyncEvent::STATUS_FAILED,
                            'error_message' => $e->getMessage(),
                        ]);
                    } catch (\Throwable $sub) {
                        // Safe ignore
                    }
                }

                return [
                    'success' => false,
                    'error'   => $e->getMessage(),
                ];
            }
        });
    }

    /**
     * Handle create/update idempotent upsert into central domain table.
     */
    protected function handleUpsert(string $modelClass, string $entityType, string $entityUuid, array $payload): array
    {
        $attributes = $payload['attributes'] ?? [];
        $relationships = $payload['relationships'] ?? [];

        // Ensure business_id is assigned
        if (empty($attributes['business_id'])) {
            $attributes['business_id'] = $payload['business_id'] ?? app(\App\Services\TenantContext::class)->getBusinessId();
        }

        // 1. Strip local numeric ID and enforce globally unique UUID
        unset($attributes['id']);
        $attributes['uuid'] = $entityUuid;

        // 2. Resolve relationships to central numeric foreign keys
        $attributes = $this->resolveForeignKeys($entityType, $attributes, $relationships);

        // 3. Check if record already exists by UUID (Primary identity), including soft-deleted
        $existing = $this->newModelQuery($modelClass, true)->where('uuid', $entityUuid)->first();

        if ($existing) {
            // Strict tenant ownership validation: prevent cross-tenant UUID collision / hijacking
            if (!empty($existing->business_id) && !empty($attributes['business_id']) && (string) $existing->business_id !== (string) $attributes['business_id']) {
                throw new \RuntimeException(
                    "Cross-tenant violation: {$entityType} with UUID '{$entityUuid}' belongs to business '{$existing->business_id}' and cannot be modified by '{$attributes['business_id']}'."
                );
            }

            if ($this->usesSoftDeletes($modelClass) && $existing->trashed()) {
                $existing->restore();
            }
            $existing->fill($attributes);
            $existing->save();

            return [
                'action' => 'updated',
                'id'     => $existing->getKey(),
            ];
        }

        // 4. Handle entity-specific uniqueness rules before creating
        $attributes = $this->handleSpecialEntityRules($modelClass, $entityType, $entityUuid, $attributes);

        // In case special handling resolved to an existing record that adopted this UUID
        $recheck = $this->newModelQuery($modelClass, true)->where('uuid', $entityUuid)->first();
        if ($recheck) {
            return [
                'action' => 'updated_existing',
                'id'     => $recheck->getKey(),
            ];
        }

        // 5. Create new central domain record
        /** @var Model $newRecord */
        $newRecord = new $modelClass();
        $newRecord->fill($attributes);
        $newRecord->save();

        return [
            'action' => 'created',
            'id'     => $newRecord->getKey(),
        ];
    }

    /**
     * Handle deletion of central domain record by UUID.
     */
    protected function handleDelete(string $modelClass, string $entityUuid): array
    {
        /** @var Model|null $record */
        $record = $this->newModelQuery($modelClass, false)->where('uuid', $entityUuid)->first();

        if ($record) {
            $record->delete();
            return ['action' => 'deleted', 'id' => $record->getKey()];
        }

        return ['action' => 'delete_skipped_not_found', 'id' => null];
    }

    /**
     * Check if a model class uses Eloquent SoftDeletes trait.
     */
    protected function usesSoftDeletes(string $modelClass): bool
    {
        return in_array(\Illuminate\Database\Eloquent\SoftDeletes::class, class_uses_recursive($modelClass), true);
    }

    /**
     * Build an Eloquent builder instance, optionally including soft-deleted rows.
     */
    protected function newModelQuery(string $modelClass, bool $withTrashed = true): \Illuminate\Database\Eloquent\Builder
    {
        $query = $modelClass::withoutGlobalScopes();

        if ($withTrashed && $this->usesSoftDeletes($modelClass)) {
            return $query->withTrashed();
        }

        return $query;
    }

    /**
     * Resolve foreign key UUID relationships to central numeric primary keys.
     */
    protected function resolveForeignKeys(string $entityType, array $attributes, array $relationships): array
    {
        foreach ($this->foreignKeyMap as $fkColumn => $info) {
            $uuidKey = $info['key'];
            $targetTable = $info['table'];
            $isRequired = $info['required'];

            if (!empty($relationships[$uuidKey])) {
                $parentUuid = $relationships[$uuidKey];
                $parentQuery = DB::table($targetTable)->where('uuid', $parentUuid);
                if (Schema::hasColumn($targetTable, 'business_id') && !empty($attributes['business_id'])) {
                    $parentQuery->where('business_id', $attributes['business_id']);
                }
                $centralId = $parentQuery->value('id');

                if (!empty($centralId)) {
                    $attributes[$fkColumn] = $centralId;
                } else {
                    // Parent record not yet synchronized or belongs to different tenant
                    throw new \RuntimeException(
                        "Unresolved foreign key dependency: {$targetTable} with UUID '{$parentUuid}' " .
                        "was not found on central database for {$entityType} under business '{$attributes['business_id']}'."
                    );
                }
            } elseif (array_key_exists($fkColumn, $attributes)) {
                // If the client sent a local numeric foreign key without relationship mapping,
                // do NOT trust the local ID on the central database.
                if ($isRequired && empty($attributes[$fkColumn])) {
                    throw new \RuntimeException(
                        "Required foreign key {$fkColumn} for {$entityType} has no mapped UUID relationship."
                    );
                }
            }
        }

        return $attributes;
    }

    /**
     * Handle unique constraints and default records for specific entity types.
     */
    protected function handleSpecialEntityRules(
        string $modelClass,
        string $entityType,
        string $entityUuid,
        array $attributes
    ): array {
        switch ($entityType) {
            case 'FarmerMark':
                // Composite unique constraint: (farmer_id, code)
                $farmerId = $attributes['farmer_id'] ?? null;
                $code = $attributes['code'] ?? null;

                if ($farmerId !== null && $code !== null) {
                    $existingMark = \App\Models\FarmerMark::where('farmer_id', $farmerId)
                        ->where('code', $code)
                        ->first();

                    if ($existingMark) {
                        // Adopt the UUID from the client directly in database
                        DB::table('farmer_marks')->where('id', $existingMark->id)->update(['uuid' => $entityUuid]);
                        $existingMark->refresh();
                        $existingMark->fill($attributes);
                        $existingMark->save();
                        return $attributes;
                    }
                }
                break;

            case 'Merchant':
                // Protected Naqdi merchant (code 1)
                if (isset($attributes['code']) && (int) $attributes['code'] === 1) {
                    $naqdi = \App\Models\Merchant::where('code', 1)->first();
                    if ($naqdi) {
                        DB::table('merchants')->where('id', $naqdi->id)->update(['uuid' => $entityUuid]);
                        $naqdi->refresh();
                        $naqdi->fill($attributes);
                        $naqdi->save();
                        return $attributes;
                    }
                }

                // If code is already taken on central by a different merchant
                if (isset($attributes['code'])) {
                    $codeTaken = \App\Models\Merchant::where('code', $attributes['code'])->exists();
                    if ($codeTaken) {
                        $attributes['code'] = ((int) \App\Models\Merchant::max('code')) + 1;
                    }
                }
                break;

            case 'Farmer':
                // If code is already taken on central by a different farmer
                if (isset($attributes['code'])) {
                    $codeTaken = \App\Models\Farmer::where('code', $attributes['code'])->exists();
                    if ($codeTaken) {
                        $attributes['code'] = ((int) \App\Models\Farmer::max('code')) + 1;
                    }
                }
                break;

            case 'InvestmentTransaction':
                // Check if ref_no collides
                if (isset($attributes['ref_no'])) {
                    $existingRef = \App\Models\InvestmentTransaction::where('ref_no', $attributes['ref_no'])->first();
                    if ($existingRef && $existingRef->uuid !== $entityUuid) {
                        $attributes['ref_no'] = $attributes['ref_no'] . '-D' . rand(10, 99);
                    }
                }
                break;
        }

        return $attributes;
    }

    /**
     * Sort events by dependency tier weight (Tier 1 first, Tier 5 last).
     *
     * @param array<SyncEvent|array>|Collection<int, SyncEvent> $events
     * @return array<SyncEvent|array>
     */
    protected function sortEventsByDependency(array|Collection $events): array
    {
        $list = $events instanceof Collection ? $events->all() : array_values($events);

        usort($list, function ($a, $b) {
            $typeA = $a instanceof SyncEvent ? $a->entity_type : ($a['entity_type'] ?? '');
            $typeB = $b instanceof SyncEvent ? $b->entity_type : ($b['entity_type'] ?? '');
            $opA = $a instanceof SyncEvent ? $a->operation : ($a['operation'] ?? '');
            $opB = $b instanceof SyncEvent ? $b->operation : ($b['operation'] ?? '');
            $idA = $a instanceof SyncEvent ? ($a->id ?? 0) : ($a['cursor'] ?? $a['id'] ?? 0);
            $idB = $b instanceof SyncEvent ? ($b->id ?? 0) : ($b['cursor'] ?? $b['id'] ?? 0);

            $weightA = $this->tierWeights[$typeA] ?? 99;
            $weightB = $this->tierWeights[$typeB] ?? 99;

            // Delete operations should be processed after create/update or reverse tier
            if ($opA === SyncEvent::OP_DELETE && $opB !== SyncEvent::OP_DELETE) {
                return 1;
            }
            if ($opA !== SyncEvent::OP_DELETE && $opB === SyncEvent::OP_DELETE) {
                return -1;
            }

            if ($weightA !== $weightB) {
                return $weightA <=> $weightB;
            }

            return $idA <=> $idB;
        });

        return $list;
    }
}
