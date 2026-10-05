<?php

namespace App\Console\Commands;

use App\Models\School;
use App\Models\Teacher;
use App\Models\SkDocument;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FixSatminkalWanareja extends Command
{
    protected $signature = 'teachers:fix-satminkal-wanareja
                            {--apply : Terapkan perubahan ke database (tanpa flag ini berjalan dalam mode DRY-RUN/Preview)}
                            {--ids= : Filter ID guru tertentu dipisah koma (contoh: --ids=12,15,20)}
                            {--from= : Teks satminkal asal (default: "SMP Ma\'arif NU 1 Wanareja")}
                            {--to= : Teks satminkal tujuan (default: "SMP Ma\'arif NU 01 Wanareja")}
                            {--skip-school-update : Jangan update nama sekolah di tabel master schools}';

    protected $description = 'Perbaiki Satminkal / Unit Kerja guru dari "SMP Ma\'arif NU 1 Wanareja" menjadi "SMP Ma\'arif NU 01 Wanareja"';

    public function handle(): int
    {
        $isApply = (bool)$this->option('apply');
        $fromText = $this->option('from') ?: "SMP Ma'arif NU 1 Wanareja";
        $toText = $this->option('to') ?: "SMP Ma'arif NU 01 Wanareja";
        $specificIds = $this->option('ids');
        $skipSchoolUpdate = (bool)$this->option('skip-school-update');

        $this->newLine();
        $this->info("══════════════════════════════════════════════════════════════════════");
        $this->info("   SINKRONISASI SATMINKAL GURU SIMMACI (WANAREJA)");
        $this->info("══════════════════════════════════════════════════════════════════════");
        $this->line("  Satminkal Asal   : <fg=yellow>{$fromText}</>");
        $this->line("  Satminkal Tujuan : <fg=green>{$toText}</>");
        $this->line("  Mode Eksekusi    : " . ($isApply ? "<fg=red;options=bold>[APPLY / EKSEKUSI DATABASE]</>" : "<fg=cyan;options=bold>[DRY-RUN / SIMULASI AMAN]</>"));
        if ($specificIds) {
            $this->line("  Filter ID Guru   : <fg=magenta>{$specificIds}</>");
        }
        $this->info("══════════════════════════════════════════════════════════════════════");
        $this->newLine();

        // 1. Periksa master data sekolah di tabel schools
        $this->info("🔍 Langkah 1: Memeriksa Master Data Sekolah di tabel `schools`...");
        
        $targetSchool = School::withoutGlobalScopes()
            ->whereNull('deleted_at')
            ->where(function ($q) use ($toText) {
                $q->whereRaw('LOWER(TRIM(nama)) = LOWER(?)', [trim($toText)])
                  ->orWhereRaw("LOWER(REPLACE(nama, '''', '')) = LOWER(?)", [str_replace("'", "", trim($toText))]);
            })
            ->first();

        $oldSchool = School::withoutGlobalScopes()
            ->whereNull('deleted_at')
            ->where(function ($q) use ($fromText) {
                $q->whereRaw('LOWER(TRIM(nama)) = LOWER(?)', [trim($fromText)])
                  ->orWhereRaw("LOWER(REPLACE(nama, '''', '')) = LOWER(?)", [str_replace("'", "", trim($fromText))]);
            })
            ->first();

        // Cari juga sekolah terkait di Kecamatan Wanareja
        $wanarejaSchools = School::withoutGlobalScopes()
            ->whereNull('deleted_at')
            ->whereRaw('LOWER(kecamatan) LIKE ?', ['%wanareja%'])
            ->whereRaw('LOWER(nama) LIKE ?', ['%smp%'])
            ->get(['id', 'nama', 'npsn', 'kecamatan']);

        if ($wanarejaSchools->isNotEmpty()) {
            $this->line("  Sekolah SMP Maarif ditemukan di Wanareja:");
            foreach ($wanarejaSchools as $ws) {
                $this->line("    • [ID: {$ws->id}] {$ws->nama} (NPSN: " . ($ws->npsn ?: '-') . ")");
            }
        }

        $targetSchoolId = null;
        $schoolAction = "none";

        if ($targetSchool) {
            $targetSchoolId = $targetSchool->id;
            $this->info("  ✓ Sekolah Tujuan sudah ada: [ID: {$targetSchool->id}] {$targetSchool->nama}");
            if ($oldSchool && $oldSchool->id !== $targetSchool->id) {
                $this->warn("  ⚠️ Perhatian: Ditemukan 2 record sekolah terpisah:");
                $this->warn("     - Sekolah Lama   : [ID: {$oldSchool->id}] {$oldSchool->nama}");
                $this->warn("     - Sekolah Tujuan : [ID: {$targetSchool->id}] {$targetSchool->nama}");
                $this->warn("     Semua guru & SK dari sekolah lama akan dialihkan ke ID: {$targetSchool->id}.");
                $schoolAction = "merge_to_target";
            }
        } elseif ($oldSchool) {
            $targetSchoolId = $oldSchool->id;
            $this->info("  ✓ Ditemukan sekolah lama: [ID: {$oldSchool->id}] {$oldSchool->nama}");
            if (!$skipSchoolUpdate) {
                $this->line("  → Nama sekolah di tabel `schools` akan diubah menjadi: <fg=green>{$toText}</>");
                $schoolAction = "rename_old_school";
            }
        } else {
            // Coba cari fallback sekolah pertama yang cocok dengan SMP Maarif di Wanareja
            $fallback = $wanarejaSchools->first();
            if ($fallback) {
                $targetSchoolId = $fallback->id;
                $this->warn("  ⚠️ Sekolah exact match tidak ditemukan. Menggunakan fallback: [ID: {$fallback->id}] {$fallback->nama}");
                if (!$skipSchoolUpdate && strtolower(trim($fallback->nama)) !== strtolower(trim($toText))) {
                    $this->line("  → Nama sekolah ID {$fallback->id} akan diubah menjadi: <fg=green>{$toText}</>");
                    $schoolAction = "rename_fallback_school";
                }
            } else {
                $this->warn("  ⚠️ Tidak ditemukan sekolah master '{$toText}' di tabel `schools`.");
                $this->warn("     Guru tetap akan diperbarui teks `unit_kerja`-nya, namun `school_id` tidak dapat dihubungkan ke ID sekolah.");
            }
        }

        $this->newLine();

        // 2. Cari Guru yang akan diubah
        $this->info("🔍 Langkah 2: Mencari Data Guru yang Perlu Diperbarui...");

        $teacherQuery = Teacher::withoutGlobalScopes()
            ->whereNull('deleted_at');

        if ($specificIds) {
            $idList = array_map('intval', array_filter(array_map('trim', explode(',', $specificIds))));
            $teacherQuery->whereIn('id', $idList);
        } else {
            $teacherQuery->where(function ($q) use ($fromText, $oldSchool) {
                // Pencocokan fleksibel (mengabaikan tanda kutip tunggal, spasi, huruf besar/kecil)
                $cleanFrom = str_replace(["'", "’"], "", strtolower($fromText));
                $q->whereRaw("LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE ?", ["%{$cleanFrom}%"])
                  ->orWhereRaw("LOWER(REPLACE(unit_kerja, '''', '')) LIKE '%smp maarif nu 1 wanareja%'")
                  ->orWhereRaw("LOWER(unit_kerja) LIKE '%smp%nu 1 wanareja%'")
                  ->orWhereRaw("LOWER(unit_kerja) LIKE '%smp%nu 1%wanareja%'");

                if ($oldSchool) {
                    $q->orWhere('school_id', $oldSchool->id);
                }
            });
        }

        $teachers = $teacherQuery->get();

        if ($teachers->isEmpty()) {
            $this->warn("⚠️ Tidak ditemukan guru dengan satminkal '{$fromText}'" . ($specificIds ? " dan ID: {$specificIds}" : "") . ".");
            
            // Tampilkan beberapa guru yang sudah ber-satminkal target untuk konfirmasi
            $alreadyCorrect = Teacher::withoutGlobalScopes()
                ->whereNull('deleted_at')
                ->whereRaw("LOWER(unit_kerja) LIKE '%wanareja%'")
                ->take(5)
                ->get(['id', 'nama', 'unit_kerja', 'school_id']);

            if ($alreadyCorrect->isNotEmpty()) {
                $this->info("Berikut contoh guru di Wanareja saat ini:");
                $this->table(
                    ['ID', 'Nama', 'Unit Kerja Saat Ini', 'School ID'],
                    $alreadyCorrect->map(fn($t) => [$t->id, $t->nama, $t->unit_kerja, $t->school_id ?: '(KOSONG)'])
                );
            }
            return self::SUCCESS;
        }

        $this->info("Ditemukan <fg=yellow;options=bold>{$teachers->count()}</> guru yang perlu diperbarui:");
        $tableData = [];
        $teacherIds = [];

        foreach ($teachers as $t) {
            $teacherIds[] = $t->id;
            $tableData[] = [
                $t->id,
                $t->nama,
                $t->nuptk ?: ($t->nomor_induk_maarif ?: '-'),
                $t->unit_kerja ?: '<KOSONG>',
                $toText,
                $t->school_id ?: '<NULL>',
                $targetSchoolId ?: '<NULL>',
            ];
        }

        $this->table(
            ['ID', 'Nama Guru', 'NUPTK / NIM', 'Unit Kerja Lama', 'Unit Kerja Baru', 'School ID Lama', 'School ID Baru'],
            $tableData
        );

        // 3. Periksa Dokumen SK terkait
        $this->newLine();
        $this->info("🔍 Langkah 3: Memeriksa Dokumen SK Terkait...");

        $skQuery = SkDocument::withoutGlobalScopes()
            ->whereNull('deleted_at')
            ->where(function ($q) use ($teacherIds, $fromText, $oldSchool) {
                if (!empty($teacherIds)) {
                    $q->whereIn('teacher_id', $teacherIds);
                }
                $cleanFrom = str_replace(["'", "’"], "", strtolower($fromText));
                $q->orWhereRaw("LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE ?", ["%{$cleanFrom}%"]);
                if ($oldSchool) {
                    $q->orWhere('school_id', $oldSchool->id);
                }
            });

        $skCount = $skQuery->count();
        $skDocuments = $skQuery->get(['id', 'nomor_sk', 'nama', 'unit_kerja', 'school_id', 'teacher_id']);
        $this->line("  Dokumen SK yang terhubung/cocok: <fg=yellow>{$skCount}</> record.");

        if ($skDocuments->isNotEmpty() && $skDocuments->count() <= 10) {
            $this->table(
                ['SK ID', 'Nomor SK', 'Nama di SK', 'Unit Kerja SK Lama', 'School ID'],
                $skDocuments->map(fn($sk) => [$sk->id, $sk->nomor_sk, $sk->nama, $sk->unit_kerja, $sk->school_id ?: '-'])
            );
        }

        // 4. Konfirmasi & Eksekusi
        $this->newLine();
        $this->info("══════════════════════════════════════════════════════════════════════");
        $this->info("   RINGKASAN PERUBAHAN");
        $this->info("══════════════════════════════════════════════════════════════════════");
        $this->line("  • Jumlah Guru yang diupdate : <fg=green;options=bold>{$teachers->count()}</> orang");
        $this->line("  • Jumlah Dokumen SK diupdate: <fg=green;options=bold>{$skCount}</> dokumen");
        $this->line("  • Update Master Sekolah     : " . ($schoolAction !== 'none' ? "<fg=yellow>{$schoolAction}</>" : "<fg=gray>Tidak ada perubahan master sekolah</>"));
        $this->line("  • Target School ID          : " . ($targetSchoolId ? "<fg=green>{$targetSchoolId}</>" : "<fg=red>TIDAK TERHUBUNG</>"));
        $this->info("══════════════════════════════════════════════════════════════════════");
        $this->newLine();

        if (!$isApply) {
            $this->warn("⚠️  MODE DRY-RUN: Tidak ada perubahan yang disimpan ke database.");
            $this->line("Untuk mengeksekusi perubahan secara permanen, jalankan perintah:");
            $cmd = "php artisan teachers:fix-satminkal-wanareja --apply";
            if ($specificIds) {
                $cmd .= " --ids={$specificIds}";
            }
            $this->line("  <fg=green;options=bold>{$cmd}</>");
            $this->newLine();
            return self::SUCCESS;
        }

        // Jalankan dalam Database Transaction
        $this->info("🚀 Memulai transaksi database untuk menerapkan perubahan...");

        DB::beginTransaction();
        try {
            $updatedTeachersCount = 0;
            $updatedSksCount = 0;

            // A. Update master school jika diperlukan
            if ($schoolAction === 'rename_old_school' && $oldSchool) {
                $oldSchool->nama = $toText;
                $oldSchool->save();
                $this->info("  ✓ Berhasil mengupdate nama sekolah [ID: {$oldSchool->id}] menjadi '{$toText}'");
            } elseif ($schoolAction === 'rename_fallback_school' && isset($fallback)) {
                $fallback->nama = $toText;
                $fallback->save();
                $this->info("  ✓ Berhasil mengupdate nama sekolah [ID: {$fallback->id}] menjadi '{$toText}'");
            }

            // B. Update Teachers
            foreach ($teachers as $teacher) {
                $teacher->unit_kerja = $toText;
                if ($targetSchoolId) {
                    $teacher->school_id = $targetSchoolId;
                }
                // Pastikan kecamatan terisi Wanareja jika kosong
                if (empty($teacher->kecamatan)) {
                    $teacher->kecamatan = 'Wanareja';
                }
                $teacher->save();
                $updatedTeachersCount++;
            }
            $this->info("  ✓ Berhasil mengupdate {$updatedTeachersCount} data guru.");

            // C. Update SK Documents
            foreach ($skDocuments as $sk) {
                $sk->unit_kerja = $toText;
                if ($targetSchoolId) {
                    $sk->school_id = $targetSchoolId;
                }
                $sk->save();
                $updatedSksCount++;
            }
            if ($updatedSksCount > 0) {
                $this->info("  ✓ Berhasil mengupdate {$updatedSksCount} dokumen SK.");
            }

            DB::commit();

            // D. Bersihkan cache aplikasi
            $this->info("🧹 Membersihkan cache sistem...");
            try {
                \Illuminate\Support\Facades\Artisan::call('cache:clear');
            } catch (\Throwable $e) {
                // Abaikan jika cache store tidak aktif
            }

            $this->newLine();
            $this->info("══════════════════════════════════════════════════════════════════════");
            $this->info("✅ SEMUA PERUBAHAN BERHASIL DISIMPAN SECARA PERMANEN!");
            $this->info("══════════════════════════════════════════════════════════════════════");
            $this->line("  Guru Diperbarui : {$updatedTeachersCount}");
            $this->line("  SK Diperbarui   : {$updatedSksCount}");
            $this->line("  Satminkal Baru  : {$toText}");
            $this->info("══════════════════════════════════════════════════════════════════════");
            $this->newLine();

            return self::SUCCESS;
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error("❌ Terjadi kesalahan saat menyimpan data: " . $e->getMessage());
            $this->error("   Transaksi telah di-ROLLBACK. Tidak ada perubahan yang tersimpan.");
            return self::FAILURE;
        }
    }
}
