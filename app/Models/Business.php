<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Business extends Model
{
    use HasFactory;

    protected $table = 'businesses';

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'owner_name',
        'email',
        'phone',
        'city',
        'mandi_location',
        'address',
        'status',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'business_id');
    }

    public function amrozaSales(): HasMany
    {
        return $this->hasMany(AmrozaSale::class, 'business_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(Item::class, 'business_id');
    }

    public function merchants(): HasMany
    {
        return $this->hasMany(Merchant::class, 'business_id');
    }

    public function farmers(): HasMany
    {
        return $this->hasMany(Farmer::class, 'business_id');
    }
}
