<?php

namespace App\Services;

use App\Models\SyncDevice;
use App\Models\SyncEvent;
use Carbon\Carbon;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CentralSyncService
{
    public function __construct(
        protected ?CentralEventProcessor $eventProcessor = null
    ) {
        $this->eventProcessor = $this->eventProcessor ?: app(CentralEventProcessor::class);
    }

    /**
     * Register a new POS device or rotate credentials for an existing device.
     *
     * @return array{device: SyncDevice, api_token: string, created: bool}
     */
    public function registerDevice(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $deviceId = trim((string) $data['device_id']);
            $existing = SyncDevice::where('device_id', $deviceId)->first();

            $plainToken = Str::random(64);
            $tokenHash = hash('sha256', $plainToken);

            if ($existing) {
                $existing->update([
                    'device_name'    => $data['device_name'] ?? $existing->device_name,
                    'hostname'       => $data['hostname'] ?? $existing->hostname,
                    'os'             => $data['os'] ?? $existing->os,
                    'app_version'    => $data['app_version'] ?? $existing->app_version,
                    'metadata'       => $data['metadata'] ?? $existing->metadata,
                    'api_token_hash' => $tokenHash,
                    'last_seen_at'   => now(),
                ]);

                return [
                    'device'    => $existing->fresh(),
                    'api_token' => $plainToken,
                    'created'   => false,
                ];
            }

            $device = SyncDevice::create([
                'uuid'           => (string) Str::uuid(),
                'device_id'      => $deviceId,
                'device_name'    => $data['device_name'] ?? null,
                'api_token_hash' => $tokenHash,
                'hostname'       => $data['hostname'] ?? null,
                'os'             => $data['os'] ?? null,
                'app_version'    => $data['app_version'] ?? null,
                'status'         => SyncDevice::STATUS_ACTIVE,
                'last_seen_at'   => now(),
                'metadata'       => $data['metadata'] ?? null,
            ]);

            return [
                'device'    => $device,
                'api_token' => $plainToken,
                'created'   => true,
            ];
        });
    }

    /**
     * Idempotently ingest a batch of sync events from a verified device.
     */
    public function ingestEvents(SyncDevice $device, array $events): array
    {
        $acceptedUuids = [];
        $duplicateUuids = [];
        $createdEvents = [];
        $seenInBatch = [];
        $now = now();

        foreach ($events as $eventData) {
            $eventUuid = strtolower(trim((string) $eventData['event_uuid']));
            $entityUuid = strtolower(trim((string) $eventData['entity_uuid']));

            if (isset($seenInBatch[$eventUuid]) || SyncEvent::where('event_uuid', $eventUuid)->exists()) {
                $duplicateUuids[] = $eventUuid;
                $seenInBatch[$eventUuid] = true;
                continue;
            }

            $seenInBatch[$eventUuid] = true;

            try {
                $createdEvent = SyncEvent::create([
                    'event_uuid'      => $eventUuid,
                    'device_id'       => $device->device_id,
                    'entity_type'     => $eventData['entity_type'],
                    'entity_uuid'     => $entityUuid,
                    'operation'       => $eventData['operation'],
                    'payload'         => $eventData['payload'],
                    'status'          => SyncEvent::STATUS_RECEIVED,
                    'event_timestamp' => !empty($eventData['timestamp'])
                        ? Carbon::parse($eventData['timestamp'])
                        : $now,
                    'received_at'     => $now,
                ]);

                $acceptedUuids[] = $eventUuid;
                $createdEvents[] = $createdEvent;
            } catch (UniqueConstraintViolationException $e) {
                $duplicateUuids[] = $eventUuid;
            } catch (\PDOException $e) {
                if (in_array((string) $e->getCode(), ['23000', '23505'], true)) {
                    $duplicateUuids[] = $eventUuid;
                } else {
                    throw $e;
                }
            }
        }

        $device->update([
            'last_synced_at' => $now,
            'last_seen_at'   => $now,
        ]);

        $processingResult = null;
        if (config('sync.auto_process_on_push', true) && !empty($createdEvents)) {
            $processingResult = $this->eventProcessor->processBatch($createdEvents);
        }

        return [
            'received_count'           => count($acceptedUuids),
            'duplicate_count'          => count($duplicateUuids),
            'accepted_event_uuids'     => $acceptedUuids,
            'duplicate_event_uuids'    => $duplicateUuids,
            'acknowledged_event_uuids' => array_values(array_merge($acceptedUuids, $duplicateUuids)),
            'processed_count'          => $processingResult['processed'] ?? 0,
            'processing_errors'        => $processingResult['errors'] ?? [],
            'server_timestamp'         => $now->toIso8601String(),
        ];
    }

    /**
     * Trigger processing of pending/received events for a specific device.
     */
    public function processDeviceEvents(SyncDevice|string $device, int $limit = 100): array
    {
        return $this->eventProcessor->processEventsForDevice($device, $limit);
    }

    /**
     * Trigger processing of all pending/received events across all devices.
     */
    public function processAllPending(int $limit = 100): array
    {
        return $this->eventProcessor->processPendingEvents($limit);
    }

    /**
     * Return server-side sync status and event counts for a verified device.
     */
    public function getDeviceStatus(SyncDevice $device): array
    {
        $counts = SyncEvent::where('device_id', $device->device_id)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        $received = (int) ($counts[SyncEvent::STATUS_RECEIVED] ?? 0);
        $processed = (int) ($counts[SyncEvent::STATUS_PROCESSED] ?? 0);
        $failed = (int) ($counts[SyncEvent::STATUS_FAILED] ?? 0);
        $rejected = (int) ($counts[SyncEvent::STATUS_REJECTED] ?? 0);

        return [
            'device_id'        => $device->device_id,
            'device_uuid'      => $device->uuid,
            'status'           => $device->status,
            'last_seen_at'     => $device->last_seen_at?->toIso8601String(),
            'last_synced_at'   => $device->last_synced_at?->toIso8601String(),
            'latest_cursor'    => (int) (SyncEvent::max('id') ?? 0),
            'events'           => [
                'total'     => $received + $processed + $failed + $rejected,
                'received'  => $received,
                'processed' => $processed,
                'failed'    => $failed,
                'rejected'  => $rejected,
            ],
            'server_timestamp' => now()->toIso8601String(),
        ];
    }

    /**
     * Retrieve cursor-paginated changes from the central sync event log (structure only).
     */
    public function pullChanges(
        SyncDevice $device,
        int $sinceCursor = 0,
        ?string $sinceTimestamp = null,
        int $limit = 100,
        bool $includeSelf = false
    ): array {
        $query = SyncEvent::query()->where('id', '>', $sinceCursor);

        if (!$includeSelf) {
            $query->where('device_id', '!=', $device->device_id);
        }

        if (!empty($sinceTimestamp)) {
            $query->where('received_at', '>=', Carbon::parse($sinceTimestamp));
        }

        $rows = $query->orderBy('id', 'asc')
            ->limit($limit + 1)
            ->get();

        $hasMore = $rows->count() > $limit;
        $items = $rows->take($limit)->values();
        $nextCursor = $items->isNotEmpty() ? (int) $items->last()->id : $sinceCursor;

        return [
            'events'           => $items->map(function (SyncEvent $event) {
                return [
                    'cursor'          => (int) $event->id,
                    'event_uuid'      => $event->event_uuid,
                    'device_id'       => $event->device_id,
                    'entity_type'     => $event->entity_type,
                    'entity_uuid'     => $event->entity_uuid,
                    'operation'       => $event->operation,
                    'payload'         => $event->payload,
                    'status'          => $event->status,
                    'event_timestamp' => $event->event_timestamp?->toIso8601String(),
                    'received_at'     => $event->received_at?->toIso8601String(),
                ];
            })->all(),
            'next_cursor'      => $nextCursor,
            'has_more'         => $hasMore,
            'server_timestamp' => now()->toIso8601String(),
        ];
    }
}
