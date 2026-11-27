<?php

namespace App\Http\Middleware;

use App\Services\PermissionService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPosPermission
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // If unauthenticated, let auth middleware handle it
        if (!$user) {
            return $next($request);
        }

        // Admin has permanent full access to every route and feature
        $role = trim((string) ($user->role ?: 'Admin'));
        if (strcasecmp($role, 'Admin') === 0 || strcasecmp($role, 'SUPER_ADMIN') === 0 || strcasecmp($role, 'CUSTOMER_ADMIN') === 0) {
            return $next($request);
        }

        // Check if the current request path is allowed for this Employee
        $path = $request->path();
        if (!PermissionService::isRouteAllowed($user, $path)) {
            // Pure API requests (non-Inertia) return JSON error
            if ($request->is('api/*') && !$request->header('X-Inertia')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Access Denied: You do not have permission to access this module.',
                ], 403);
            }

            // If user is already on dashboard, abort with 403 to avoid redirect loops
            if ($request->routeIs('dashboard') || trim($path, '/') === 'dashboard') {
                abort(403, 'Access Denied: You do not have permission to access this module.');
            }

            return redirect()->route('dashboard')->with('error', 'Access Denied: You do not have permission to access this module.');
        }

        return $next($request);
    }
}
