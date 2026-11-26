<?php

namespace App\Traits;

use App\Models\SyncOutbox;
use App\Services\SyncQueueService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

trait HasSyncUuid
{
    /**
     * Boot the trait and register Eloquent model event listeners.
     */
    public static function bootHasSyncUuid(): void
    {
        static::creating(function ($model) {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });

        static::updating(function ($model) {
            // Guarantee that UUIDs remain strictly immutable for the lifetime of a record
            if ($model->isDirty('uuid') && !empty($model->getOriginal('uuid'))) {
                $model->uuid = $model->getOriginal('uuid');
            }
        });

        static::created(function ($model) {
            app(SyncQueueService::class)->recordChange($model, SyncOutbox::OP_CREATE);
        });

        static::updated(function ($model) {
            app(SyncQueueService::class)->recordChange($model, SyncOutbox::OP_UPDATE);
        });

        static::deleted(function ($model) {
            app(SyncQueueService::class)->recordChange($model, SyncOutbox::OP_DELETE);
        });
    }

    /**
     * Scope a query to only include records matching the given UUID.
     */
    public function scopeWhereUuid(Builder $query, string $uuid): Builder
    {
        return $query->where('uuid', $uuid);
    }

    /**
     * Find a record by its UUID.
     */
    public static function findByUuid(string $uuid): ?static
    {
        return static::where('uuid', $uuid)->first();
    }

    /**
     * Find a record by its UUID or throw a ModelNotFoundException.
     */
    public static function findByUuidOrFail(string $uuid): static
    {
        return static::where('uuid', $uuid)->firstOrFail();
    }

    /**
     * Get the record's UUID string.
     */
    public function getUuid(): string
    {
        return (string) $this->uuid;
    }
}
