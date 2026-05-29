<?php

namespace App\Console\Commands;

use App\Models\SkDocument;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RevertSkWithoutNim extends Command
{
    protected $signature = 'sk:revert-without-nim
                            {--dry-run : Preview perubahan tanpa menyimpan}
                            {--school= : Filter berdasarkan school_id}
                            {--include-zero : Sertakan guru dengan NIM = "0"}';

    protected $description = 'Revert pengajuan SK yang sudah approved tapi guru-nya belum punya NIM (atau NIM = 0) ke status draft';

    public function handle(): int
    {
        $dryRun      = $this->option('dry-run');
        $schoolId    = $this->option('school');
        $includeZero = $this->option('include-zero');

        if ($dryRun) {
            $this->warn('DRY RUN — tidak ada perubahan yang disimpan.');
            $this->newLine();
        }

        // Query SK documents with status approved/active
        $query = SkDocument::withoutTenantScope()
            ->with(['teacher', 'school'])
            ->whereIn('status', ['approved', 'Approved', 'active', 'Active']);

        if ($schoolId) {
            $query->where('school_id', $schoolId);
            $this->line("<fg=cyan>Filter school_id: {$schoolId}</>");
            $this->newLine();
        }

        $allDocuments = $query->get();

        // Filter: teacher has no NIM or NIM is "0"
        $documents = $allDocuments->filter(function ($sk) use ($includeZero) {
            $teacher = $sk->teacher;

            // No teacher linked — include
            if (!$teacher) {
                return true;
            }

            $nim = trim($teacher->nomor_induk_maarif ?? '');

            // NIM kosong
            if ($nim === '') {
                return true;
            }

            // NIM = "0" (jika opsi --include-zero aktif, default aktif)
            if ($includeZero && $nim === '0') {
                return true;
            }

            return false;
        });

        if ($documents->isEmpty()) {
            $this->info('Tidak ada pengajuan SK approved tanpa NIM yang ditemukan.');
            return self::SUCCESS;
        }

        $this->info("Ditemukan <fg=yellow>{$documents->count()}</> pengajuan SK approved tanpa NIM:");
        $this->newLine();

        // Group by reason for clarity
        $noTeacher = $documents->filter(fn($sk) => !$sk->teacher);
        $emptyNim  = $documents->filter(fn($sk) => $sk->teacher && trim($sk->teacher->nomor_induk_maarif ?? '') === '');
        $zeroNim   = $documents->filter(fn($sk) => $sk->teacher && trim($sk->teacher->nomor_induk_maarif ?? '') === '0');

        if ($noTeacher->isNotEmpty()) {
            $this->line("  • Tanpa relasi teacher: <fg=red>{$noTeacher->count()}</>");
        }
        if ($emptyNim->isNotEmpty()) {
            $this->line("  • NIM kosong: <fg=red>{$emptyNim->count()}</>");
        }
        if ($zeroNim->isNotEmpty()) {
            $this->line("  • NIM = \"0\": <fg=red>{$zeroNim->count()}</>");
        }
        $this->newLine();

        // Display table
        $tableData = $documents->map(fn($sk) => [
            $sk->id,
            $sk->nomor_sk ?? '-',
            mb_substr($sk->nama ?? '-', 0, 30),
            mb_substr($sk->unit_kerja ?? '-', 0, 25),
            $sk->status,
            $sk->teacher ? ($sk->teacher->nomor_induk_maarif ?: '<kosong>') : '<no teacher>',
            $sk->school?->nama ?? '-',
        ])->toArray();

        $this->table(
            ['ID', 'Nomor SK', 'Nama', 'Unit Kerja', 'Status', 'NIM', 'Sekolah'],
            $tableData
        );

        if ($dryRun) {
            $this->newLine();
            $this->warn('[DRY RUN] Tidak ada perubahan yang dilakukan.');
            return self::SUCCESS;
        }

        if (!$this->confirm("Revert {$documents->count()} pengajuan SK ke status draft?")) {
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

        $this->newLine();
        $this->info("Berhasil mengembalikan <fg=green>{$updated}</> pengajuan SK ke status draft.");

        return self::SUCCESS;
    }
}
