<?php

namespace App\Console\Commands;

use App\Models\SkDocument;
use App\Models\ActivityLog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class DeleteGeneratedSkData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sk:delete-generated-data 
                            {--status= : Delete SK with specific status (draft, pending, approved, rejected, active, archived)}
                            {--school= : Delete SK from specific school (unit_kerja)}
                            {--jenis= : Delete SK with specific jenis_sk (Pengangkatan, Mutasi, Pemberhentian)}
                            {--exclude-nomor= : Comma-separated nomor_sk to exclude from deletion}
                            {--created-after= : Delete SK created after this date (Y-m-d format)}
                            {--created-before= : Delete SK created before this date (Y-m-d format)}
                            {--with-files : Also delete associated files from storage}
                            {--with-approval-history : Also delete approval history records}
                            {--permanent : Permanently delete (force delete) instead of soft delete}
                            {--dry-run : Show what would be deleted without actually deleting}
                            {--force : Skip confirmation prompt}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Delete generated SK documents from database (with safety options)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $status = $this->option('status');
        $school = $this->option('school');
        $jenisSk = $this->option('jenis');
        $excludeNomor = $this->option('exclude-nomor');
        $createdAfter = $this->option('created-after');
        $createdBefore = $this->option('created-before');
        $withFiles = $this->option('with-files');
        $withApprovalHistory = $this->option('with-approval-history');
        $permanent = $this->option('permanent');
        $dryRun = $this->option('dry-run');
        $force = $this->option('force');

        $this->info('🔍 Searching for SK documents to delete...');
        $this->newLine();

        // Build query — bypass tenant scope since this runs via Artisan (no auth context)
        $query = SkDocument::withoutTenantScope();

        // Apply filters
        if ($status) {
            $query->where('status', $status);
        }

        if ($school) {
            $query->where('unit_kerja', 'like', '%' . $school . '%');
        }

        if ($jenisSk) {
            $query->where('jenis_sk', $jenisSk);
        }

        if ($excludeNomor) {
            $namesToExclude = array_map('trim', explode(',', $excludeNomor));
            $query->whereNotIn('nomor_sk', $namesToExclude);
        }

        if ($createdAfter) {
            $query->whereDate('created_at', '>=', $createdAfter);
        }

        if ($createdBefore) {
            $query->whereDate('created_at', '<=', $createdBefore);
        }

        $skDocuments = $query->get();

        if ($skDocuments->isEmpty()) {
            $this->info('✅ No SK documents found matching the criteria.');
            return 0;
        }

        // Display what will be deleted
        $this->warn("⚠️  Found {$skDocuments->count()} SK document(s) to delete:");
        $this->newLine();

        $headers = ['ID', 'Nomor SK', 'Jenis SK', 'Nama', 'Unit Kerja', 'Status', 'Created At'];
        $rows = $skDocuments->map(function ($sk) {
            return [
                $sk->id,
                $sk->nomor_sk,
                $sk->jenis_sk,
                $sk->nama,
                $sk->unit_kerja ?? '-',
                $sk->status,
                $sk->created_at->format('Y-m-d H:i:s'),
            ];
        })->toArray();

        $this->table($headers, $rows);
        $this->newLine();

        // Show what will be deleted
        $this->info('📋 Deletion plan:');
        $this->line("  • SK Documents: {$skDocuments->count()} records");
        
        if ($withFiles) {
            $filesCount = $skDocuments->filter(fn($sk) => $sk->file_url || $sk->surat_permohonan_url || $sk->ijazah_url)->count();
            $this->line("  • Associated Files: ~{$filesCount} files from storage");
        }

        if ($withApprovalHistory) {
            $approvalCount = DB::table('approval_histories')
                ->whereIn('document_id', $skDocuments->pluck('id'))
                ->where('document_type', 'sk_document')
                ->count();
            $this->line("  • Approval History: {$approvalCount} records");
        }

        $activityLogCount = ActivityLog::where('subject_type', SkDocument::class)
            ->whereIn('subject_id', $skDocuments->pluck('id'))
            ->count();
        $this->line("  • Activity Logs: {$activityLogCount} records");

        if ($permanent) {
            $this->error('  ⚠️  PERMANENT DELETE: Data cannot be recovered!');
        } else {
            $this->info('  ℹ️  Soft Delete: Data can be recovered from deleted_at records');
        }

        $this->newLine();

        if ($dryRun) {
            $this->warn('🔍 DRY RUN: No data was deleted.');
            return 0;
        }

        // Confirmation
        if (!$force) {
            $confirmMessage = $permanent 
                ? 'Are you ABSOLUTELY SURE you want to PERMANENTLY delete these SK documents? This cannot be undone!'
                : 'Are you sure you want to delete these SK documents?';

            if (!$this->confirm($confirmMessage)) {
                $this->info('❌ Deletion cancelled.');
                return 0;
            }

            if ($permanent) {
                if (!$this->confirm('Type "DELETE PERMANENTLY" to confirm', false)) {
                    $this->info('❌ Deletion cancelled.');
                    return 0;
                }
            }
        }

        $this->newLine();
        $this->info('🗑️  Starting deletion process...');
        $this->newLine();

        // Delete associated files
        if ($withFiles) {
            $this->info('📁 Deleting associated files from storage...');
            $deletedFiles = 0;
            
            foreach ($skDocuments as $sk) {
                $filesToDelete = array_filter([
                    $sk->file_url,
                    $sk->surat_permohonan_url,
                    $sk->ijazah_url,
                ]);

                foreach ($filesToDelete as $fileUrl) {
                    // Extract path from URL
                    $path = $this->extractStoragePath($fileUrl);
                    if ($path && Storage::disk('s3')->exists($path)) {
                        Storage::disk('s3')->delete($path);
                        $deletedFiles++;
                    }
                }
            }
            
            $this->info("   ✓ Deleted {$deletedFiles} file(s) from storage");
        }

        // Delete approval history
        if ($withApprovalHistory) {
            $this->info('📜 Deleting approval history records...');
            $deletedApprovals = DB::table('approval_histories')
                ->whereIn('document_id', $skDocuments->pluck('id'))
                ->where('document_type', 'sk_document')
                ->delete();
            $this->info("   ✓ Deleted {$deletedApprovals} approval history record(s)");
        }

        // Delete activity logs
        $this->info('📝 Deleting activity logs...');
        $deletedLogs = ActivityLog::where('subject_type', SkDocument::class)
            ->whereIn('subject_id', $skDocuments->pluck('id'))
            ->delete();
        $this->info("   ✓ Deleted {$deletedLogs} activity log(s)");

        // Delete SK documents
        $deleteType = $permanent ? 'Permanently deleting' : 'Soft deleting';
        $this->info("📄 {$deleteType} SK documents...");
        
        $deleted = 0;
        foreach ($skDocuments as $sk) {
            if ($permanent) {
                $sk->forceDelete();
            } else {
                $sk->delete();
            }
            $deleted++;
        }

        $this->newLine();
        $this->info("✅ Successfully deleted {$deleted} SK document(s)!");
        
        if (!$permanent) {
            $this->newLine();
            $this->comment('💡 Tip: SK documents are soft-deleted. To permanently delete, use --permanent flag.');
            $this->comment('💡 To restore soft-deleted records, use: SkDocument::withTrashed()->restore()');
        }

        return 0;
    }

    /**
     * Extract storage path from URL
     */
    private function extractStoragePath(string $url): ?string
    {
        // Handle MinIO proxy URLs: https://simmaci.com/api/minio/simmaci-storage/path/to/file
        if (str_contains($url, '/api/minio/')) {
            $parts = explode('/api/minio/', $url);
            return $parts[1] ?? null;
        }

        // Handle direct MinIO URLs: https://minio.simmaci.com/simmaci-storage/path/to/file
        if (str_contains($url, '/simmaci-storage/')) {
            $parts = explode('/simmaci-storage/', $url);
            return 'simmaci-storage/' . ($parts[1] ?? '');
        }

        // Handle storage URLs: /storage/path/to/file
        if (str_starts_with($url, '/storage/')) {
            return str_replace('/storage/', '', $url);
        }

        return null;
    }
}
