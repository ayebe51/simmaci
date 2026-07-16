<?php

namespace App\Console\Commands;

use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Artisan command: sk:link-teachers
 *
 * Memperbaiki sk_documents yang teacher_id-nya NULL dengan cara mencocokkan
 * nama guru (case-insensitive, trimmed) terhadap tabel teachers dalam school yang sama.
 *
 * Dijalankan sekali untuk memperbaiki data historis dari bulk import.
 * Aman dijalankan berkali-kali (idempotent — hanya memproses teacher_id = NULL).
 */
class LinkSkDocumentsToTeachers extends Command
{
    protected $signature = 'sk:link-teachers
                            {--school-id= : Batasi hanya pada school_id tertentu}
                            {--dry-run    : Tampilkan yang akan diupdate tanpa benar-benar menyimpan}
                            {--chunk=100  : Ukuran batch per iterasi}';

    protected $description = 'Tautkan sk_documents yang teacher_id-nya NULL ke record teacher yang cocok berdasarkan nama dan school_id';

    public function handle(): int
    {
        $isDryRun = $this->option('dry-run');
        $schoolId = $this->option('school-id');
        $chunkSize = (int) $this->option('chunk');

        $this->info($isDryRun ? '🔍 DRY RUN — tidak ada perubahan yang disimpan.' : '🔧 Menautkan sk_documents ke teachers...');

        $query = SkDocument::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
            ->whereNull('teacher_id')
            ->whereNotNull('nama')
            ->whereNotNull('school_id');

        if ($schoolId) {
            $query->where('school_id', $schoolId);
        }

        $total = $query->count();
        $this->info("Ditemukan {$total} dokumen SK tanpa teacher_id.");

        if ($total === 0) {
            $this->info('✅ Tidak ada yang perlu diproses.');
            return self::SUCCESS;
        }

        $linked   = 0;
        $notFound = 0;

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $query->chunkById($chunkSize, function ($docs) use (&$linked, &$notFound, $isDryRun, $bar) {
            // Kelompokkan per school agar query teacher efisien
            $bySchool = $docs->groupBy('school_id');

            foreach ($bySchool as $sid => $schoolDocs) {
                // Ambil semua nama yang unik di batch ini untuk satu school
                $names = $schoolDocs->pluck('nama')->map(fn($n) => mb_strtolower(trim($n)))->unique()->values();

                // Satu query untuk semua nama dalam school ini
                $teachers = Teacher::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
                    ->whereRaw('LOWER(TRIM(nama)) IN (' . implode(',', array_fill(0, count($names), '?')) . ')', $names->toArray())
                    ->where('school_id', $sid)
                    ->whereNull('deleted_at')
                    ->get(['id', 'nama'])
                    ->keyBy(fn($t) => mb_strtolower(trim($t->nama)));

                foreach ($schoolDocs as $sk) {
                    $key = mb_strtolower(trim($sk->nama));
                    if (isset($teachers[$key])) {
                        $teacherId = $teachers[$key]->id;
                        if (!$isDryRun) {
                            DB::table('sk_documents')
                                ->where('id', $sk->id)
                                ->update(['teacher_id' => $teacherId]);
                        } else {
                            $this->line("\n  [DRY] SK #{$sk->id} \"{$sk->nama}\" → teacher_id={$teacherId}");
                        }
                        $linked++;
                    } else {
                        $notFound++;
                        $this->line("\n  ⚠️  Tidak ditemukan: \"{$sk->nama}\" (school_id={$sid}, sk_id={$sk->id})");
                    }
                    $bar->advance();
                }
            }
        });

        $bar->finish();
        $this->newLine(2);

        $verb = $isDryRun ? 'Akan ditautkan' : 'Berhasil ditautkan';
        $this->info("✅ {$verb}: {$linked} dokumen");

        if ($notFound > 0) {
            $this->warn("⚠️  Tidak cocok (guru tidak ada di tabel teachers): {$notFound} dokumen");
            $this->warn("   → Kemungkinan nama berbeda/typo, atau guru belum diinput ke Data GTK.");
        }

        return self::SUCCESS;
    }
}
