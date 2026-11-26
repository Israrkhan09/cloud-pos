<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use App\Traits\HasSyncUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class SaleDetail extends Model
{
    use BelongsToBusiness, HasFactory, HasSyncUuid;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'business_id',
        'uuid',
        'sale_id',
        'product_id',
        'qty',
        'price',
        'sub_total',
    ];


    protected $hidden = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];


    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
