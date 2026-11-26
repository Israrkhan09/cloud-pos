<?php

namespace App\Traits;

use App\Models\Business;
use App\Models\Scopes\BusinessScope;
use App\Services\TenantContext;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

trait BelongsToBusiness
{
    /**
     * Boot the BelongsToBusiness trait for a model.
     */
    protected static function bootBelongsToBusiness(): void
    {
        // 1. Add global scope: automatically filters queries by active tenant
        static::addGlobalScope(new BusinessScope());

        // 2. Automatically assign business_id on model creation if not explicitly provided
        static::creating(function ($model) {
            if (empty($model->business_id)) {
                $businessId = app(TenantContext::class)->getBusinessId();
                if (!empty($businessId)) {
                    $model->business_id = $businessId;
                }
            }
        });
    }

    /**
     * Belongs-to relationship for the owning business.
     */
    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class, 'business_id');
    }
}
