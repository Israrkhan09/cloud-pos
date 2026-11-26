<?php

namespace App\Services;

use App\Models\Business;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;

class TenantContext
{
    /**
     * Temporary scoped override used exclusively inside runAs().
     */
    protected static ?string $runAsBusinessId = null;

    /**
     * In-memory override for background jobs, console commands, or testing.
     */
    protected static ?string $overrideBusinessId = null;

    /**
     * Global bypass flag for internal system operations (e.g. migrations, cross-tenant sync).
     */
    protected static bool $bypass = false;

    /**
     * Resolve the active business ID for the current context.
     */
    public function getBusinessId(): ?string
    {
        // 1. Explicit scoped execution via runAs() (highest priority for temporary execution blocks)
        if (static::$runAsBusinessId !== null) {
            return static::$runAsBusinessId;
        }

        // 2. Authenticated user's business identity (authoritative for all user actions)
        if (Auth::check()) {
            $user = Auth::user();
            if (!empty($user->business_id)) {
                return (string) $user->business_id;
            }
            // Authenticated user without business_id must NEVER fall back to another tenant's session!
            return null;
        }

        // 3. Explicit in-memory override (for CLI commands or background workers without auth)
        if (static::$overrideBusinessId !== null) {
            return static::$overrideBusinessId;
        }

        // 4. Active session context (only if explicitly set and no conflicting auth user)
        if (Session::has('active_business_id')) {
            $sessionBiz = Session::get('active_business_id');
            if (!empty($sessionBiz)) {
                return (string) $sessionBiz;
            }
        }

        return null;
    }

    /**
     * Get the active Business model instance.
     */
    public function getBusiness(): ?Business
    {
        $bizId = $this->getBusinessId();
        if (empty($bizId)) {
            return null;
        }

        return Business::find($bizId);
    }

    /**
     * Get lightweight summary for frontend sharing.
     */
    public function getBusinessSummary(): ?array
    {
        $business = $this->getBusiness();
        if ($business) {
            return [
                'id'             => $business->id,
                'name'           => $business->name,
                'owner_name'     => $business->owner_name,
                'city'           => $business->city,
                'mandi_location' => $business->mandi_location,
                'status'         => $business->status,
            ];
        }

        $bizId = $this->getBusinessId();
        if ($bizId) {
            $defaultName = ($bizId === 'biz-test-business') ? 'Test Business' : 'Kashmir Sabzi Mandi';
            return [
                'id'             => $bizId,
                'name'           => $defaultName,
                'mandi_location' => $defaultName,
            ];
        }

        return null;
    }

    /**
     * Explicitly set the active business ID.
     */
    public function setBusinessId(?string $businessId): void
    {
        static::$overrideBusinessId = $businessId;
        if ($businessId !== null) {
            Session::put('active_business_id', $businessId);
        } else {
            Session::forget('active_business_id');
        }
    }

    /**
     * Check if tenant isolation is bypassed.
     */
    public function isBypassed(): bool
    {
        return static::$bypass;
    }

    /**
     * Set the bypass flag directly.
     */
    public function setBypass(bool $bypass): void
    {
        static::$bypass = $bypass;
    }

    /**
     * Execute a callback with tenant scoping temporarily bypassed.
     */
    public function bypass(callable $callback): mixed
    {
        $previous = static::$bypass;
        static::$bypass = true;

        try {
            return $callback();
        } finally {
            static::$bypass = $previous;
        }
    }

    /**
     * Execute a callback in the context of a specific business ID.
     */
    public function runAs(?string $businessId, callable $callback): mixed
    {
        $previous = static::$runAsBusinessId;
        static::$runAsBusinessId = $businessId;

        try {
            return $callback();
        } finally {
            static::$runAsBusinessId = $previous;
        }
    }

    /**
     * Clear all tenant context overrides, bypass flags, and session state.
     */
    public function clear(): void
    {
        static::$runAsBusinessId = null;
        static::$overrideBusinessId = null;
        static::$bypass = false;
        Session::forget('active_business_id');
    }

    /**
     * Check if a tenant is currently active.
     */
    public function hasBusiness(): bool
    {
        return !empty($this->getBusinessId());
    }
}
