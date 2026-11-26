<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use App\Traits\HasSyncUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class Attribute extends Model
{
    use BelongsToBusiness, HasFactory, SoftDeletes, HasSyncUuid;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'business_id',
        'uuid',
        'name',
        'description',
        'status',
        'attributes'
    ];


    protected $hidden = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];


    protected $casts = [
        'attributes' => 'array'
    ];


    public function scopeApplyFilter($query, $params)
    {
        $filterParams = collect($params);

        if ($filterParams->has('qry')) {
            $query->where('name', 'LIKE', "%{$filterParams->get('qry')}%");
        }
    }
}
