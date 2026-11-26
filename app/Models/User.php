<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'cloud_user_id',
        'business_id',
        'name',
        'email',
        'locale',
        'role',
        'status',
        'last_synced_at',
        'password',
    ];

    /**
     * Determine if the user account is active.
     */
    public function isActive(): bool
    {
        return empty($this->status) || strcasecmp($this->status, 'Active') === 0;
    }

    /**
     * Determine if the user account is suspended or inactive.
     */
    public function isSuspended(): bool
    {
        return !$this->isActive();
    }

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the business that the user belongs to.
     */
    public function business(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Business::class, 'business_id');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
}
