<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class ExpiryLot extends Model
{
    use BelongsToBusiness, HasFactory;

    protected $fillable = [
        'business_id',
        'item_id',
        'item_name',
        'lot_code',
        'arrival_date',
        'expiry_at',
        'quantity',
        'unit',
        'rate',
        'nuqsan',
        'status',
        'discount_rate',
        'action_taken',
    ];

    protected $casts = [
        'arrival_date'  => 'date',
        'expiry_at'     => 'datetime',
        'quantity'      => 'float',
        'rate'          => 'float',
        'nuqsan'        => 'float',
        'discount_rate' => 'float',
    ];

    protected $appends = ['expiry_countdown', 'lot_subtitle', 'computed_status'];

    public function item()
    {
        return $this->belongsTo(Item::class, 'item_id');
    }

    public function getLotSubtitleAttribute(): string
    {
        $dateStr = $this->arrival_date ? $this->arrival_date->format('j M') : '';
        return "{$this->lot_code} · {$dateStr}";
    }

    public function getExpiryCountdownAttribute(): array
    {
        if ($this->action_taken === 'wastage' || $this->quantity <= 0) {
            return [
                'text'       => 'Wastage likha gaya',
                'type'       => 'neutral',
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
            return [
                'text'       => 'Expire ho chuka',
                'type'       => 'expired',
                'hours_left' => 0,
            ];
        }

        $days = (int) floor($diffMinutes / (60 * 24));
        $hours = (int) floor(($diffMinutes % (60 * 24)) / 60);
        $mins = (int) ($diffMinutes % 60);

        if ($days >= 3) {
            $text = "{$days} din";
            $type = 'fresh';
        } elseif ($days > 0) {
            $text = "{$days}d {$hours}h";
            $type = 'jaldi_bechein';
        } else {
            $text = "{$hours}h {$mins}m";
            $type = 'danger';
        }

        return [
            'text'       => $text,
            'type'       => $type,
            'hours_left' => $diffMinutes / 60,
        ];
    }

    public function getComputedStatusAttribute(): string
    {
        if ($this->status === 'expired' || ($this->expiry_at && $this->expiry_at->isPast())) {
            return 'expired';
        }

        $countdown = $this->expiry_countdown;
        if ($countdown['type'] === 'danger' || $countdown['type'] === 'jaldi_bechein') {
            return 'jaldi_bechein';
        }

        return $this->status ?: 'fresh';
    }
}
