<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class SyncOutbox extends Model
{
    use \App\Traits\BelongsToBusiness;

    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_SYNCED = 'synced';
    public const STATUS_FAILED = 'failed';

    public const OP_CREATE = 'create';
    public const OP_UPDATE = 'update';
    public const OP_DELETE = 'delete';

    protected $table = 'sync_outbox';

    protected $fillable = [
        'business_id',
        'uuid',
        'device_id',
        'entity_type',
        'entity_uuid',
        'operation',
        'payload',
        'status',
        'attempts',
        'last_error',
        'synced_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'attempts' => 'integer',
        'synced_at' => 'datetime',
    ];

    /**
     * Boot model events without HasSyncUuid to prevent recursive queue tracking.
     */
    protected static function booted(): void
    {
        static::creating(function (SyncOutbox $model) {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }

            if (empty($model->device_id)) {
                $model->device_id = \App\Services\DeviceService::id();
            }

            if (empty($model->status)) {
                $model->status = self::STATUS_PENDING;
            }
        });
    }

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    public function scopeProcessing(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PROCESSING);
    }

    public function scopeSynced(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_SYNCED);
    }

    public function scopeFailed(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_FAILED);
    }
}
