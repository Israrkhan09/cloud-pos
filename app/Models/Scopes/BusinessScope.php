<?php

namespace App\Models\Scopes;

use App\Services\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Auth;

class BusinessScope implements Scope
{
    /**
     * Apply the business tenant scope to a given Eloquent query builder.
     */
    public function apply(Builder $builder, Model $model): void
    {
        $tenantContext = app(TenantContext::class);

        // When explicitly bypassed (e.g., migrations, system sync, cross-tenant administration)
        if ($tenantContext->isBypassed()) {
            return;
        }

        $businessId = $tenantContext->getBusinessId();

        if ($businessId !== null) {
            $builder->where($model->qualifyColumn('business_id'), $businessId);
        } else {
            // CRITICAL DEFENSE:
            // 1. If an authenticated user has no business assignment, block all access.
            // 2. If running within a web request and no business context is set, block all access.
            if (Auth::check() || !app()->runningInConsole()) {
                $builder->whereRaw('1 = 0');
            }
        }
    }
}
