<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DiscountRule extends Model
{
    use BelongsToBusiness, HasFactory;

    protected $table = 'discount_rules';

    protected $fillable = [
        'business_id',
        'rule_name',
        'discount_type',
        'discount_value',
        'min_order_amount',
        'is_active',
        'description',
    ];

    protected $casts = [
        'discount_value' => 'float',
        'min_order_amount' => 'float',
        'is_active' => 'boolean',
    ];
}
