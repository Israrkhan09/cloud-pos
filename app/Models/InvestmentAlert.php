<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use App\Traits\HasSyncUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvestmentAlert extends Model
{
    use BelongsToBusiness, HasFactory, HasSyncUuid;

    protected $fillable = [
        'business_id',
        'uuid',
        'partner_id',
        'partner_name',
        'attempted_amount',
        'excess_amount',
        'resolved',
        'notes',
    ];

    protected $casts = [
        'attempted_amount' => 'float',
        'excess_amount'    => 'float',
        'resolved'         => 'boolean',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(InvestmentPartner::class, 'partner_id');
    }
}
