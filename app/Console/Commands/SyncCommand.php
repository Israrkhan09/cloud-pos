<?php

namespace App\Console\Commands;

use App\Services\BidirectionalSyncService;
use App\Services\SyncDownloadService;
use App\Services\SyncQueueService;
use Illuminate\Console\Command;

class SyncCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'pos:sync
                            {--all : Keep syncing until outbox is empty and all downloads are caught up}
                            {--upload-only : Only upload local pending events}
                            {--download-only : Only download remote changes}
                            {--batch=100 : Maximum events per batch}
                            {--retry-failed : Re-queue failed outbox events before syncing}
                            {--reset-cursor : Reset download cursor to 0 before pulling}
                            {--status : Display queue and cursor status before and after}
                            {--business= : Override canonical business ID for sync}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Run bidirectional synchronization (Upload local POS changes and download remote updates)';

    /**
     * Execute the console command.
     */
    public function handle(
        BidirectionalSyncService $syncService,
        SyncDownloadService $downloadService,
        SyncQueueService $queueService
    ): int {
        $businessOption = $this->option('business');
        if (!empty($businessOption)) {
            app(\App\Services\TenantContext::class)->setBusinessId((string) $businessOption);
            session(['active_business_id' => (string) $businessOption]);
        }
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
            $this->displayStatus('Pre-Sync Status', $syncService->getStatus());
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
            $this->displayStatus('Post-Sync Status', $syncService->getStatus());
        }

        return $result['success'] ? Command::SUCCESS : Command::FAILURE;
    }

    protected function displayStatus(string $title, array $status): void
    {
        $this->line('');
        $this->line("<comment>--- {$title} ---</comment>");
        $this->line("Device ID:       <info>{$status['device']['device_id']}</info>");
        $this->line("Outbox Pending:  {$status['outbox']['pending']}");
        $this->line("Outbox Synced:   {$status['outbox']['synced']}");
        $this->line("Outbox Failed:   {$status['outbox']['failed']}");
        $this->line("Download Cursor: {$status['download']['current_cursor']}");
        $this->line("Server URL:      {$status['server_url']}");
        $this->line('');
    }
}
