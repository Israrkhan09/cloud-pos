<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PosPermission extends Model
{
    protected $table = 'pos_permissions';

    protected $fillable = [
        'role',
        'business_id',
        'allowed_features',
        'synced_at',
        'version',
    ];

    protected function casts(): array
    {
        return [
            'allowed_features' => 'array',
            'synced_at'        => 'datetime',
        ];
    }
}
