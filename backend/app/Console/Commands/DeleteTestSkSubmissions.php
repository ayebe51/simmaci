<?php

namespace App\Console\Commands;

use App\Models\SkDocument;
use App\Models\ActivityLog;
use Illuminate\Console\Command;

class DeleteTestSkSubmissions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sk:delete-test-submissions 
                            {--nomor_sk= : Specific nomor_sk to delete}
                            {--status=pending : Status of SK to delete (default: pending)}
                            {--school= : Delete SK from specific school (unit_kerja)}
                            {--exclude-names= : Comma-separated names to exclude from deletion}
                            {--created-after= : Delete SK created after this date (Y-m-d format)}
                            {--dry-run : Show what would be deleted without actually deleting}
                            {--force : Skip confirmation prompt}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Delete test SK submissions (safely with confirmation)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $nomorSk = $this->option('nomor_sk');
        $status = $this->option('status');
        $school = $this->option('school');
        $excludeNames = $this->option('exclude-names');
        $createdAfter = $this->option('created-after');
        $dryRun = $this->option('dry-run');
        $force = $this->option('force');

        // Build query
        $query = SkDocument::withoutTenantScope();

        if ($nomorSk) {
            $query->where('nomor_sk', $nomorSk);
        } else {
            // Default: only pending SK with REQ/ prefix (test submissions)
            $query->where('status', $status)
                  ->where('nomor_sk', 'like', 'REQ/%');
        }

        if ($school) {
            $query->where('unit_kerja', 'like', '%' . $school . '%');
        }

        if ($excludeNames) {
            // Parse comma-separated names and exclude them
            $namesToExclude = array_map('trim', explode(',', $excludeNames));
            foreach ($namesToExclude as $name) {
                $query->where('nama', 'not like', '%' . $name . '%');
            }
        }

        if ($createdAfter) {
            $query->whereDate('created_at', '>=', $createdAfter);
        }

        $skDocuments = $query->get();

        if ($skDocuments->isEmpty()) {
            $this->info('No SK documents found matching the criteria.');
            return 0;
        }

        // Display what will be deleted
        $this->info("Found {$skDocuments->count()} SK document(s) to delete:");
        $this->newLine();

        $headers = ['ID', 'Nomor SK', 'Nama', 'Unit Kerja', 'Status', 'Created At'];
        $rows = $skDocuments->map(function ($sk) {
            return [
                $sk->id,
                $sk->nomor_sk,
                $sk->nama,
                $sk->unit_kerja,
                $sk->status,
                $sk->created_at->format('Y-m-d H:i:s'),
            ];
        })->toArray();

        $this->table($headers, $rows);

        if ($dryRun) {
            $this->warn('DRY RUN: No data was deleted.');
            return 0;
        }

        // Confirmation
        if (!$force) {
            if (!$this->confirm('Are you sure you want to delete these SK documents?')) {
                $this->info('Deletion cancelled.');
                return 0;
            }
        }

        // Delete related activity logs first
        $this->info('Deleting related activity logs...');
        $deletedLogs = 0;
        foreach ($skDocuments as $sk) {
            $logs = ActivityLog::where('subject_type', SkDocument::class)
                               ->where('subject_id', $sk->id)
                               ->delete();
            $deletedLogs += $logs;
        }
        $this->info("Deleted {$deletedLogs} activity log(s).");

        // Delete SK documents (soft delete)
        $this->info('Deleting SK documents...');
        $deleted = 0;
        foreach ($skDocuments as $sk) {
            $sk->delete();
            $deleted++;
        }

        $this->info("Successfully deleted {$deleted} SK document(s).");
        $this->newLine();
        $this->info('Note: SK documents are soft-deleted. Use --force-delete to permanently delete.');

        return 0;
    }
}
