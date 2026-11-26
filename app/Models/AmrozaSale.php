<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use App\Traits\HasSyncUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class AmrozaSale extends Model
{
    use BelongsToBusiness, HasFactory, SoftDeletes, HasSyncUuid;

    protected $fillable = [
        'business_id',
        'uuid',
        'date',
        'merchant_id',
        'item_id',
        'nag',
        'weight',
        'rate',
        'bardana',
        'gross_amount',
        'payment_type',
        'cash_received',
        'udhaar_amount',
        'consignment_id',
        'year',
        'created_by',
    ];

    protected $casts = [
        'date' => 'date:Y-m-d',
        'nag' => 'integer',
        'weight' => 'decimal:2',
        'rate' => 'decimal:2',
        'bardana' => 'decimal:2',
        'gross_amount' => 'decimal:2',
        'cash_received' => 'decimal:2',
        'udhaar_amount' => 'decimal:2',
        'year' => 'integer',
    ];

    protected static function boot()
    {
        parent::boot();

        static::saving(function ($sale) {
            if (empty($sale->payment_type)) {
                $sale->payment_type = 'udhaar';
            }
            $weight = floatval($sale->weight ?? 0);
            $nag = intval($sale->nag ?? 0);
            $rate = floatval($sale->rate ?? 0);
            $bardana = floatval($sale->bardana ?? 0);

            $sale->weight = $weight;
            $sale->bardana = $bardana;
            $sale->nag = $nag;
            $sale->rate = $rate;

            // Calculation rule from Section 11:
            // Line amount = Nag x Rate, or Weight x Rate when Weight > 0
            if ($weight > 0) {
                $lineAmount = $weight * $rate;
            } else {
                $lineAmount = $nag * $rate;
            }

            $sale->gross_amount = round($lineAmount + $bardana, 2);

            if ($sale->payment_type === 'split') {
                $cash = min(max(0, floatval($sale->cash_received ?? 0)), $sale->gross_amount);
                $sale->cash_received = round($cash, 2);
                $sale->udhaar_amount = round($sale->gross_amount - $sale->cash_received, 2);
            } elseif ($sale->payment_type === 'naqdi') {
                $sale->cash_received = $sale->gross_amount;
                $sale->udhaar_amount = 0;
            } elseif ($sale->payment_type === 'bank') {
                $sale->cash_received = 0;
                $sale->udhaar_amount = 0;
            } else {
                $sale->payment_type = 'udhaar';
                $sale->cash_received = 0;
                $sale->udhaar_amount = $sale->gross_amount;
            }

            if (empty($sale->year)) {
                $sale->year = config('jkc.default_year', 2026);
            }
        });
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
