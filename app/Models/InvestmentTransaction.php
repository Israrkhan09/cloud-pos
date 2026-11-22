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
        if ($this->is_reversed || str_starts_with($this->ref_no, 'REV-')) {
            return 'Mansookh (cancel)';
        }

        return match ($this->type) {
            'capital_in'  => 'Paisa dala',
            'capital_out' => 'Paisa nikala',
            'loan_in'     => 'Qarza liya',
            'loan_out'    => 'Qarza wapas',
            'surplus_out' => 'Faltu paisa lagaya',
            'surplus_in'  => 'Faltu paisa wapas aaya',
            default       => $this->type,
        };
    }

    public function getFormattedAmountAttribute(): string
    {
        $sign = in_array($this->type, ['capital_in', 'loan_in', 'surplus_in']) ? '+ ' : '- ';
        return $sign . number_format($this->amount, 0);
    }
}
