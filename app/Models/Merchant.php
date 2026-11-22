<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Merchant extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'code',
        'name_en',
        'name_ur',
        'phone',
        'opening_balance',
        'current_balance',
        'status',
        'created_by',
    ];

    protected $appends = ['name'];

    protected $casts = [
        'code' => 'integer',
        'opening_balance' => 'float',
        'current_balance' => 'float',
    ];

    public function sales(): HasMany
    {
        return $this->hasMany(AmrozaSale::class);
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(MerchantReceipt::class);
    }

    /**
     * Sabiqa (previous balance before a given date)
     * Calculation: Opening + Udhaar Sales before date - Receipts before date
     * Cash and Bank sales do not affect merchant balance / dukaan baqaya.
     */
    public function getSabiqaBalance(string $date): float
    {
        $priorSales = $this->sales()
            ->where('date', '<', $date)
            ->where(function ($q) {
                $q->where('payment_type', 'udhaar')
                  ->orWhereNull('payment_type');
            })
            ->sum('gross_amount');
        $priorSplitSales = $this->sales()
            ->where('date', '<', $date)
            ->where('payment_type', 'split')
            ->sum('udhaar_amount');
        $priorReceipts = $this->receipts()->where('date', '<', $date)->sum('amount');
        return round(($this->opening_balance ?? 0) + $priorSales + $priorSplitSales - $priorReceipts, 2);
    }

    /**
     * Compute current balance up to and including a given date
     */
    public function getBalanceOn(string $date): float
    {
        $sabiqa = $this->getSabiqaBalance($date);
        $daySales = $this->sales()
            ->where('date', $date)
            ->where(function ($q) {
                $q->where('payment_type', 'udhaar')
                  ->orWhereNull('payment_type');
            })
            ->sum('gross_amount');
        $daySplitSales = $this->sales()
            ->where('date', $date)
            ->where('payment_type', 'split')
            ->sum('udhaar_amount');
        $dayReceipts = $this->receipts()->where('date', $date)->sum('amount');
        return round($sabiqa + $daySales + $daySplitSales - $dayReceipts, 2);
    }

    public function getNameAttribute(): string
    {
        $locale = session('locale', 'en');
        if ($locale === 'ur') {
            return $this->name_ur ?: ($this->name_en ?: '');
        }
        return $this->name_en ?: ($this->name_ur ?: '');
    }

    public static function boot()
    {
        parent::boot();

        static::creating(function ($merchant) {
            if (empty($merchant->code)) {
                $merchant->code = ((int) Merchant::max('code')) + 1;
            }
            if ($merchant->current_balance === null || $merchant->current_balance == 0) {
                $merchant->current_balance = $merchant->opening_balance ?? 0;
            }
        });
    }

    public function isNaqdi(): bool
    {
        return false;
    }
}
