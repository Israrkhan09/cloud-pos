<?php

namespace App\Console\Commands;

use App\Services\CentralEventProcessor;
use Illuminate\Console\Command;

class SyncProcessCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'pos:sync-process
                            {--device= : Specific device ID to process events for}
                            {--limit=100 : Maximum events to process in this run}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Process received sync events into central database business tables';

    /**
     * Execute the console command.
     */
    public function handle(CentralEventProcessor $processor): int
    {
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

        return $result['failed'] === 0 ? Command::SUCCESS : Command::FAILURE;
    }
}
