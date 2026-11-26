<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use App\Traits\HasSyncUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InvestmentLoan extends Model
{
    use BelongsToBusiness, HasFactory, HasSyncUuid;

    protected $fillable = [
        'business_id',
        'uuid',
        'lender_name',
        'lender_name_ur',
        'phone',
        'direction',
        'principal_amount',
        'fee_or_interest',
        'paid_amount',
        'due_date',
        'status',
        'notes',
    ];

    protected $casts = [
        'principal_amount' => 'float',
        'fee_or_interest'  => 'float',
        'paid_amount'      => 'float',
        'due_date'         => 'date:Y-m-d',
    ];

    public function transactions(): HasMany
    {
        return $this->hasMany(InvestmentTransaction::class, 'loan_id');
    }

    public function getBalanceDueAttribute(): float
    {
        return max(0, ($this->principal_amount + $this->fee_or_interest) - $this->paid_amount);
    }

    public function getDueBadgeAttribute(): array
    {
        if ($this->status === 'settled') {
            return [
                'text'  => 'Chukta (Settled)',
                'label' => 'Chukta (Settled)',
                'type'  => 'neutral',
                'color' => 'bg-gray-100 text-gray-700 border-gray-300',
            ];
        }

        if (!$this->due_date) {
            return [
                'text'  => 'Khula (Open)',
                'label' => 'Khula (Open)',
                'type'  => 'neutral',
                'color' => 'bg-blue-50 text-blue-700 border-blue-200',
            ];
        }

        $today = new \DateTime(date('Y-m-d'));
        $due = new \DateTime($this->due_date->format('Y-m-d'));
        $diff = $today->diff($due);

        if ($due < $today) {
            $days = $diff->days;
            return [
                'text'  => "Overdue {$days} din",
                'label' => "Overdue {$days} din",
                'type'  => 'danger',
                'color' => 'bg-red-100 text-red-800 border-red-300',
            ];
        }

        return [
            'text'  => 'Wapsi ' . $due->format('j M'),
            'label' => 'Wapsi ' . $due->format('j M'),
            'type'  => 'warning',
            'color' => 'bg-amber-100 text-amber-800 border-amber-300',
        ];
    }
}
