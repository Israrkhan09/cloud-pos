<?php

namespace App\Http\Requests\Auth;

use Illuminate\Auth\Events\Lockout;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ];
    }

    /**
     * Attempt to authenticate the request's credentials.
     * Supports offline-first local SQLite authentication with automatic cloud fallback and local mirroring.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        $email = trim(strtolower($this->string('email')));
        $password = (string) $this->input('password');
        $remember = $this->boolean('remember');

        // Clear any prior tenant context and session state before attempting authentication
        app(\App\Services\TenantContext::class)->clear();

        // 1. First, attempt standard local SQLite authentication (offline-first)
        if (Auth::attempt(['email' => $email, 'password' => $password], $remember)) {
            $localUser = Auth::user();

            if ($localUser && method_exists($localUser, 'isSuspended') && $localUser->isSuspended()) {
                Auth::logout();
                session()->invalidate();
                RateLimiter::hit($this->throttleKey());

                throw ValidationException::withMessages([
                    'email' => 'Your employee account has been deactivated. Please contact your administrator.',
                ]);
            }

            // Require business assignment
            if (!$localUser || empty($localUser->business_id)) {
                Auth::logout();
                session()->invalidate();
                RateLimiter::hit($this->throttleKey());

                throw ValidationException::withMessages([
                    'email' => 'This account is not assigned to any business workspace. Access denied.',
                ]);
            }

            // Verify that the assigned business exists and is active
            $business = \App\Models\Business::find($localUser->business_id);
            if (!$business || (!empty($business->status) && strcasecmp($business->status, 'Active') !== 0)) {
                Auth::logout();
                session()->invalidate();
                RateLimiter::hit($this->throttleKey());

                throw ValidationException::withMessages([
                    'email' => 'The business workspace assigned to this account is inactive or not found.',
                ]);
            }

            // Bind active tenant
            session(['active_business_id' => $localUser->business_id]);
            app(\App\Services\TenantContext::class)->setBusinessId($localUser->business_id);

            RateLimiter::clear($this->throttleKey());
            return;
        }

        // 2. If local authentication failed, check if user exists locally
        $existingLocalUser = \App\Models\User::where('email', $email)->first();

        if ($existingLocalUser) {
            // User exists locally but password did not match local record
            RateLimiter::hit($this->throttleKey());

            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        // 3. User does not exist locally in SQLite. Attempt central cloud authentication
        /** @var \App\Services\PosAuthClientService $authClient */
        $authClient = app(\App\Services\PosAuthClientService::class);
        $cloudResult = $authClient->login($email, $password);

        if ($cloudResult['success'] && !empty($cloudResult['user'])) {
            // Successfully verified against central PostgreSQL. Mirror into local SQLite!
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

            if (empty($cloudUserData['businessId'])) {
                RateLimiter::hit($this->throttleKey());
                throw ValidationException::withMessages([
                    'email' => 'Central cloud account is not associated with any business workspace.',
                ]);
            }

            /** @var \App\Services\UserSyncService $userSyncService */
            $userSyncService = app(\App\Services\UserSyncService::class);
            $localUser = $userSyncService->mirrorCloudUser(
                $cloudUserData,
                $password,
                $cloudResult['token'] ?? null
            );

            // Sync permissions for this role
            $userSyncService->syncPermissionsFromCloud(
                $cloudResult['business']['id'] ?? null,
                $cloudResult['token'] ?? null
            );

            // Establish local session
            Auth::login($localUser, $remember);
            session(['active_business_id' => $localUser->business_id]);
            app(\App\Services\TenantContext::class)->setBusinessId($localUser->business_id);
            RateLimiter::clear($this->throttleKey());

            // Non-blocking initial sync attempt
            try {
                app(\App\Services\BidirectionalSyncService::class)->sync();
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning("Post-login sync deferred: {$e->getMessage()}");
            }
            return;
        }

        // 4. Handle specific central failure cases
        RateLimiter::hit($this->throttleKey());

        if (($cloudResult['error'] ?? '') === 'network_unavailable') {
            throw ValidationException::withMessages([
                'email' => 'Cannot connect to central server to verify new account. An internet connection is required for first-time login on this station.',
            ]);
        }

        $cloudStatus = $cloudResult['status'] ?? '';
        if ($cloudStatus === 'PENDING_PASSWORD' || str_contains($cloudResult['message'] ?? '', 'activate')) {
            throw ValidationException::withMessages([
                'email' => 'Your account requires first-time password activation. Please click "Activate Invited Account" below.',
            ]);
        }

        throw ValidationException::withMessages([
            'email' => $cloudResult['message'] ?? __('auth.failed'),
        ]);
    }

    /**
     * Ensure the login request is not rate limited.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'email' => __('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ]);
    }

    /**
     * Get the rate limiting throttle key for the request.
     */
    public function throttleKey(): string
    {
        return Str::transliterate(Str::lower($this->string('email')).'|'.$this->ip());
    }
}
