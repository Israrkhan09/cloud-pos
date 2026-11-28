<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use App\Traits\HasSyncUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Item extends Model
{
    use BelongsToBusiness, HasFactory, SoftDeletes, HasSyncUuid;

    protected $fillable = [
        'business_id',
        'uuid',
        'code',
        'name_en',
        'name_ur',
        'unit',
        'kg_per_unit',
        'opening_stock',
        'current_stock',
        'low_stock_alert',
        'lot_date',
        'stock_note',
        'default_rate',
        'purchase_rate',
        'default_bardana',
        'status',
        'shelf_life',
        'shelf_life_days',
        'discount_rate',
        'expiry_at',
    ];

    protected $appends = ['name', 'expiry_countdown', 'computed_status', 'live_stock'];

    protected $casts = [
        'purchase_rate'   => 'float',
        'kg_per_unit'     => 'float',
        'opening_stock'   => 'integer',
        'current_stock'   => 'integer',
        'low_stock_alert' => 'integer',
        'default_rate'    => 'float',
        'default_bardana' => 'float',
        'discount_rate'   => 'float',
        'shelf_life_days' => 'integer',
        'expiry_at'       => 'datetime',
    ];

    public function getNameAttribute(): string
    {
        $locale = session('locale', 'en');
        if ($locale === 'ur') {
            return $this->name_ur ?: ($this->name_en ?: '');
        }
        return $this->name_en ?: ($this->name_ur ?: '');
    }

    public function getLiveStockAttribute(): int
    {
        return $this->current_stock ?? $this->opening_stock ?? 0;
    }

    public function getExpiryCountdownAttribute(): array
    {
        if ($this->status === 'khatam' || (isset($this->current_stock) && $this->current_stock === 0)) {
            return [
                'text'       => 'Timer off (stock 0)',
                'type'       => 'khatam',
                'hours_left' => null,
            ];
        }

        if (!$this->expiry_at) {
            return [
                'text'       => '—',
                'type'       => 'neutral',
                'hours_left' => null,
            ];
        }

        $now = now();
        $diffMinutes = (int) $now->diffInMinutes($this->expiry_at, false);

        if ($diffMinutes <= 0) {
            $absMin = abs($diffMinutes);
            $hours = (int) floor($absMin / 60);
            $pehle = $hours > 0 ? "{$hours}h ago" : "{$absMin}m ago";
            return [
                'text'       => "Expired — {$pehle}",
                'type'       => 'expired',
                'hours_left' => 0,
            ];
        }

        $days = (int) floor($diffMinutes / (60 * 24));
        $hours = (int) floor(($diffMinutes % (60 * 24)) / 60);
        $mins = (int) ($diffMinutes % 60);

        $parts = [];
        if ($days > 0) $parts[] = "{$days}d";
        if ($hours > 0) $parts[] = "{$hours}h";
        $parts[] = sprintf('%02dm', $mins);

        $text = implode(' ', $parts) . ' remaining';
        $type = $diffMinutes <= (24 * 60) ? 'expiring_soon' : 'active';

        return [
            'text'       => $text,
            'type'       => $type,
            'hours_left' => $diffMinutes / 60,
        ];
    }

    public function getComputedStatusAttribute(): string
    {
        if ($this->status === 'khatam' || (isset($this->current_stock) && $this->current_stock === 0)) {
            return 'khatam';
        }
        if ($this->expiry_at && $this->expiry_at->isPast()) {
            return 'expired';
        }
        if ($this->expiry_at && now()->diffInHours($this->expiry_at, false) <= 24) {
            return 'expiring_soon';
        }
        if (isset($this->current_stock) && isset($this->low_stock_alert) && $this->current_stock <= $this->low_stock_alert) {
            return 'low_stock';
        }
        return $this->status ?: 'active';
    }
}
