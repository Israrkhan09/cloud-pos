<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Wastage extends Model
{
    use HasFactory;

    protected $fillable = [
        'voucher_no',
        'date',
        'item_id',
        'lot_id',
        'item_name',
        'quantity',
        'unit',
        'loss_amount',
        'reason',
        'status',
        'approved_by',
    ];

    protected $casts = [
        'date'        => 'date',
        'quantity'    => 'float',
        'loss_amount' => 'float',
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
