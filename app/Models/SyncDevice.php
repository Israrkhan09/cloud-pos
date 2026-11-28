<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class SyncDevice extends Model
{
    use BelongsToBusiness;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_REVOKED = 'revoked';
    public const STATUS_SUSPENDED = 'suspended';

    protected $table = 'sync_devices';

    protected $fillable = [
        'business_id',
        'uuid',
        'device_id',
        'device_name',
        'api_token_hash',
        'hostname',
        'os',
        'app_version',
        'status',
        'last_seen_at',
        'last_synced_at',
        'metadata',
    ];

    protected $hidden = [
        'api_token_hash',
    ];

    protected $casts = [
        'last_seen_at'   => 'datetime',
        'last_synced_at' => 'datetime',
        'metadata'       => 'array',
    ];

    /**
     * Boot without HasSyncUuid so central device records never queue into local sync_outbox.
     */
    protected static function booted(): void
    {
        static::creating(function (SyncDevice $model) {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }

            if (empty($model->status)) {
                $model->status = self::STATUS_ACTIVE;
            }
        });
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function verifyToken(string $plainToken): bool
    {
        if (empty($this->api_token_hash) || empty($plainToken)) {
            return false;
        }

        return hash_equals($this->api_token_hash, hash('sha256', $plainToken));
    }

    public function events(): HasMany
    {
        return $this->hasMany(SyncEvent::class, 'device_id', 'device_id');
    }
}
