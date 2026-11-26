<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('pos:device-id', function (\App\Services\DeviceService $deviceService) {
    $info = $deviceService->getDeviceInfo();
    $this->info('=== POS Desktop Installation Identity ===');
    $this->line("Device ID:    <comment>{$info['device_id']}</comment>");
    $this->line("Hostname:     {$info['hostname']}");
    $this->line("OS:           {$info['os']}");
    $this->line("PHP Version:  {$info['php_version']}");
    $this->line("Created At:   {$info['created_at']}");
})->purpose('Display the unique persistent Device ID for this POS desktop installation');

Artisan::command('pos:sync-status', function (
    \App\Services\SyncQueueService $syncQueueService,
    \App\Services\SyncDownloadService $syncDownloadService
) {
    $stats = $syncQueueService->getQueueStats();
    $cursor = $syncDownloadService->getStoredCursor();

    $this->info('=== POS Synchronization Status ===');
    $this->line("Device ID:        <comment>{$stats['device_id']}</comment>");
    $this->line("Server URL:       " . config('sync.server_url'));
    $this->line("Download Cursor:  <info>{$cursor}</info>");
    $this->line('');
    $this->line("<comment>--- Outbox Queue ---</comment>");
    $this->line("Total:            {$stats['total']}");
    $this->line("Pending:          {$stats['pending']}");
    $this->line("Processing:       {$stats['processing']}");
    $this->line("Synced:           {$stats['synced']}");
    $this->line("Failed:           {$stats['failed']}");
})->purpose('Display local sync outbox and download tracking statistics');

Artisan::command('pos:sync-process {--device= : Specific device ID to process events for} {--limit=100 : Maximum events to process in this run}', function (\App\Services\CentralEventProcessor $processor) {
    $deviceId = $this->option('device');
    $limit = max(1, (int) $this->option('limit'));

    $this->info('=== Central Event Processing Engine ===');

    if (!empty($deviceId)) {
        $this->line("Processing events for device: <comment>{$deviceId}</comment> (limit: {$limit})...");
        $result = $processor->processEventsForDevice($deviceId, $limit);
    } else {
        $this->line("Processing pending events across all devices (limit: {$limit})...");
        $result = $processor->processPendingEvents($limit);
    }

    $this->info("Processed: <info>{$result['processed']}</info> | Failed: <comment>{$result['failed']}</comment> | Skipped: {$result['skipped']} | Total: {$result['total']}");

    if (!empty($result['errors'])) {
        $this->warn('Processing errors encountered:');
        foreach ($result['errors'] as $err) {
            $this->line("  - [{$err['entity_type']} {$err['entity_uuid']}]: {$err['error']}");
        }
    }

    return $result['failed'] === 0 ? 0 : 1;
})->purpose('Process received sync events into central database business tables');

Artisan::command('pos:sync-upload
    {--batch=100 : Maximum events per upload batch}
    {--all : Keep uploading until outbox is empty}
    {--retry-failed : Re-queue previously failed outbox events}
    {--status : Display queue status before and after upload}',
    function (
        \App\Services\SyncUploadService $uploadService,
        \App\Services\SyncQueueService $queueService,
        \App\Services\DeviceService $deviceService
    ) {
        $deviceId = $deviceService->getDeviceId();
        $batchSize = max(1, (int) $this->option('batch'));
        $drainAll = (bool) $this->option('all');
        $retryFailed = (bool) $this->option('retry-failed');
        $showStatus = (bool) $this->option('status');

        $this->info('=== POS Offline-to-Online Sync Upload ===');
        $this->line("Device ID: <comment>{$deviceId}</comment>");

        if ($showStatus) {
            $stats = $queueService->getQueueStats();
            $this->line('');
            $this->line("<comment>--- Pre-Sync Status ---</comment>");
            $this->line("Pending:     {$stats['pending']}");
            $this->line("Processing:  {$stats['processing']}");
            $this->line("Synced:      {$stats['synced']}");
            $this->line("Failed:      {$stats['failed']}");
            $this->line("Total:       {$stats['total']}");
            $this->line('');
        }

        if ($retryFailed) {
            $retried = $queueService->retryFailed();
            if ($retried > 0) {
                $this->info("Re-queued <comment>{$retried}</comment> failed event(s) for retry.");
            }
        }

        $pendingCount = $queueService->getPendingEvents(1)->count();
        if ($pendingCount === 0) {
            $this->info('No pending events found in outbox. Everything is up to date.');
            return 0;
        }

        $this->line("Starting upload (batch size: {$batchSize})...");

        if ($drainAll) {
            $result = $uploadService->uploadAll($batchSize, maxBatches: 50, retryFailed: false);
        } else {
            $result = $uploadService->uploadPending($batchSize, retryFailed: false);
        }

        if ($result['success']) {
            $this->info("✓ {$result['message']}");
            $this->line("Synced count:      <info>{$result['synced_count']}</info>");
            $this->line("Pending remaining: <comment>{$result['pending_remaining']}</comment>");
        } else {
            $this->error("✗ Sync upload failed: {$result['message']}");
            if (!empty($result['error'])) {
                $this->line("Error code: <comment>{$result['error']}</comment>");
            }
            return 1;
        }

        if ($showStatus) {
            $stats = $queueService->getQueueStats();
            $this->line('');
            $this->line("<comment>--- Post-Sync Status ---</comment>");
            $this->line("Pending:     {$stats['pending']}");
            $this->line("Processing:  {$stats['processing']}");
            $this->line("Synced:      {$stats['synced']}");
            $this->line("Failed:      {$stats['failed']}");
            $this->line("Total:       {$stats['total']}");
            $this->line('');
        }

        return 0;
    }
)->purpose('Upload pending offline POS sync outbox events to the central server');

Artisan::command('pos:sync-download
    {--all : Keep downloading until all remote changes are applied}
    {--batch=100 : Maximum events per download batch}
    {--reset-cursor : Reset download cursor to 0 before pulling}
    {--status : Display cursor status before and after}',
    function (\App\Services\SyncDownloadService $downloadService) {
        $drainAll = (bool) $this->option('all');
        $batchSize = max(1, (int) $this->option('batch'));
        $resetCursor = (bool) $this->option('reset-cursor');
        $showStatus = (bool) $this->option('status');

        $this->info('=== POS Download Synchronization ===');

        if ($resetCursor) {
            $downloadService->resetCursor();
            $this->warn('Download cursor reset to 0 (resync from beginning).');
        }

        $cursorBefore = $downloadService->getStoredCursor();

        if ($showStatus) {
            $this->line("Current download cursor: <comment>{$cursorBefore}</comment>");
        }

        $this->line("Pulling changes from central server (batch size: {$batchSize})...");

        if ($drainAll) {
            $result = $downloadService->downloadAll(batchSize: $batchSize, maxBatches: 50);
        } else {
            $result = $downloadService->downloadPending(batchSize: $batchSize);
        }

        $this->line('');
        if ($result['success']) {
            $this->info("✓ {$result['message']}");
            $this->line("Applied count:  <info>{$result['applied_count']}</info>");
            $this->line("Current cursor: <comment>{$result['current_cursor']}</comment>");
            return 0;
        }

        $this->error("✗ Download failed: {$result['message']}");
        if (!empty($result['error'])) {
            $this->line("Error code: <comment>{$result['error']}</comment>");
        }
        if (!empty($result['errors'])) {
            $this->warn('Failed events:');
            foreach ($result['errors'] as $err) {
                $this->line("  - [{$err['entity_type']} {$err['entity_uuid']}]: {$err['error']}");
            }
        }

        return 1;
    }
)->purpose('Download remote changes from central sync server and apply to local POS');

Artisan::command('pos:sync
    {--all : Keep syncing until outbox is empty and all downloads are caught up}
    {--upload-only : Only upload local pending events}
    {--download-only : Only download remote changes}
    {--batch=100 : Maximum events per batch}
    {--retry-failed : Re-queue failed outbox events before syncing}
    {--reset-cursor : Reset download cursor to 0 before pulling}
    {--status : Display queue and cursor status before and after}',
    function (
        \App\Services\BidirectionalSyncService $syncService,
        \App\Services\SyncDownloadService $downloadService,
        \App\Services\SyncQueueService $queueService
    ) {
        $drainAll = (bool) $this->option('all');
        $uploadOnly = (bool) $this->option('upload-only');
        $downloadOnly = (bool) $this->option('download-only');
        $batchSize = max(1, (int) $this->option('batch'));
        $retryFailed = (bool) $this->option('retry-failed');
        $resetCursor = (bool) $this->option('reset-cursor');
        $showStatus = (bool) $this->option('status');

        $this->info('=== POS Bidirectional Synchronization ===');

        if ($resetCursor) {
            $downloadService->resetCursor();
            $this->warn('Download cursor reset to 0 (full resync enabled).');
        }

        if ($showStatus) {
            $status = $syncService->getStatus();
            $this->line('');
            $this->line('<comment>--- Pre-Sync Status ---</comment>');
            $this->line("Device ID:       <info>{$status['device']['device_id']}</info>");
            $this->line("Outbox Pending:  {$status['outbox']['pending']}");
            $this->line("Outbox Synced:   {$status['outbox']['synced']}");
            $this->line("Outbox Failed:   {$status['outbox']['failed']}");
            $this->line("Download Cursor: {$status['download']['current_cursor']}");
            $this->line("Server URL:      {$status['server_url']}");
            $this->line('');
        }

        if ($retryFailed) {
            $retried = $queueService->retryFailed();
            if ($retried > 0) {
                $this->info("Re-queued <comment>{$retried}</comment> failed outbox event(s).");
            }
        }

        $this->line("Running sync (batch size: {$batchSize})...");

        if ($drainAll) {
            $result = $syncService->syncAll(
                batchSize: $batchSize,
                maxBatches: 50,
                retryFailed: false,
                uploadOnly: $uploadOnly,
                downloadOnly: $downloadOnly
            );
        } else {
            $result = $syncService->sync(
                batchSize: $batchSize,
                retryFailed: false,
                uploadOnly: $uploadOnly,
                downloadOnly: $downloadOnly
            );
        }

        $this->line('');
        if ($result['success']) {
            $this->info("✓ {$result['message']}");
            $this->line("Summary: <comment>{$result['summary']}</comment>");
        } else {
            $this->error("✗ Sync finished with errors: {$result['message']}");
            if (!empty($result['summary'])) {
                $this->line("Summary: <comment>{$result['summary']}</comment>");
            }
        }

        if ($showStatus) {
            $status = $syncService->getStatus();
            $this->line('');
            $this->line('<comment>--- Post-Sync Status ---</comment>');
            $this->line("Device ID:       <info>{$status['device']['device_id']}</info>");
            $this->line("Outbox Pending:  {$status['outbox']['pending']}");
            $this->line("Outbox Synced:   {$status['outbox']['synced']}");
            $this->line("Outbox Failed:   {$status['outbox']['failed']}");
            $this->line("Download Cursor: {$status['download']['current_cursor']}");
            $this->line("Server URL:      {$status['server_url']}");
            $this->line('');
        }

        return $result['success'] ? 0 : 1;
    }
)->purpose('Run bidirectional synchronization (Upload local POS changes and download remote updates)');
