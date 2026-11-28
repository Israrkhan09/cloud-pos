<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SyncEvent extends Model
{
    use BelongsToBusiness;

    public const STATUS_RECEIVED = 'received';
    public const STATUS_PROCESSED = 'processed';
    public const STATUS_FAILED = 'failed';
    public const STATUS_REJECTED = 'rejected';

    public const OP_CREATE = 'create';
    public const OP_UPDATE = 'update';
    public const OP_DELETE = 'delete';

    protected $table = 'sync_events';

    protected $fillable = [
        'business_id',
        'event_uuid',
        'device_id',
        'entity_type',
        'entity_uuid',
        'operation',
        'payload',
        'status',
        'error_message',
        'event_timestamp',
        'received_at',
        'processed_at',
    ];

    protected $casts = [
        'payload'         => 'array',
        'event_timestamp' => 'datetime',
        'received_at'     => 'datetime',
        'processed_at'    => 'datetime',
    ];

    public function device(): BelongsTo
    {
        return $this->belongsTo(SyncDevice::class, 'device_id', 'device_id');
    }
}
