<?php

namespace App\Console\Commands;

use App\Services\DeviceService;
use App\Services\SyncQueueService;
use App\Services\SyncUploadService;
use Illuminate\Console\Command;

class SyncUploadCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'pos:sync-upload
                            {--batch=100 : Maximum events per upload batch}
                            {--all : Keep uploading until outbox is empty}
                            {--retry-failed : Re-queue previously failed outbox events}
                            {--status : Display queue status before and after upload}
                            {--business= : Override canonical business ID for upload}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Upload pending offline POS sync outbox events to the central server';

    /**
     * Execute the console command.
     */
    public function handle(
        SyncUploadService $uploadService,
        SyncQueueService $queueService,
        DeviceService $deviceService
    ): int {
        $businessOption = $this->option('business');
        if (!empty($businessOption)) {
            app(\App\Services\TenantContext::class)->setBusinessId((string) $businessOption);
            session(['active_business_id' => (string) $businessOption]);
        }

        $deviceId = $deviceService->getDeviceId();
        $batchSize = max(1, (int) $this->option('batch'));
        $drainAll = (bool) $this->option('all');
        $retryFailed = (bool) $this->option('retry-failed');
        $showStatus = (bool) $this->option('status');

        $this->info('=== POS Offline-to-Online Sync Upload ===');
        $this->line("Device ID: <comment>{$deviceId}</comment>");

        if ($showStatus) {
            $this->displayStats('Pre-Sync Status', $queueService->getQueueStats());
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
            return Command::SUCCESS;
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
            return Command::FAILURE;
        }

        if ($showStatus) {
            $this->displayStats('Post-Sync Status', $queueService->getQueueStats());
        }

        return Command::SUCCESS;
    }

    protected function displayStats(string $title, array $stats): void
    {
        $this->line('');
        $this->line("<comment>--- {$title} ---</comment>");
        $this->line("Pending:     {$stats['pending']}");
        $this->line("Processing:  {$stats['processing']}");
        $this->line("Synced:      {$stats['synced']}");
        $this->line("Failed:      {$stats['failed']}");
        $this->line("Total:       {$stats['total']}");
        $this->line('');
    }
}
