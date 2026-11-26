<?php

namespace App\Http\Middleware;

use App\Models\SyncDevice;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifySyncDevice
{
    /**
     * Authenticate and verify the originating POS device for sync API calls.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken() ?: $request->header('X-Device-Token');
        $headerDeviceId = $request->header('X-Device-Id');
        $inputDeviceId = $request->input('device_id');
        $deviceId = $headerDeviceId ?: $inputDeviceId;

        if (empty($token) || empty($deviceId)) {
            return response()->json([
                'success' => false,
                'error'   => 'unauthenticated_device',
                'message' => 'Missing device credentials.',
            ], 401);
        }

        if (!empty($headerDeviceId) && $request->filled('device_id') && (string) $headerDeviceId !== (string) $inputDeviceId) {
            return response()->json([
                'success' => false,
                'error'   => 'device_id_mismatch',
                'message' => 'Header device ID does not match payload device ID.',
            ], 403);
        }

        $device = SyncDevice::where('device_id', (string) $deviceId)->first();

        if (!$device || !$device->verifyToken((string) $token)) {
            return response()->json([
                'success' => false,
                'error'   => 'invalid_device_credentials',
                'message' => 'Invalid device ID or API token.',
            ], 401);
        }

        if (!$device->isActive()) {
            return response()->json([
                'success' => false,
                'error'   => 'device_inactive',
                'message' => 'Device is not active.',
            ], 403);
        }

        $device->update(['last_seen_at' => now()]);
        $request->attributes->set('sync_device', $device);

        return $next($request);
    }
}
