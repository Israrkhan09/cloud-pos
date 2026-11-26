<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use App\Services\PosAuthClientService;
use App\Services\UserSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Show the login page.
     */
    public function create(Request $request): Response
    {
        if (!Auth::check()) {
            app(\App\Services\TenantContext::class)->clear();
        }

        return Inertia::render('auth/login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Check account status locally and with the central backend.
     */
    public function checkStatus(Request $request, PosAuthClientService $authClient): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'string', 'email'],
        ]);

        $email = trim(strtolower($request->string('email')));

        // Check local SQLite first
        $localUser = User::where('email', $email)->first();
        if ($localUser) {
            if ($localUser->isSuspended()) {
                return response()->json([
                    'success' => true,
                    'status'  => 'SUSPENDED',
                    'message' => 'Your employee account has been deactivated. Please contact your administrator.',
                ]);
            }

            return response()->json([
                'success'      => true,
                'status'       => 'LOCAL_ACTIVE',
                'name'         => $localUser->name,
                'role'         => $localUser->role,
                'message'      => 'Account is ready. Enter your password to log in.',
            ]);
        }

        // User does not exist locally; query central backend using exact endpoint
        $cloudStatus = $authClient->checkStatus($email);

        return response()->json($cloudStatus);
    }

    /**
     * Activate employee account by creating password through the POS terminal.
     */
    public function activate(
        Request $request,
        PosAuthClientService $authClient,
        UserSyncService $userSyncService
    ): RedirectResponse|JsonResponse {
        $validated = $request->validate([
            'email'    => ['required', 'string', 'email'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $email = trim(strtolower($validated['email']));
        $password = $validated['password'];

        // Submit activation request to the central backend using exact endpoint
        $cloudResult = $authClient->activate($email, $password);

        if (!$cloudResult['success'] || empty($cloudResult['user'])) {
            $errorMsg = $cloudResult['message'] ?? 'Activation failed. Please check your details and try again.';

            if ($request->wantsJson()) {
                return response()->json(['success' => false, 'message' => $errorMsg], 400);
            }

            throw ValidationException::withMessages(['password' => $errorMsg]);
        }

        $cloudUserData = $cloudResult['user'];
        $cloudBusiness = $cloudResult['business'] ?? [];

        // Canonical business ID
        $businessId = $cloudUserData['businessId'] 
            ?? ($cloudUserData['business_id'] 
            ?? ($cloudBusiness['id'] ?? null));

        if (!empty($businessId)) {
            $cloudUserData['businessId'] = (string) $businessId;
        }

        // Canonical business name
        $businessName = $cloudBusiness['name'] 
            ?? ($cloudUserData['businessName'] 
            ?? ($cloudUserData['business_name'] ?? null));

        if (!empty($businessName)) {
            $cloudUserData['businessName'] = (string) $businessName;
        }

        // Canonical mandi location
        $mandiLocation = $cloudBusiness['mandiLocation'] 
            ?? ($cloudBusiness['mandi_location'] 
            ?? ($cloudUserData['mandiLocation'] 
            ?? ($cloudUserData['mandi_location'] ?? null)));

        if (!empty($mandiLocation)) {
            $cloudUserData['mandiLocation'] = (string) $mandiLocation;
        }

        // Canonical city
        $city = $cloudBusiness['city'] 
            ?? ($cloudUserData['city'] ?? null);

        if (!empty($city)) {
            $cloudUserData['city'] = (string) $city;
        }

        // Activation succeeded on central backend! Mirror employee into local SQLite
        $localUser = $userSyncService->mirrorCloudUser(
            $cloudUserData,
            $password,
            $cloudResult['token'] ?? null
        );

        // Synchronize permissions for this role
        $userSyncService->syncPermissionsFromCloud(
            $cloudResult['business']['id'] ?? null,
            $cloudResult['token'] ?? null
        );

        // Establish authenticated session locally
        Auth::login($localUser);
        $request->session()->regenerate();
        if (!empty($localUser->business_id)) {
            session(['active_business_id' => $localUser->business_id]);
        }

        // Non-blocking initial sync attempt
        try {
            app(\App\Services\BidirectionalSyncService::class)->sync();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("Post-activation sync deferred: {$e->getMessage()}");
        }

        if ($request->wantsJson()) {
            return response()->json([
                'success'  => true,
                'message'  => 'Account activated successfully. Logged in.',
                'redirect' => route('dashboard', absolute: false),
            ]);
        }

        return redirect()->intended(route('dashboard', absolute: false));
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        if ($user = Auth::user()) {
            if (!empty($user->business_id)) {
                session(['active_business_id' => $user->business_id]);
                app(\App\Services\TenantContext::class)->setBusinessId($user->business_id);
            }
        }

        return redirect()->intended(route('dashboard', absolute: false));
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        app(\App\Services\TenantContext::class)->clear();

        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
