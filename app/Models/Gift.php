<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Gift extends Model
{
    use BelongsToBusiness, HasFactory;

    protected $fillable = [
        'business_id',
        'voucher_no',
        'date',
        'recipient_name',
        'item_id',
        'lot_id',
        'item_name',
        'quantity',
        'unit',
        'rate',
        'value',
        'reason',
        'status',
    ];

    protected $casts = [
        'date'     => 'date',
        'quantity' => 'float',
        'rate'     => 'float',
        'value'    => 'float',
    ];

    public function item()
    {
        return $this->belongsTo(Item::class, 'item_id');
    }

    public function lot()
    {
        return $this->belongsTo(ExpiryLot::class, 'lot_id');
    }
}
