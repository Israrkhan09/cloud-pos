<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use App\Traits\HasSyncUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class MerchantReceipt extends Model
{
    use BelongsToBusiness, HasFactory, SoftDeletes, HasSyncUuid;

    protected $fillable = [
        'business_id',
        'uuid',
        'date',
        'merchant_id',
        'amount',
        'type', // 'same_day_cash' or 'recovery'
        'note',
        'year',
        'created_by',
    ];

    protected $casts = [
        'date' => 'date:Y-m-d',
        'amount' => 'decimal:2',
        'year' => 'integer',
    ];

    protected static function boot()
    {
        parent::boot();

        static::saving(function ($receipt) {
            if (empty($receipt->year)) {
                $receipt->year = config('jkc.default_year', 2026);
            }
        });
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
