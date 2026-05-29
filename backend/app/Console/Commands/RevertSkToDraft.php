<?php

namespace App\Console\Commands;

use App\Models\SkDocument;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RevertSkToDraft extends Command
{
    protected $signature = 'sk:revert-to-draft
                            {--dry-run : Show what would be changed without making changes}
                            {--all-status : Search all non-draft statuses (not just approved/active)}';

    protected $description = 'Revert SK submissions with empty NIM and TMT back to draft status';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        $allStatus = $this->option('all-status');

        // Find SK documents where:
        // 1. Status is approved/active (or any non-draft if --all-status)
        // 2. Either teacher_id is NULL, OR the linked teacher has empty NIM AND/OR empty TMT
        $query = SkDocument::withoutTenantScope()->with('teacher');

        if ($allStatus) {
            $query->whereNotIn('status', ['draft', 'Draft']);
        } else {
            $query->whereIn('status', ['approved', 'Approved', 'active', 'Active']);
        }

        // Get all matching SK documents, then filter in PHP for more reliable empty checks
        $allDocuments = $query->get();

        $documents = $allDocuments->filter(function ($sk) {
            $teacher = $sk->teacher;

            // No teacher linked
            if (!$teacher) {
                return true;
            }

            $nim = trim($teacher->nomor_induk_maarif ?? '');
            $tmt = trim((string) ($teacher->tmt ?? ''));

            // Both NIM and TMT are empty
            return empty($nim) && empty($tmt);
        });

        if ($documents->isEmpty()) {
            $this->info('Tidak ada permohonan SK dengan NIM kosong DAN TMT kosong yang perlu di-revert.');
            return self::SUCCESS;
        }

        $this->info("Ditemukan {$documents->count()} permohonan SK dengan NIM kosong dan TMT kosong:");
        $this->newLine();

        $tableData = $documents->map(fn($sk) => [
            $sk->id,
            $sk->nomor_sk,
            $sk->nama,
            $sk->unit_kerja,
            $sk->status,
            $sk->teacher ? ($sk->teacher->nomor_induk_maarif ?: '-') : 'No Teacher',
            $sk->teacher ? ($sk->teacher->tmt ?: '-') : 'No Teacher',
        ])->toArray();

        $this->table(
            ['ID', 'Nomor SK', 'Nama', 'Unit Kerja', 'Status', 'NIM', 'TMT'],
            $tableData
        );

        if ($dryRun) {
            $this->warn('[DRY RUN] Tidak ada perubahan yang dilakukan.');
            return self::SUCCESS;
        }

        if (!$this->confirm("Apakah Anda yakin ingin mengembalikan {$documents->count()} permohonan SK ke status draft?")) {
            $this->info('Dibatalkan.');
            return self::SUCCESS;
        }

        $updated = 0;
        DB::transaction(function () use ($documents, &$updated) {
            foreach ($documents as $sk) {
                $sk->update(['status' => 'draft']);
                $updated++;
            }
        });

        $this->info("Berhasil mengembalikan {$updated} permohonan SK ke status draft.");

        return self::SUCCESS;
    }
}
