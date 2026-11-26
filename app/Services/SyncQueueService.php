<?php

namespace App\Services;

use App\Models\SyncOutbox;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SyncQueueService
{
    /**
     * Global toggle to suppress queue tracking during downstream sync pulls or imports.
     */
    protected static bool $trackingEnabled = true;

    /**
     * Sensitive or non-synchronizable attributes excluded from queue payloads.
     */
    protected array $excludedAttributes = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    /**
     * Map of local numeric foreign keys to their parent tables and UUID relationship keys.
     */
    protected array $foreignKeyMap = [
        'area_id'            => ['table' => 'areas',                   'key' => 'area_uuid'],
        'farmer_id'          => ['table' => 'farmers',                 'key' => 'farmer_uuid'],
        'farmer_mark_id'     => ['table' => 'farmer_marks',            'key' => 'farmer_mark_uuid'],
        'merchant_id'        => ['table' => 'merchants',               'key' => 'merchant_uuid'],
        'item_id'            => ['table' => 'items',                   'key' => 'item_uuid'],
        'partner_id'         => ['table' => 'investment_partners',     'key' => 'partner_uuid'],
        'loan_id'            => ['table' => 'investment_loans',        'key' => 'loan_uuid'],
        'surplus_id'         => ['table' => 'investment_surplus',      'key' => 'surplus_uuid'],
        'transaction_id'     => ['table' => 'investment_transactions', 'key' => 'transaction_uuid'],
        'customer_id'        => ['table' => 'customers',               'key' => 'customer_uuid'],
        'supplier_id'        => ['table' => 'suppliers',               'key' => 'supplier_uuid'],
        'brand_id'           => ['table' => 'brands',                  'key' => 'brand_uuid'],
        'product_id'         => ['table' => 'products',                'key' => 'product_uuid'],
        'purchase_id'        => ['table' => 'purchases',               'key' => 'purchase_uuid'],
        'purchase_detail_id' => ['table' => 'purchase_details',        'key' => 'purchase_detail_uuid'],
        'sale_id'            => ['table' => 'sales',                   'key' => 'sale_uuid'],
        'employee_id'        => ['table' => 'employees',               'key' => 'employee_uuid'],
    ];

    public static function isTrackingEnabled(): bool
    {
        return static::$trackingEnabled;
    }

    public static function enableTracking(): void
    {
        static::$trackingEnabled = true;
    }

    public static function disableTracking(): void
    {
        static::$trackingEnabled = false;
    }

    /**
     * Execute a callback without recording changes in sync_outbox.
     */
    public static function withoutTracking(callable $callback): mixed
    {
        $previous = static::$trackingEnabled;
        static::$trackingEnabled = false;

        try {
            return $callback();
        } finally {
            static::$trackingEnabled = $previous;
        }
    }

    /**
     * Record a model lifecycle mutation into sync_outbox.
     */
    public function recordChange(Model $model, string $operation): ?SyncOutbox
    {
        if (!static::isTrackingEnabled() || $model instanceof SyncOutbox) {
            return null;
        }

        try {
            if ($operation === SyncOutbox::OP_UPDATE) {
                $changes = Arr::except($model->getChanges(), ['updated_at']);
                if (empty($changes)) {
                    return null;
                }
            }

            $entityUuid = $model->getAttribute('uuid') ?: $model->getOriginal('uuid');
            if (empty($entityUuid) && $model->getKey()) {
                $entityUuid = DB::table($model->getTable())
                    ->where($model->getKeyName(), $model->getKey())
                    ->value('uuid');
            }

            if (empty($entityUuid)) {
                return null;
            }

            $deviceId = DeviceService::id();
            $payload = $this->buildPayload($model, (string) $entityUuid, $operation, $deviceId);

            return $this->addEvent(
                class_basename($model),
                (string) $entityUuid,
                $operation,
                $payload,
                $deviceId
            );
        } catch (\Throwable $e) {
            Log::error('SyncQueueService::recordChange failed: ' . $e->getMessage(), [
                'entity'    => get_class($model),
                'operation' => $operation,
            ]);
            return null;
        }
    }

    /**
     * Add an event directly to the sync_outbox queue.
     */
    public function addEvent(
        string $entityType,
        string $entityUuid,
        string $operation,
        array $payload,
        ?string $deviceId = null
    ): SyncOutbox {
        $bizId = $payload['attributes']['business_id'] ?? app(\App\Services\TenantContext::class)->getBusinessId();

        return SyncOutbox::create([
            'uuid'        => (string) Str::uuid(),
            'business_id' => $bizId,
            'device_id'   => $deviceId ?: DeviceService::id(),
            'entity_type' => $entityType,
            'entity_uuid' => $entityUuid,
            'operation'   => $operation,
            'payload'     => $payload,
            'status'      => SyncOutbox::STATUS_PENDING,
            'attempts'    => 0,
        ]);
    }

    /**
     * Retrieve pending outbox events in FIFO order.
     */
    public function getPendingEvents(int $limit = 100): Collection
    {
        if (!\Illuminate\Support\Facades\Schema::hasTable('sync_outbox')) {
            return new Collection();
        }

        return SyncOutbox::pending()
            ->orderBy('id', 'asc')
            ->limit($limit)
            ->get();
    }

    /**
     * Retrieve failed outbox events in FIFO order.
     */
    public function getFailedEvents(int $limit = 100): Collection
    {
        if (!\Illuminate\Support\Facades\Schema::hasTable('sync_outbox')) {
            return new Collection();
        }

        return SyncOutbox::failed()
            ->orderBy('id', 'asc')
            ->limit($limit)
            ->get();
    }

    /**
     * Mark an outbox event as currently processing.
     */
    public function markAsProcessing(int|string|SyncOutbox $event): bool
    {
        $record = $this->resolveEvent($event);
        if (!$record) {
            return false;
        }

        return $record->update([
            'status' => SyncOutbox::STATUS_PROCESSING,
        ]);
    }

    /**
     * Mark an outbox event as successfully synchronized.
     */
    public function markAsSynced(int|string|SyncOutbox $event): bool
    {
        $record = $this->resolveEvent($event);
        if (!$record) {
            return false;
        }

        return $record->update([
            'status'    => SyncOutbox::STATUS_SYNCED,
            'synced_at' => now(),
        ]);
    }

    /**
     * Mark an outbox event as failed with an error message.
     */
    public function markAsFailed(int|string|SyncOutbox $event, string $errorMessage): bool
    {
        $record = $this->resolveEvent($event);
        if (!$record) {
            return false;
        }

        return $record->update([
            'status'     => SyncOutbox::STATUS_FAILED,
            'attempts'   => $record->attempts + 1,
            'last_error' => $errorMessage,
        ]);
    }

    /**
     * Increment retry attempts for an outbox event and optionally update last_error.
     */
    public function incrementAttempts(int|string|SyncOutbox $event, ?string $errorMessage = null): bool
    {
        $record = $this->resolveEvent($event);
        if (!$record) {
            return false;
        }

        $updates = [
            'attempts' => $record->attempts + 1,
        ];

        if ($errorMessage !== null) {
            $updates['last_error'] = $errorMessage;
        }

        return $record->update($updates);
    }

    /**
     * Store the last error message for an outbox event.
     */
    public function storeLastError(int|string|SyncOutbox $event, string $errorMessage): bool
    {
        $record = $this->resolveEvent($event);
        if (!$record) {
            return false;
        }

        return $record->update([
            'last_error' => $errorMessage,
        ]);
    }

    /**
     * Re-queue failed events back to pending status for retry.
     */
    public function retryFailed(?int $limit = null): int
    {
        if (!\Illuminate\Support\Facades\Schema::hasTable('sync_outbox')) {
            return 0;
        }

        $query = SyncOutbox::failed()->orderBy('id', 'asc');
        if ($limit !== null) {
            $query->limit($limit);
        }

        $ids = $query->pluck('id');
        if ($ids->isEmpty()) {
            return 0;
        }

        return SyncOutbox::whereIn('id', $ids)->update([
            'status' => SyncOutbox::STATUS_PENDING,
        ]);
    }

    /**
     * Return aggregate queue statistics.
     */
    public function getQueueStats(): array
    {
        if (!\Illuminate\Support\Facades\Schema::hasTable('sync_outbox')) {
            return [
                'total'      => 0,
                'pending'    => 0,
                'processing' => 0,
                'synced'     => 0,
                'failed'     => 0,
                'device_id'  => DeviceService::id(),
            ];
        }

        return [
            'total'      => SyncOutbox::count(),
            'pending'    => SyncOutbox::pending()->count(),
            'processing' => SyncOutbox::processing()->count(),
            'synced'     => SyncOutbox::synced()->count(),
            'failed'     => SyncOutbox::failed()->count(),
            'device_id'  => DeviceService::id(),
        ];
    }

    /**
     * Build a future-proof sync payload containing attributes and relationship UUIDs.
     */
    protected function buildPayload(Model $model, string $entityUuid, string $operation, string $deviceId): array
    {
        $attributes = Arr::except($model->getAttributes(), $this->excludedAttributes);
        $relationships = $this->resolveRelationshipUuids($model, $attributes);

        $changedFields = [];
        if ($operation === SyncOutbox::OP_UPDATE) {
            $changedFields = array_values(array_diff(array_keys($model->getChanges()), ['updated_at']));
        }

        return [
            'entity_type'    => class_basename($model),
            'entity_class'   => get_class($model),
            'table'          => $model->getTable(),
            'entity_uuid'    => $entityUuid,
            'local_id'       => $model->getKey(),
            'operation'      => $operation,
            'device_id'      => $deviceId,
            'timestamp'      => now()->toIso8601String(),
            'attributes'     => $attributes,
            'changed_fields' => $changedFields,
            'relationships'  => $relationships,
        ];
    }

    /**
     * Resolve parent relationship UUIDs for any foreign keys present on the model.
     */
    protected function resolveRelationshipUuids(Model $model, array $attributes): array
    {
        $relationships = [];

        foreach ($this->foreignKeyMap as $fkColumn => $mapping) {
            if (!empty($attributes[$fkColumn])) {
                $parentUuid = DB::table($mapping['table'])
                    ->where('id', $attributes[$fkColumn])
                    ->value('uuid');

                if (!empty($parentUuid)) {
                    $relationships[$mapping['key']] = (string) $parentUuid;
                }
            }
        }

        if ($model->getTable() === 'categories' && !empty($attributes['parent_id'])) {
            $parentUuid = DB::table('categories')
                ->where('id', $attributes['parent_id'])
                ->value('uuid');

            if (!empty($parentUuid)) {
                $relationships['parent_uuid'] = (string) $parentUuid;
            }
        }

        return $relationships;
    }

    /**
     * Resolve a SyncOutbox record from an instance, numeric ID, or UUID string.
     */
    protected function resolveEvent(int|string|SyncOutbox $event): ?SyncOutbox
    {
        if ($event instanceof SyncOutbox) {
            return $event;
        }

        if (is_int($event) || ctype_digit((string) $event)) {
            return SyncOutbox::find((int) $event);
        }

        return SyncOutbox::where('uuid', (string) $event)->first();
    }
}
