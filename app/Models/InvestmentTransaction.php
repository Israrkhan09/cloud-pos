<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvestmentTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'ref_no',
        'date',
        'type',
        'partner_id',
        'loan_id',
        'surplus_id',
        'party_name',
        'amount',
        'payment_method',
        'bank_name',
        'reason',
        'is_advance',
        'advance_amount',
        'approval_status',
        'approved_by',
        'approved_at',
        'created_by_role',
        'created_by_user_id',
        'is_reversed',
        'reversal_reason',
        'reversal_ref_no',
    ];

    protected $casts = [
        'amount'         => 'float',
        'advance_amount' => 'float',
        'is_advance'     => 'boolean',
        'is_reversed'    => 'boolean',
        'date'           => 'date:Y-m-d',
        'approved_at'    => 'datetime',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(InvestmentPartner::class, 'partner_id');
    }

    public function loan(): BelongsTo
    {
        return $this->belongsTo(InvestmentLoan::class, 'loan_id');
    }

    public function surplus(): BelongsTo
    {
        return $this->belongsTo(InvestmentSurplus::class, 'surplus_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function getTypeLabelAttribute(): string
    {
        return match ($this->type) {
            'capital_in'  => 'Paisa Lagaya (Capital In)',
            'capital_out' => 'Paisa Nikala (Drawings)',
            'loan_in'     => 'Qarza Liya (Loan In)',
            'loan_out'    => 'Qarza Wapsi (Loan Out)',
            'surplus_out' => 'Faltu Paisa Lagaya (Surplus Out)',
            'surplus_in'  => 'Investment Wapsi (Surplus In)',
            default       => $this->type,
        };
    }

    public function getFormattedAmountAttribute(): string
    {
        $sign = in_array($this->type, ['capital_in', 'loan_in', 'surplus_in']) ? '+ ' : '- ';
        return $sign . number_format($this->amount, 0);
    }
}
