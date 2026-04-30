<?php

namespace App\Console\Commands;

use App\Models\School;
use App\Models\SkDocument;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DeleteSkBySchoolName extends Command
{
    protected $signature = 'sk:delete-by-school
                            {name : Nama sekolah (partial match)}
                            {--force : Lewati konfirmasi interaktif}';

    protected $description = 'Hard delete semua SK (termasuk approval history) milik sekolah tertentu';

    public function handle(): int
    {
        $name = $this->argument('name');

        // Cari sekolah yang cocok
        $schools = School::withTrashed()
            ->where('nama', 'ilike', "%{$name}%")
            ->get(['id', 'nama']);

        if ($schools->isEmpty()) {
            $this->error("Tidak ada sekolah yang cocok dengan nama: \"{$name}\"");
            return self::FAILURE;
        }

        // Tampilkan daftar sekolah yang ditemukan
        $this->info("Sekolah yang ditemukan:");
        $this->table(['ID', 'Nama'], $schools->map(fn($s) => [$s->id, $s->nama]));

        // Hitung SK per sekolah
        $schoolIds = $schools->pluck('id');
        $skCount = SkDocument::withTrashed()
            ->whereIn('school_id', $schoolIds)
            ->count();

        $skIds = SkDocument::withTrashed()
            ->whereIn('school_id', $schoolIds)
            ->pluck('id');

        $approvalCount = DB::table('approval_histories')
            ->whereIn('document_id', $skIds)
            ->where('document_type', 'sk_document')
            ->count();

        $this->warn("Data yang akan dihapus PERMANEN:");
        $this->line("  - SK Documents : {$skCount} record");
        $this->line("  - Approval History : {$approvalCount} record");
        $this->newLine();

        if ($skCount === 0) {
            $this->info("Tidak ada SK yang perlu dihapus.");
            return self::SUCCESS;
        }

        // Konfirmasi
        if (!$this->option('force')) {
            if (!$this->confirm("Lanjutkan hard delete? Operasi ini TIDAK BISA di-undo.", false)) {
                $this->info("Dibatalkan.");
                return self::SUCCESS;
            }
        }

        // Eksekusi dalam transaksi
        DB::transaction(function () use ($schoolIds, $skCount, $approvalCount) {
            // 1. Ambil semua SK ID milik sekolah ini
            $skIds = SkDocument::withTrashed()
                ->whereIn('school_id', $schoolIds)
                ->pluck('id');

            // 2. Hapus approval history berdasarkan document_id
            $deletedApprovals = DB::table('approval_histories')
                ->whereIn('document_id', $skIds)
                ->where('document_type', 'sk_document')
                ->delete();

            // 3. Hard delete SK (termasuk yang sudah soft-deleted)
            $deletedSk = SkDocument::withTrashed()
                ->whereIn('school_id', $schoolIds)
                ->forceDelete();

            $this->info("Selesai:");
            $this->line("  - SK Documents dihapus  : {$deletedSk}");
            $this->line("  - Approval History dihapus : {$deletedApprovals}");
        });

        return self::SUCCESS;
    }
}
