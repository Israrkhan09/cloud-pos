<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SyncDevice;
use App\Services\CentralSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SyncController extends Controller
{
    public function __construct(
        protected CentralSyncService $centralSyncService
    ) {}

    /**
     * Register a POS desktop device or rotate its API token.
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_id'   => ['required', 'string', 'min:8', 'max:64', 'regex:/^[A-Za-z0-9\-_]+$/'],
            'device_name' => ['nullable', 'string', 'max:120'],
            'hostname'    => ['nullable', 'string', 'max:120'],
            'os'          => ['nullable', 'string', 'max:60'],
            'app_version' => ['nullable', 'string', 'max:30'],
            'metadata'    => ['nullable', 'array'],
        ]);

        $configuredKey = config('sync.registration_key');
        $hasValidRegistrationKey = false;

        if (!empty($configuredKey)) {
            $providedKey = (string) ($request->header('X-Sync-Registration-Key') ?: $request->input('registration_key', ''));
            if (empty($providedKey) || !hash_equals((string) $configuredKey, $providedKey)) {
                return response()->json([
                    'success' => false,
                    'error'   => 'invalid_registration_key',
                    'message' => 'Valid registration key is required.',
                ], 401);
            }
            $hasValidRegistrationKey = true;
        }

        $existing = SyncDevice::where('device_id', $validated['device_id'])->first();
        if ($existing) {
            if (!$existing->isActive()) {
                return response()->json([
                    'success' => false,
                    'error'   => 'device_inactive',
                    'message' => 'Device is not active.',
                ], 403);
            }

            if (!$hasValidRegistrationKey) {
                $token = (string) ($request->bearerToken() ?: $request->header('X-Device-Token', ''));
                if (empty($token) || !$existing->verifyToken($token)) {
                    return response()->json([
                        'success' => false,
                        'error'   => 'device_already_registered',
                        'message' => 'Device is already registered. Provide current valid device token to rotate credentials.',
                    ], 401);
                }
            }
        }

        $result = $this->centralSyncService->registerDevice($validated);

        return response()->json([
            'success' => true,
            'message' => $result['created']
                ? 'Device registered successfully.'
                : 'Device credentials rotated successfully.',
            'data'    => [
                'device_uuid' => $result['device']->uuid,
                'device_id'   => $result['device']->device_id,
                'device_name' => $result['device']->device_name,
                'status'      => $result['device']->status,
                'api_token'   => $result['api_token'],
                'created'     => $result['created'],
            ],
        ], $result['created'] ? 201 : 200);
    }

    /**
     * Ingest a batch of pending sync events from an authenticated POS device.
     */
    public function push(Request $request): JsonResponse
    {
        /** @var SyncDevice $device */
        $device = $request->attributes->get('sync_device');

        if ($request->filled('device_id') && (string) $request->input('device_id') !== $device->device_id) {
            return response()->json([
                'success' => false,
                'error'   => 'device_id_mismatch',
                'message' => 'Authenticated device does not match payload device ID.',
            ], 403);
        }

        $maxBatch = (int) config('sync.max_batch_size', 100);
        $allowedEntities = config('sync.allowed_entity_types', []);
        $allowedOperations = config('sync.allowed_operations', ['create', 'update', 'delete']);

        $validated = $request->validate([
            'events'               => ['required', 'array', 'min:1', "max:{$maxBatch}"],
            'events.*.event_uuid'  => ['required', 'uuid'],
            'events.*.entity_type' => ['required', 'string', Rule::in($allowedEntities)],
            'events.*.entity_uuid' => ['required', 'uuid'],
            'events.*.operation'   => ['required', 'string', Rule::in($allowedOperations)],
            'events.*.payload'     => ['required', 'array'],
            'events.*.timestamp'   => ['nullable', 'date'],
            'events.*.device_id'   => ['nullable', 'string', Rule::in([$device->device_id])],
        ]);

        $summary = $this->centralSyncService->ingestEvents($device, $validated['events']);

        return response()->json([
            'success' => true,
            'data'    => $summary,
        ], 200);
    }

    /**
     * Return server-side sync status for the authenticated POS device.
     */
    public function status(Request $request): JsonResponse
    {
        /** @var SyncDevice $device */
        $device = $request->attributes->get('sync_device');

        return response()->json([
            'success' => true,
            'data'    => $this->centralSyncService->getDeviceStatus($device),
        ], 200);
    }

    /**
     * Retrieve cursor-paginated central sync events (structure only).
     */
    public function pull(Request $request): JsonResponse
    {
        /** @var SyncDevice $device */
        $device = $request->attributes->get('sync_device');

        $validated = $request->validate([
            'since_cursor'    => ['nullable', 'integer', 'min:0'],
            'since_timestamp' => ['nullable', 'date'],
            'limit'           => ['nullable', 'integer', 'min:1', 'max:500'],
            'include_self'    => ['nullable', 'boolean'],
        ]);

        $data = $this->centralSyncService->pullChanges(
            device: $device,
            sinceCursor: (int) ($validated['since_cursor'] ?? 0),
            sinceTimestamp: $validated['since_timestamp'] ?? null,
            limit: (int) ($validated['limit'] ?? 100),
            includeSelf: (bool) ($validated['include_self'] ?? false)
        );

        return response()->json([
            'success' => true,
            'data'    => $data,
        ], 200);
    }
}
