<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use App\Traits\HasSyncUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InvestmentPartner extends Model
{
    use BelongsToBusiness, HasFactory, HasSyncUuid;

    protected $fillable = [
        'business_id',
        'uuid',
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
        // Capital In (Approved or Posted)
        $capIn = (float) $this->transactions()
            ->where('type', 'capital_in')
            ->where('is_reversed', false)
            ->whereIn('approval_status', ['approved', 'posted'])
            ->sum('amount');

        // Drawings / Capital Out (Approved or Posted)
        $drawings = (float) $this->transactions()
            ->where('type', 'capital_out')
            ->where('is_reversed', false)
            ->whereIn('approval_status', ['approved', 'posted'])
            ->sum('amount');

        // Pending Drawings / Capital Out (Pending Owner)
        $pendingDrawings = (float) $this->transactions()
            ->where('type', 'capital_out')
            ->where('is_reversed', false)
            ->where('approval_status', 'pending_owner')
            ->sum('amount');

        // Pending Capital In (Pending Owner)
        $pendingCapIn = (float) $this->transactions()
            ->where('type', 'capital_in')
            ->where('is_reversed', false)
            ->where('approval_status', 'pending_owner')
            ->sum('amount');

        $netEquity = ($this->opening_capital + $capIn) - $drawings;
        $availableEquity = $netEquity - $pendingDrawings;

        // Draw preview estimate based on profit percentage (10% on Rs. 20,000 monthly profit pool = +2,000 share)
        // Rule: When a new partner is added, monthly profit share starts after 1 month (Rs. 0 in current month)
        $monthlyProfitPool = 20000;
        $isEligibleForCurrentMonthProfit = ($this->id <= 2) || ($this->created_at && $this->created_at->diffInDays(now()) >= 30);
        $drawPreview = ($this->profit_percentage > 0 && $isEligibleForCurrentMonthProfit)
            ? ($monthlyProfitPool * ($this->profit_percentage / 100))
            : 0;

        return [
            'opening'          => (float) $this->opening_capital,
            'cap_in'           => $capIn,
            'drawings'         => $drawings,
            'pending_drawings' => $pendingDrawings,
            'pending_cap_in'   => $pendingCapIn,
            'net_equity'       => $netEquity,
            'available_equity' => $availableEquity,
            'draw_preview'     => $drawPreview,
            'is_new_partner'   => !$isEligibleForCurrentMonthProfit,
        ];
    }
}
