<?php

namespace App\Services;

use App\Models\SyncOutbox;
use Illuminate\Support\Facades\Cache;

class BidirectionalSyncService
{
    public function __construct(
        protected SyncUploadService $uploadService,
        protected SyncDownloadService $downloadService,
        protected SyncQueueService $queueService,
        protected DeviceService $deviceService
    ) {}

    /**
     * Run a single bidirectional synchronization cycle (Upload local pending -> Download remote changes).
     *
     * @return array{
     *     success: bool,
     *     message: string,
     *     upload?: array,
     *     download?: array,
     *     summary: string,
     *     error?: string
     * }
     */
    public function sync(
        int $batchSize = 100,
        bool $retryFailed = false,
        bool $uploadOnly = false,
        bool $downloadOnly = false
    ): array {
        $lock = Cache::lock('pos_bidirectional_sync_running', 120);

        if (!$lock->get()) {
            return [
                'success' => false,
                'error'   => 'sync_in_progress',
                'message' => 'A bidirectional synchronization is already running.',
                'summary' => 'Sync locked: in progress.',
            ];
        }

        try {
            $uploadResult = null;
            $downloadResult = null;

            // Phase 1: Upload local pending changes to central server
            if (!$downloadOnly) {
                $uploadResult = $this->uploadService->uploadPending($batchSize, $retryFailed);
            }

            // Phase 2: Download remote changes created by other terminals from central server
            if (!$uploadOnly) {
                $downloadResult = $this->downloadService->downloadPending($batchSize);
            }

            // Phase 3: Synchronize role & feature permissions from central server
            $permissionResult = PermissionService::syncPermissionsFromCentral();

            $uploadSuccess = $uploadResult ? $uploadResult['success'] : true;
            $downloadSuccess = $downloadResult ? $downloadResult['success'] : true;
            $overallSuccess = $uploadSuccess && $downloadSuccess;

            $uploadedCount = $uploadResult['synced_count'] ?? 0;
            $downloadedCount = $downloadResult['applied_count'] ?? 0;

            $summary = "Sync complete: {$uploadedCount} event(s) uploaded, {$downloadedCount} event(s) downloaded.";

            return [
                'success'     => $overallSuccess,
                'message'     => $overallSuccess ? 'Bidirectional sync completed successfully.' : 'Sync completed with errors.',
                'upload'      => $uploadResult,
                'download'    => $downloadResult,
                'permissions' => $permissionResult,
                'summary'     => $summary,
            ];
        } finally {
            $lock->release();
        }
    }

    /**
     * Drain all pending uploads and all available downloads until both queues are clear.
     */
    public function syncAll(
        int $batchSize = 100,
        int $maxBatches = 20,
        bool $retryFailed = false,
        bool $uploadOnly = false,
        bool $downloadOnly = false
    ): array {
        $lock = Cache::lock('pos_bidirectional_sync_running', 180);

        if (!$lock->get()) {
            return [
                'success' => false,
                'error'   => 'sync_in_progress',
                'message' => 'A bidirectional synchronization is already running.',
                'summary' => 'Sync locked: in progress.',
            ];
        }

        try {
            $uploadResult = null;
            $downloadResult = null;

            if (!$downloadOnly) {
                $uploadResult = $this->uploadService->uploadAll($batchSize, $maxBatches, $retryFailed);
            }

            if (!$uploadOnly) {
                $downloadResult = $this->downloadService->downloadAll($batchSize, $maxBatches);
            }

            // Synchronize role & feature permissions from central server
            $permissionResult = PermissionService::syncPermissionsFromCentral();

            $uploadSuccess = $uploadResult ? $uploadResult['success'] : true;
            $downloadSuccess = $downloadResult ? $downloadResult['success'] : true;
            $overallSuccess = $uploadSuccess && $downloadSuccess;

            $uploadedCount = $uploadResult['synced_count'] ?? 0;
            $downloadedCount = $downloadResult['applied_count'] ?? 0;

            $summary = "Full sync complete: {$uploadedCount} event(s) uploaded across " .
                ($uploadResult['batches_processed'] ?? 0) . " batch(es), {$downloadedCount} event(s) downloaded across " .
                ($downloadResult['batches_count'] ?? 0) . " batch(es).";

            return [
                'success'     => $overallSuccess,
                'message'     => $overallSuccess ? 'Full sync completed successfully.' : 'Full sync completed with warnings.',
                'upload'      => $uploadResult,
                'download'    => $downloadResult,
                'permissions' => $permissionResult,
                'summary'     => $summary,
            ];
        } finally {
            $lock->release();
        }
    }

    /**
     * Return comprehensive sync status for both outbox and download cursor.
     */
    public function getStatus(): array
    {
        $queueStats = $this->queueService->getQueueStats();
        $cursor = $this->downloadService->getStoredCursor();
        $deviceInfo = $this->deviceService->getDeviceInfo();

        return [
            'device'     => $deviceInfo,
            'outbox'     => $queueStats,
            'download'   => [
                'current_cursor' => $cursor,
            ],
            'server_url' => config('sync.server_url'),
        ];
    }
}
