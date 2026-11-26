<?php

namespace App\Http\Middleware;

use App\Models\Business;
use App\Services\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnforceTenantContext
{
    /**
     * Handle an incoming request.
     * Ensures that every authenticated user has a valid, active business workspace assigned,
     * strictly bound to their session and tenant context.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (Auth::check()) {
            $user = Auth::user();

            // 1. Check account suspension/deactivation
            if (method_exists($user, 'isSuspended') && $user->isSuspended()) {
                app(TenantContext::class)->clear();
                Auth::guard('web')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                return redirect()->route('login')->withErrors([
                    'email' => 'Your account has been deactivated. Please contact your administrator.',
                ]);
            }

            // 2. Check business assignment
            if (empty($user->business_id)) {
                app(TenantContext::class)->clear();
                Auth::guard('web')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                return redirect()->route('login')->withErrors([
                    'email' => 'Your account is not assigned to any business workspace. Access denied.',
                ]);
            }

            // 3. Verify that the assigned business exists and is active
            $business = Business::find($user->business_id);
            if (!$business) {
                app(TenantContext::class)->clear();
                Auth::guard('web')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                return redirect()->route('login')->withErrors([
                    'email' => 'The assigned business workspace was not found. Access denied.',
                ]);
            }

            if (!empty($business->status) && strcasecmp($business->status, 'Active') !== 0) {
                app(TenantContext::class)->clear();
                Auth::guard('web')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                return redirect()->route('login')->withErrors([
                    'email' => 'Your business workspace is currently inactive or suspended. Access denied.',
                ]);
            }

            // 4. Strictly synchronize TenantContext and Session with the authenticated user's business
            $tenantContext = app(TenantContext::class);
            $tenantContext->setBusinessId($user->business_id);
            session(['active_business_id' => $user->business_id]);
        }

        return $next($request);
    }
}
