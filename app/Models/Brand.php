<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use App\Traits\AppendsToggle;
use App\Traits\HasSyncUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class Brand extends Model
{
    use BelongsToBusiness, HasFactory, SoftDeletes, AppendsToggle, HasSyncUuid;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'business_id',
        'uuid',
        'name',
        'description',
        'image'
    ];


    protected $appends = [
        'image_url'
    ];


    protected $hidden = [
        'image',
        'created_by',
        'updated_at',
        'deleted_at',
    ];


    public function getImageUrlAttribute()
    {
        if ($this->image) {
            return asset("storage/brand/{$this->image}");
        }
        return null;
    }


    public function scopeApplyFilter($query, array $params)
    {
        $filterParams = collect($params);

        if ($filterParams->has('qry')) {
            $query->where('name', 'LIKE', "%{$filterParams->get('qry')}%");
        }
    }
}
