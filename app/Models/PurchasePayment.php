<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use App\Helpers\Helpers;
use App\Traits\HasSyncUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class PurchasePayment extends Model
{
    use BelongsToBusiness, HasFactory, HasSyncUuid;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'business_id',
        'uuid',
        'purchase_id',
        'amount',
        'date',
        'reference',
        'payment_method',
        'note',
    ];


    protected $hidden = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];
    

    public static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            $number = PurchasePayment::max('id') + 1;
            $model->reference = Helpers::makeReferenceId('PUR-PAY', $number);
        });
    }
}
