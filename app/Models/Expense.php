<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use App\Traits\HasSyncUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class Expense extends Model
{
    use BelongsToBusiness, HasFactory, SoftDeletes, HasSyncUuid;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'business_id',
        'uuid',
        'date',
        'title',
        'amount',
        'description',
    ];


    protected $hidden = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];
}
