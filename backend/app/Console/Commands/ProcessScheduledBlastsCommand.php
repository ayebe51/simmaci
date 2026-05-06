<?php

namespace App\Console\Commands;

use App\Jobs\SendBlastJob;
use App\Models\WaBlast;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * ProcessScheduledBlastsCommand
 *
 * Artisan command that runs every minute via the Laravel Scheduler.
 * Queries WaBlast records with blast_status = 'scheduled' and scheduled_at <= now(),
 * updates their status to 'sending', and dispatches SendBlastJob for each.
 */
class ProcessScheduledBlastsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'wa-blast:process-scheduled';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Process scheduled WA blasts that are due for sending';

    /**
     * Execute the console command.
     */
    public function handle(): void
    {
        $dueBlasts = WaBlast::where('blast_status', 'scheduled')
            ->where('scheduled_at', '<=', now())
            ->get();

        if ($dueBlasts->isEmpty()) {
            $this->info('No scheduled blasts due for sending.');
            return;
        }

        $dispatched = 0;

        foreach ($dueBlasts as $blast) {
            // Update status to sending before dispatching
            $blast->update(['blast_status' => 'sending']);

            SendBlastJob::dispatch($blast->id);

            $dispatched++;
        }

        $message = "Dispatched {$dispatched} scheduled blast(s) for sending.";
        $this->info($message);
        Log::info("ProcessScheduledBlastsCommand: {$message}");
    }
}
