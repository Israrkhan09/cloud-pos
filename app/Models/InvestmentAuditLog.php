<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use App\Traits\HasSyncUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvestmentAuditLog extends Model
{
    use BelongsToBusiness, HasFactory, HasSyncUuid;

    public $timestamps = false;

    protected $fillable = [
        'business_id',
        'uuid',
        'action',
        'transaction_id',
        'ref_no',
        'user_name',
        'user_role',
        'details',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(InvestmentTransaction::class, 'transaction_id');
    }
}
