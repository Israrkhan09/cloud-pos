<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InvestmentPartner extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'name_ur',
        'role',
        'phone',
        'profit_percentage',
        'opening_capital',
        'status',
        'notes',
    ];

    protected $casts = [
        'profit_percentage' => 'float',
        'opening_capital'   => 'float',
    ];

    public function transactions(): HasMany
    {
        return $this->hasMany(InvestmentTransaction::class, 'partner_id');
    }

    /**
     * Compute current financial breakdown for partner
     */
    public function getFinancialsAttribute(): array
    {
        // Capital In
        $capIn = (float) $this->transactions()
            ->where('type', 'capital_in')
            ->where('is_reversed', false)
            ->whereIn('approval_status', ['approved', 'posted'])
            ->sum('amount');

        // Drawings / Capital Out (excluding advance portion if recorded separately)
        $drawings = (float) $this->transactions()
            ->where('type', 'capital_out')
            ->where('is_reversed', false)
            ->whereIn('approval_status', ['approved', 'posted'])
            ->sum('amount');

        $netEquity = ($this->opening_capital + $capIn) - $drawings;

        // Draw preview estimate based on profit percentage (e.g. 10% on Rs. 20,000 monthly profit pool = +2,000 share)
        $monthlyProfitPool = 20000;
        $drawPreview = ($this->profit_percentage > 0)
            ? ($monthlyProfitPool * ($this->profit_percentage / 100))
            : 0;

        return [
            'opening'       => (float) $this->opening_capital,
            'cap_in'        => $capIn,
            'drawings'      => $drawings,
            'net_equity'    => $netEquity,
            'draw_preview'  => $drawPreview,
        ];
    }
}
