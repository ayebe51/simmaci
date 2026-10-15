<?php

namespace App\Console\Commands;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CheckDeletedTeachersWithSk extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'teachers:check-deleted-sk
                            {--school=Kalisabuk : Kata kunci nama sekolah atau ID sekolah (default: Kalisabuk)}
                            {--restore          : Pulihkan (restore) guru yang terhapus}
                            {--dry-run          : Simulasi proses restore tanpa mengubah database}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Cek apakah ada data guru yang dihapus (soft-deleted) dari sekolah tertentu dan memiliki dokumen SK';

    public function handle(): int
    {
        $schoolFilter = $this->option('school') ?: 'Kalisabuk';
        $doRestore    = (bool) $this->option('restore');
        $isDryRun     = (bool) $this->option('dry-run');

        $this->newLine();
        $this->line('<fg=cyan;options=bold>╔════════════════════════════════════════════════════════════════════════╗</>');
        $this->line('<fg=cyan;options=bold>║   CEK DATA GURU TERHAPUS & STATUS DOKUMEN SK (SIMMACI)               ║</>');
        $this->line('<fg=cyan;options=bold>╚════════════════════════════════════════════════════════════════════════╝</>');
        $this->newLine();

        // 1. Cari data sekolah berdasarkan ID atau Keyword
        $schoolsQuery = School::withTrashed();
        if (is_numeric($schoolFilter)) {
            $schoolsQuery->where('id', (int) $schoolFilter);
        } else {
            $schoolsQuery->whereRaw('LOWER(nama) LIKE ?', ['%' . strtolower($schoolFilter) . '%']);
        }

        $schools = $schoolsQuery->get();

        if ($schools->isEmpty()) {
            $this->error("❌ Sekolah dengan pencarian '{$schoolFilter}' tidak ditemukan di database.");
            return self::FAILURE;
        }

        $this->info("Ditemukan " . $schools->count() . " sekolah yang cocok dengan filter '{$schoolFilter}':");
        foreach ($schools as $sch) {
            $status = $sch->deleted_at ? "<fg=red>[TERHAPUS: {$sch->deleted_at}]</>" : "<fg=green>[AKTIF]</>";
            $this->line("  • ID: <fg=white;options=bold>{$sch->id}</> | Nama: <fg=white;options=bold>{$sch->nama}</> | NPSN: {$sch->npsn} | Kecamatan: {$sch->kecamatan} {$status}");
        }
        $this->newLine();

        $schoolIds = $schools->pluck('id')->toArray();
        $schoolNames = $schools->pluck('nama')->toArray();

        $lowerFilter = strtolower($schoolFilter);

        // 2. Cari semua guru terkait sekolah ini (baik via school_id maupun unit_kerja)
        // A. Guru Aktif
        $activeTeachers = Teacher::withoutTenantScope()
            ->where(function ($q) use ($schoolIds, $lowerFilter) {
                $q->whereIn('school_id', $schoolIds)
                  ->orWhereRaw('LOWER(unit_kerja) LIKE ?', ["%{$lowerFilter}%"]);
            })
            ->select(['id', 'nama', 'nuptk', 'nomor_induk_maarif', 'nip', 'unit_kerja', 'school_id', 'is_active', 'deleted_at'])
            ->get();

        // B. Guru Terhapus (Soft-Deleted)
        $deletedTeachers = Teacher::withoutTenantScope()
            ->onlyTrashed()
            ->where(function ($q) use ($schoolIds, $lowerFilter) {
                $q->whereIn('school_id', $schoolIds)
                  ->orWhereRaw('LOWER(unit_kerja) LIKE ?', ["%{$lowerFilter}%"]);
            })
            ->select(['id', 'nama', 'nuptk', 'nomor_induk_maarif', 'nip', 'unit_kerja', 'school_id', 'is_active', 'deleted_at'])
            ->get();

        $this->line("Statistik Guru:");
        $this->line("  • Guru Aktif di Database   : <fg=green;options=bold>{$activeTeachers->count()}</> guru");
        $this->line("  • Guru yang TERHAPUS (Soft-Deleted): <fg=" . ($deletedTeachers->count() > 0 ? "red;options=bold" : "white") . ">{$deletedTeachers->count()}</> guru");
        $this->newLine();

        // 3. Periksa Dokumen SK untuk Guru yang Terhapus
        $deletedWithSk = [];
        $deletedWithoutSk = [];

        foreach ($deletedTeachers as $dt) {
            // Ambil semua SK yang berelasi dengan teacher_id ini atau nama yang cocok
            $sks = SkDocument::withoutTenantScope()
                ->withTrashed()
                ->where(function ($q) use ($dt, $schoolIds) {
                    $q->where('teacher_id', $dt->id)
                      ->orWhere(function ($sub) use ($dt, $schoolIds) {
                          $sub->whereRaw('LOWER(TRIM(nama)) = ?', [strtolower(trim($dt->nama))])
                              ->whereIn('school_id', $schoolIds);
                      });
                })
                ->get();

            $dt->sk_items = $sks;

            if ($sks->isNotEmpty()) {
                $deletedWithSk[] = $dt;
            } else {
                $deletedWithoutSk[] = $dt;
            }
        }

        // 4. Periksa Dokumen SK di Sekolah ini yang Teacher-nya NULL atau Mengarah ke Guru Terhapus
        $sksAtSchool = SkDocument::withoutTenantScope()
            ->withTrashed()
            ->where(function ($q) use ($schoolIds, $lowerFilter) {
                $q->whereIn('school_id', $schoolIds)
                  ->orWhereRaw('LOWER(unit_kerja) LIKE ?', ["%{$lowerFilter}%"]);
            })
            ->get();

        $sksWithDeletedTeacher = [];
        $sksWithNullTeacher = [];
        $sksWithActiveTeacher = [];

        foreach ($sksAtSchool as $sk) {
            if (empty($sk->teacher_id)) {
                $sksWithNullTeacher[] = $sk;
                continue;
            }

            $teacher = Teacher::withoutTenantScope()->withTrashed()->find($sk->teacher_id);
            if (! $teacher) {
                $sksWithNullTeacher[] = $sk;
            } elseif ($teacher->trashed()) {
                $sk->setAttribute('deleted_teacher', $teacher);
                $sksWithDeletedTeacher[] = $sk;
            } else {
                $sksWithActiveTeacher[] = $sk;
            }
        }

        // Tampilkan Ringkasan Temuan
        $this->line('<fg=yellow;options=bold>════════════════════════════════════════════════════════════════════════</>');
        $this->line('<fg=yellow;options=bold>  HASIL TEMUAN GURU TERHAPUS & STATUS DOKUMEN SK                        </>');
        $this->line('<fg=yellow;options=bold>════════════════════════════════════════════════════════════════════════</>');

        $this->table(
            ['Kategori Pemeriksaan', 'Jumlah', 'Keterangan'],
            [
                [
                    'Total Guru Terhapus (Soft-Deleted)',
                    $deletedTeachers->count(),
                    $deletedTeachers->count() > 0 ? '<fg=red>Ada data guru yang terhapus</>' : '<fg=green>Nihil (Tidak ada guru terhapus)</>'
                ],
                [
                    'Guru Terhapus yang MEMILIKI Dokumen SK',
                    count($deletedWithSk),
                    count($deletedWithSk) > 0 ? '<fg=red;options=bold>DOKUMEN SK MENJADI YATIM / KEHILANGAN GURU</>' : '<fg=green>Nihil</>'
                ],
                [
                    'Guru Terhapus TANPA Dokumen SK',
                    count($deletedWithoutSk),
                    count($deletedWithoutSk) > 0 ? '<fg=yellow>Data lama/duplikat terhapus</>' : '<fg=green>Nihil</>'
                ],
                [
                    'Total Dokumen SK Terdaftar di Sekolah Ini',
                    $sksAtSchool->count(),
                    'Dokumen SK yang tercatat di database'
                ],
                [
                    'Dokumen SK yang Gurunya Aktif',
                    count($sksWithActiveTeacher),
                    '<fg=green>Normal</>'
                ],
                [
                    'Dokumen SK yang Gurunya Terhapus (Soft-Deleted)',
                    count($sksWithDeletedTeacher),
                    count($sksWithDeletedTeacher) > 0 ? '<fg=red;options=bold>Perlu Dipulihkan / Dikaitkan Ulang</>' : '<fg=green>Nihil</>'
                ],
                [
                    'Dokumen SK yang teacher_id-nya NULL',
                    count($sksWithNullTeacher),
                    count($sksWithNullTeacher) > 0 ? '<fg=yellow>Belum terhubung ke guru</>' : '<fg=green>Nihil</>'
                ],
            ]
        );

        $this->newLine();

        // 5. Tampilkan Rincian Jika Ditemukan Guru Terhapus dengan SK
        if (count($deletedWithSk) > 0) {
            $this->line('<fg=red;options=bold>▶ DAFTAR GURU TERHAPUS YANG MEMILIKI DOKUMEN SK (' . count($deletedWithSk) . ' GURU):</>');
            $this->newLine();

            foreach ($deletedWithSk as $dt) {
                $this->line("───────────────────────────────────────────────────────────────────────");
                $this->line("  ID Guru       : <fg=white;options=bold>{$dt->id}</>");
                $this->line("  Nama          : <fg=white;options=bold>{$dt->nama}</>");
                $this->line("  NUPTK         : " . ($dt->nuptk ?: '-'));
                $this->line("  NIM           : " . ($dt->nomor_induk_maarif ?: '-'));
                $this->line("  NIP           : " . ($dt->nip ?: '-'));
                $this->line("  Unit Kerja    : " . ($dt->unit_kerja ?: '-'));
                $this->line("  Waktu Dihapus : <fg=red>{$dt->deleted_at}</>");
                $this->line("  Daftar Dokumen SK Terkait:");

                /** @var \Illuminate\Support\Collection $sks */
                $sks = $dt->sk_items ?? collect();
                foreach ($sks as $sk) {
                    $skStatus = $sk->deleted_at ? "<fg=red>[SK Dihapus: {$sk->deleted_at}]</>" : "<fg=green>[Status: {$sk->status}]</>";
                    $this->line("    • [SK ID #{$sk->id}] Nomor: <fg=yellow>{$sk->nomor_sk}</> | Jenis: {$sk->jenis_sk} | Jabatan: {$sk->jabatan} {$skStatus}");
                }
                $this->newLine();
            }
        }

        // 6. Tampilkan Guru Terhapus Tanpa SK
        if (count($deletedWithoutSk) > 0) {
            $this->line('<fg=yellow;options=bold>▶ DAFTAR GURU TERHAPUS TANPA DOKUMEN SK (' . count($deletedWithoutSk) . ' GURU):</>');
            $rows = [];
            foreach ($deletedWithoutSk as $dt) {
                $rows[] = [
                    $dt->id,
                    $dt->nama,
                    $dt->nuptk ?: ($dt->nomor_induk_maarif ?: '-'),
                    $dt->unit_kerja ?: '-',
                    $dt->deleted_at,
                ];
            }
            $this->table(['ID Guru', 'Nama Guru', 'NUPTK / NIM', 'Unit Kerja', 'Waktu Dihapus'], $rows);
            $this->newLine();
        }

        // 7. Jika tidak ada guru yang terhapus sama sekali
        if ($deletedTeachers->isEmpty()) {
            $this->info("✅ TIDAK ADA data guru dari '{$schoolFilter}' yang berstatus dihapus (soft-deleted).");
            $this->info("   Semua {$activeTeachers->count()} data guru dalam status aktif.");
            $this->newLine();
            return self::SUCCESS;
        }

        // 8. Opsi Pemulihan (Restore)
        if ($doRestore) {
            $this->line('<fg=cyan;options=bold>── Proses Pemulihan (Restore) ──────────────────────────────────────────</>');
            if ($isDryRun) {
                $this->warn('🔍 MODE SIMULASI (DRY-RUN): Tidak ada perubahan yang disimpan ke database.');
            } else {
                if (! $this->confirm("Apakah Anda yakin ingin memulihkan {$deletedTeachers->count()} guru yang terhapus ini?", false)) {
                    $this->info("Pemulihan dibatalkan.");
                    return self::SUCCESS;
                }
            }

            $restoredCount = 0;
            foreach ($deletedTeachers as $dt) {
                if (! $isDryRun) {
                    Teacher::withTrashed()->where('id', $dt->id)->restore();
                }
                $prefix = $isDryRun ? '[DRY-RUN] ' : '✓ ';
                $this->line("  {$prefix}Berhasil memulihkan Guru ID #{$dt->id}: {$dt->nama}");
                $restoredCount++;
            }

            $verb = $isDryRun ? 'dapat dipulihkan' : 'berhasil dipulihkan';
            $this->info("🎉 Selesai: {$restoredCount} data guru {$verb}!");
            $this->newLine();
        } else {
            $this->comment("💡 Tip: Jika Anda ingin memulihkan guru-guru yang terhapus, jalankan:");
            $this->line("   <fg=white>php artisan teachers:check-deleted-sk --school=\"{$schoolFilter}\" --restore --dry-run</> (uji simulasi)");
            $this->line("   <fg=white>php artisan teachers:check-deleted-sk --school=\"{$schoolFilter}\" --restore</> (pulihkan permanen)");
            $this->newLine();
        }

        return self::SUCCESS;
    }
}
