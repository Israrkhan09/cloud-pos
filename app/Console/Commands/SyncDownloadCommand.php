<?php

namespace App\Console\Commands;

use App\Services\SyncDownloadService;
use Illuminate\Console\Command;

class SyncDownloadCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'pos:sync-download
                            {--all : Keep downloading until all remote changes are applied}
                            {--batch=100 : Maximum events per download batch}
                            {--reset-cursor : Reset download cursor to 0 before pulling}
                            {--status : Display cursor status before and after}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Download remote changes from central sync server and apply to local POS';

    /**
     * Execute the console command.
     */
    public function handle(SyncDownloadService $downloadService): int
    {
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
            return Command::SUCCESS;
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

        return Command::FAILURE;
    }
}
