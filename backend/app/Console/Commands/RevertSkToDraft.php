<?php

namespace App\Console\Commands;

use App\Models\SkDocument;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RevertSkToDraft extends Command
{
    protected $signature = 'sk:revert-to-draft
                            {--dry-run : Show what would be changed without making changes}';

    protected $description = 'Revert SK submissions with empty NIM and TMT back to draft status';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');

        // Find SK documents where:
        // 1. Status is approved (target: revert approved ones with missing data)
        // 2. Either teacher_id is NULL, OR the linked teacher has empty NIM AND empty TMT
        $query = SkDocument::withoutTenantScope()
            ->whereIn('status', ['approved', 'Approved', 'active', 'Active'])
            ->where(function ($q) {
                // No teacher linked at all
                $q->whereNull('teacher_id')
                    // OR teacher exists but both NIM and TMT are empty
                    ->orWhereHas('teacher', function ($tq) {
                        $tq->where(function ($inner) {
                            $inner->whereNull('nomor_induk_maarif')
                                ->orWhere('nomor_induk_maarif', '');
                        })->where(function ($inner) {
                            $inner->whereNull('tmt')
                                ->orWhere('tmt', '');
                        });
                    });
            });

        $documents = $query->get();

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
            $sk->jenis_sk,
        ])->toArray();

        $this->table(
            ['ID', 'Nomor SK', 'Nama', 'Unit Kerja', 'Status Saat Ini', 'Jenis SK'],
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
