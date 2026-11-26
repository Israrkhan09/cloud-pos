<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use App\Traits\HasSyncUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InvestmentSurplus extends Model
{
    use BelongsToBusiness, HasFactory, HasSyncUuid;

    protected $table = 'investment_surplus';

    protected $fillable = [
        'business_id',
        'uuid',
        'fund_name',
        'fund_name_ur',
        'kaha_lagaya',
        'principal_amount',
        'profit_or_loss',
        'roi_rate',
        'is_realised',
        'maturity_date',
        'status',
        'notes',
    ];

    protected $casts = [
        'principal_amount' => 'float',
        'profit_or_loss'   => 'float',
        'is_realised'      => 'boolean',
        'maturity_date'    => 'date:Y-m-d',
    ];

    public function transactions(): HasMany
    {
        return $this->hasMany(InvestmentTransaction::class, 'surplus_id');
    }

    public function getTotalReturnAttribute(): float
    {
        return $this->principal_amount + $this->profit_or_loss;
    }
}
