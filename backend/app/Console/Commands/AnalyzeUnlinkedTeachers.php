<?php

namespace App\Console\Commands;

use App\Models\School;
use App\Models\Teacher;
use App\Services\MatchingService;
use App\Services\NormalizationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AnalyzeUnlinkedTeachers extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'teachers:analyze-unlinked
                            {--details          : Tampilkan rincian daftar guru bermasalah di konsol}
                            {--csv=             : Path file untuk export hasil ke CSV (contoh: storage/unlinked_teachers.csv)}
                            {--match            : Jalankan analisis pencocokan cerdas (smart match) unit_kerja ke nama sekolah}
                            {--auto-link        : Tautkan otomatis guru yang memiliki exact match atau kemiripan sangat tinggi}
                            {--min-score=85     : Ambang batas skor kemiripan (0-100) untuk auto-link (default: 85)}
                            {--dry-run          : Simulasi proses auto-link tanpa mengubah database}
                            {--include-deleted  : Sertakan juga guru yang berstatus soft-deleted}
                            {--limit=50         : Batas jumlah data yang ditampilkan pada opsi --details}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Analisa data guru yang tidak terhubung dengan sekolahnya (school_id NULL, orphan, soft-deleted school, atau mismatch unit_kerja)';

    public function handle(MatchingService $matchingService, NormalizationService $normalizationService): int
    {
        $showDetails    = (bool) $this->option('details');
        $csvPath        = $this->option('csv');
        $runMatch       = (bool) $this->option('match') || (bool) $this->option('auto-link');
        $autoLink       = (bool) $this->option('auto-link');
        $minScore       = (float) $this->option('min-score');
        $dryRun         = (bool) $this->option('dry-run');
        $includeDeleted = (bool) $this->option('include-deleted');
        $limit          = (int) $this->option('limit');

        $this->newLine();
        $this->line('<fg=cyan;options=bold>╔════════════════════════════════════════════════════════════════════════╗</>');
        $this->line('<fg=cyan;options=bold>║         ANALISIS INTEGRITAS RELASI GURU & SEKOLAH (SIMMACI)         ║</>');
        $this->line('<fg=cyan;options=bold>╚════════════════════════════════════════════════════════════════════════╝</>');
        $this->newLine();

        if ($autoLink) {
            if ($dryRun) {
                $this->warn('🔍 MODE SIMULASI (DRY-RUN): Database TIDAK akan diubah.');
            } else {
                $this->alert('⚠️  MODE AUTO-LINK AKTIF: Database akan diperbarui untuk data yang cocok!');
                if (! $this->confirm('Apakah Anda yakin ingin melanjutkan penautan otomatis (auto-link)?', false)) {
                    $this->info('Operasi dibatalkan oleh pengguna.');
                    return self::SUCCESS;
                }
            }
            $this->newLine();
        }

        // 1. Ambil data sekolah (aktif dan soft-deleted)
        $activeSchools = School::all(['id', 'nama', 'npsn', 'nsm', 'jenjang', 'kecamatan']);
        $deletedSchools = School::onlyTrashed()->get(['id', 'nama', 'npsn', 'deleted_at'])->keyBy('id');
        $allSchoolIds = School::withTrashed()->pluck('id')->flip()->toArray();
        $activeSchoolMap = $activeSchools->keyBy('id');

        $totalSchoolsActive = $activeSchools->count();
        $totalSchoolsDeleted = $deletedSchools->count();

        // 2. Query dasar guru
        $teacherQuery = Teacher::withoutTenantScope();
        if (! $includeDeleted) {
            $teacherQuery->whereNull('deleted_at');
        }

        $totalTeachers = (clone $teacherQuery)->count();
        $totalActiveTeachers = (clone $teacherQuery)->where('is_active', true)->count();

        $this->info("Statistik Master Database:");
        $this->line("  • Total Sekolah Aktif        : <fg=white;options=bold>{$totalSchoolsActive}</>");
        $this->line("  • Total Sekolah Soft-Deleted : <fg=gray>{$totalSchoolsDeleted}</>");
        $this->line("  • Total Guru Terdaftar       : <fg=white;options=bold>{$totalTeachers}</>" . ($includeDeleted ? ' (termasuk soft-deleted)' : ' (hanya aktif di sistem)'));
        $this->line("  • Guru Berstatus Aktif (Tugas): <fg=green>{$totalActiveTeachers}</>");
        $this->newLine();

        if ($totalTeachers === 0) {
            $this->info('✅ Tidak ada data guru di database untuk dianalisis.');
            return self::SUCCESS;
        }

        // 3. Tarik semua guru untuk analisis mendalam
        $teachers = $teacherQuery->select([
            'id', 'nama', 'nuptk', 'nomor_induk_maarif', 'nip', 'unit_kerja',
            'school_id', 'status', 'is_active', 'deleted_at'
        ])->get();

        // Siapkan struktur klasifikasi masalah
        $issues = [
            'null_with_unit'      => [], // school_id IS NULL, tapi unit_kerja terisi
            'null_without_unit'   => [], // school_id IS NULL, dan unit_kerja KOSONG/NULL
            'orphan_school'       => [], // school_id IS NOT NULL, tapi ID tidak ada di tabel schools
            'soft_deleted_school' => [], // school_id mengarah ke sekolah yang di-soft-delete
            'name_mismatch'       => [], // school_id ada, tapi unit_kerja beda jauh dengan schools.nama
        ];

        $normalCount = 0;

        foreach ($teachers as $teacher) {
            $sid = $teacher->school_id;
            $unit = trim((string) $teacher->unit_kerja);
            $hasUnit = $unit !== '' && $unit !== '-' && strtolower($unit) !== 'null';

            // Kasus 1 & 2: school_id IS NULL
            if (is_null($sid)) {
                if ($hasUnit) {
                    $issues['null_with_unit'][] = $teacher;
                } else {
                    $issues['null_without_unit'][] = $teacher;
                }
                continue;
            }

            // Kasus 3: school_id tidak ditemukan sama sekali di tabel schools (orphan)
            if (! isset($allSchoolIds[$sid])) {
                $issues['orphan_school'][] = $teacher;
                continue;
            }

            // Kasus 4: school_id mengarah ke sekolah yang sudah di-soft-delete
            if ($deletedSchools->has($sid)) {
                $teacher->setAttribute('soft_deleted_school_info', $deletedSchools->get($sid));
                $issues['soft_deleted_school'][] = $teacher;
                continue;
            }

            // Kasus 5: Valid school_id, cek apakah nama unit_kerja berbeda signifikan
            if ($activeSchoolMap->has($sid) && $hasUnit) {
                $currentSchool = $activeSchoolMap->get($sid);
                $similarity = $matchingService->calculateSimilarity($unit, $currentSchool->nama);

                // Jika unit_kerja terisi jelas tetapi kesamaannya sangat rendah (< 35%) dan bukan substring
                $unitLower = strtolower($unit);
                $schLower = strtolower($currentSchool->nama);
                $isSubstring = str_contains($unitLower, $schLower) || str_contains($schLower, $unitLower);

                if ($similarity < 35.0 && ! $isSubstring) {
                    $teacher->setAttribute('current_school_name', $currentSchool->nama);
                    $teacher->setAttribute('unit_similarity', round($similarity, 1));
                    $issues['name_mismatch'][] = $teacher;
                    continue;
                }
            }

            $normalCount++;
        }

        $totalIssues = count($issues['null_with_unit'])
            + count($issues['null_without_unit'])
            + count($issues['orphan_school'])
            + count($issues['soft_deleted_school']);

        // Tampilkan Ringkasan Temuan
        $this->line('<fg=yellow;options=bold>════════════════════════════════════════════════════════════════════════</>');
        $this->line('<fg=yellow;options=bold>  HASIL DIAGNOSA KETERHUBUNGAN GURU DENGAN SEKOLAH                      </>');
        $this->line('<fg=yellow;options=bold>════════════════════════════════════════════════════════════════════════</>');

        $this->table(
            ['No', 'Kondisi Relasi Sekolah', 'Jumlah Guru', 'Persentase', 'Tingkat Urgensi'],
            [
                [
                    '1',
                    'Terhubung Normal ke Sekolah Aktif',
                    $normalCount,
                    round(($normalCount / $totalTeachers) * 100, 1) . '%',
                    '<fg=green>Normal (Aman)</>'
                ],
                [
                    '2',
                    'school_id NULL, tapi Memiliki Nama Unit Kerja',
                    count($issues['null_with_unit']),
                    round((count($issues['null_with_unit']) / $totalTeachers) * 100, 1) . '%',
                    count($issues['null_with_unit']) > 0 ? '<fg=yellow>Perlu Dipetakan</>' : '<fg=green>Nihil</>'
                ],
                [
                    '3',
                    'school_id NULL dan Unit Kerja KOSONG (Yatim Piatu)',
                    count($issues['null_without_unit']),
                    round((count($issues['null_without_unit']) / $totalTeachers) * 100, 1) . '%',
                    count($issues['null_without_unit']) > 0 ? '<fg=red;options=bold>Kritis (Data Kurang)</>' : '<fg=green>Nihil</>'
                ],
                [
                    '4',
                    'school_id Orphan (ID Sekolah Tidak Ada di DB)',
                    count($issues['orphan_school']),
                    round((count($issues['orphan_school']) / $totalTeachers) * 100, 1) . '%',
                    count($issues['orphan_school']) > 0 ? '<fg=red;options=bold>Kritis (Data Rusak)</>' : '<fg=green>Nihil</>'
                ],
                [
                    '5',
                    'school_id Terhubung ke Sekolah Soft-Deleted',
                    count($issues['soft_deleted_school']),
                    round((count($issues['soft_deleted_school']) / $totalTeachers) * 100, 1) . '%',
                    count($issues['soft_deleted_school']) > 0 ? '<fg=yellow>Waspada</>' : '<fg=green>Nihil</>'
                ],
                [
                    '6',
                    'Potensi Mismatch (Unit Kerja ≠ Nama Sekolah Terhubung)',
                    count($issues['name_mismatch']),
                    round((count($issues['name_mismatch']) / $totalTeachers) * 100, 1) . '%',
                    count($issues['name_mismatch']) > 0 ? '<fg=magenta>Perlu Ditinjau</>' : '<fg=green>Nihil</>'
                ],
            ]
        );

        // 4. Analisis Dampak Terhadap Dokumen/Relasi Lain
        $allUnlinkedIds = collect(array_merge(
            $issues['null_with_unit'],
            $issues['null_without_unit'],
            $issues['orphan_school'],
            $issues['soft_deleted_school']
        ))->pluck('id')->toArray();

        if (! empty($allUnlinkedIds)) {
            $impact = $this->calculateCascadeImpact($allUnlinkedIds);

            $this->line('<fg=cyan;options=bold>── Dampak Terhadap Layanan & Fitur SIMMACI ────────────────────────────</>');
            $this->line("Dari {$totalIssues} guru yang tidak terhubung dengan sekolah:");
            $this->line("  • Masih berstatus Guru Aktif       : <fg=white;options=bold>{$impact['active_teachers']}</> guru");
            $this->line("  • Memiliki Dokumen SK Terbit/Draft : <fg=white;options=bold>{$impact['sk_count']}</> dokumen");
            $this->line("  • Menjabat Kepala Madrasah (Tenure): <fg=white;options=bold>{$impact['tenure_count']}</> riwayat");
            $this->line("  • Memiliki Pengajuan NUPTK         : <fg=white;options=bold>{$impact['nuptk_count']}</> pengajuan");
            $this->line("  • Memiliki Rekam Presensi          : <fg=white;options=bold>{$impact['attendance_count']}</> catatan");
            $this->newLine();
        }

        // 5. Smart Matching: Pencocokan unit_kerja ke tabel schools
        $matchResults = [];
        $autoLinkedCount = 0;

        if (($runMatch || $csvPath) && ! empty($issues['null_with_unit'])) {
            if ($runMatch) {
                $this->line('<fg=cyan;options=bold>── Analisis Pencocokan Cerdas (Smart School Matching) ──────────────────</>');
                $this->info("Mencocokkan nama unit_kerja dari " . count($issues['null_with_unit']) . " guru ke master sekolah...");
            }

            $matchResults = $this->performSchoolMatching($issues['null_with_unit'], $activeSchools, $matchingService);

            if ($runMatch) {
                $exactCount = collect($matchResults)->where('match_type', 'EXACT')->count();
                $highCount = collect($matchResults)->where('match_type', 'HIGH_CONFIDENCE')->count();
                $fuzzyCount = collect($matchResults)->where('match_type', 'MODERATE')->count();
                $noneCount = collect($matchResults)->where('match_type', 'NONE')->count();

                $this->line("  • Cocok Sempurna (Exact Match 100%)       : <fg=green;options=bold>{$exactCount}</> guru");
                $this->line("  • Kemiripan Tinggi (Skor >= {$minScore}%)      : <fg=cyan>{$highCount}</> guru");
                $this->line("  • Kemiripan Sedang (Skor 50%-84%)         : <fg=yellow>{$fuzzyCount}</> guru");
                $this->line("  • Tidak Ditemukan Nama Sekolah Mirip      : <fg=red>{$noneCount}</> guru");
                $this->newLine();
            }

            // Eksekusi Auto-link jika diminta
            if ($autoLink) {
                $autoLinkedCount = $this->executeAutoLink($matchResults, $minScore, $dryRun);
            }
        }

        // 6. Export CSV jika diminta
        if ($csvPath) {
            $this->exportToCsv($csvPath, $issues, $matchResults);
            $this->info("📄 Laporan detail berhasil diekspor ke: {$csvPath}");
        }

        if ($totalIssues === 0 && count($issues['name_mismatch']) === 0) {
            $this->info('🎉 LUAR BIASA: Semua data guru di database terhubung dengan sempurna ke sekolah masing-masing!');
            return self::SUCCESS;
        }

        // 7. Tampilkan Rincian (jika requested)
        if ($showDetails) {
            $this->renderDetails($issues, $matchResults, $limit);
        } else {
            $this->comment("💡 Tip: Gunakan opsi '--details' untuk melihat daftar nama guru per baris di terminal.");
            if (! $runMatch) {
                $this->comment("💡 Tip: Gunakan opsi '--match' untuk melihat rekomendasi sekolah yang cocok otomatis.");
            }
        }

        if (! $csvPath) {
            $this->comment("💡 Tip: Gunakan opsi '--csv=storage/guru_tanpa_sekolah.csv' untuk mengekspor ke file Excel/CSV.");
        }

        $this->newLine();
        $this->line('<fg=cyan;options=bold>════════════════════════════════════════════════════════════════════════</>');
        $this->info('  REKOMENDASI TINDAKAN LANJUT');
        $this->line('<fg=cyan;options=bold>════════════════════════════════════════════════════════════════════════</>');

        if (count($issues['null_with_unit']) > 0) {
            $this->line('  1. <fg=yellow;options=bold>Guru dengan unit_kerja tapi school_id NULL</>:');
            $this->line('     Jalankan perintah auto-link dengan:');
            $this->line('     <fg=white>php artisan teachers:analyze-unlinked --auto-link --dry-run</> (uji simulasi)');
            $this->line('     <fg=white>php artisan teachers:analyze-unlinked --auto-link</> (terapkan permanen)');
        }

        if (count($issues['null_without_unit']) > 0) {
            $this->line('  2. <fg=red;options=bold>Guru yatim piatu (school_id NULL & unit_kerja KOSONG)</>:');
            $this->line('     Perlu verifikasi manual melalui menu Data GTK di Admin Panel.');
        }

        if (count($issues['orphan_school']) > 0) {
            $this->line('  3. <fg=red;options=bold>Guru dengan school_id Orphan (Sekolah tidak ada di DB)</>:');
            $this->line('     ID sekolah lama terhapus permanen. Perlu dipetakan ulang ke sekolah aktif.');
        }

        if (count($issues['soft_deleted_school']) > 0) {
            $this->line('  4. <fg=yellow;options=bold>Guru di Sekolah Soft-Deleted</>:');
            $this->line('     Sekolah induk guru berstatus terhapus. Pulihkan sekolah atau mutasikan guru.');
        }

        $this->newLine();
        return self::SUCCESS;
    }

    /**
     * Hitung dampak ke relasi tabel lain.
     */
    private function calculateCascadeImpact(array $teacherIds): array
    {
        $impact = [
            'active_teachers'  => 0,
            'sk_count'         => 0,
            'tenure_count'     => 0,
            'nuptk_count'      => 0,
            'attendance_count' => 0,
        ];

        if (empty($teacherIds)) {
            return $impact;
        }

        $impact['active_teachers'] = Teacher::withoutTenantScope()
            ->whereIn('id', $teacherIds)
            ->where('is_active', true)
            ->count();

        if (Schema::hasTable('sk_documents')) {
            $impact['sk_count'] = DB::table('sk_documents')
                ->whereIn('teacher_id', $teacherIds)
                ->whereNull('deleted_at')
                ->count();
        }

        if (Schema::hasTable('headmaster_tenures')) {
            $impact['tenure_count'] = DB::table('headmaster_tenures')
                ->whereIn('teacher_id', $teacherIds)
                ->count();
        }

        if (Schema::hasTable('nuptk_submissions')) {
            $impact['nuptk_count'] = DB::table('nuptk_submissions')
                ->whereIn('teacher_id', $teacherIds)
                ->count();
        }

        if (Schema::hasTable('teacher_attendances')) {
            $impact['attendance_count'] = DB::table('teacher_attendances')
                ->whereIn('teacher_id', $teacherIds)
                ->count();
        }

        return $impact;
    }

    /**
     * Cari kecocokan unit_kerja guru ke nama sekolah di database.
     */
    private function performSchoolMatching(array $teachers, $schools, MatchingService $matchingService): array
    {
        $results = [];

        // Buat lookup index nama sekolah untuk exact matching yang cepat
        $exactSchoolMap = [];
        foreach ($schools as $school) {
            $norm = strtolower(trim($school->nama));
            $exactSchoolMap[$norm] = $school;
        }

        foreach ($teachers as $teacher) {
            $unit = trim((string) $teacher->unit_kerja);
            $unitNorm = strtolower($unit);

            // 1. Cek Exact Match
            if (isset($exactSchoolMap[$unitNorm])) {
                $matchedSchool = $exactSchoolMap[$unitNorm];
                $results[$teacher->id] = [
                    'teacher'         => $teacher,
                    'suggested_school'=> $matchedSchool,
                    'score'           => 100.0,
                    'match_type'      => 'EXACT',
                ];
                continue;
            }

            // 2. Cek Substring & Fuzzy Similarity
            $bestSchool = null;
            $bestScore = 0.0;

            foreach ($schools as $school) {
                $schNorm = strtolower(trim($school->nama));

                // Jika salah satu adalah substring lengkap dari yang lain
                if (str_contains($unitNorm, $schNorm) || str_contains($schNorm, $unitNorm)) {
                    $lenUnit = strlen($unitNorm);
                    $lenSch  = strlen($schNorm);
                    $subScore = (min($lenUnit, $lenSch) / max($lenUnit, $lenSch)) * 100;
                    $score = max(88.0, $subScore);
                } else {
                    $score = $matchingService->calculateSimilarity($unit, $school->nama);
                }

                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestSchool = $school;
                }
            }

            $matchType = 'NONE';
            if ($bestScore >= 85.0) {
                $matchType = 'HIGH_CONFIDENCE';
            } elseif ($bestScore >= 50.0) {
                $matchType = 'MODERATE';
            }

            $results[$teacher->id] = [
                'teacher'         => $teacher,
                'suggested_school'=> $bestScore >= 50.0 ? $bestSchool : null,
                'score'           => round($bestScore, 1),
                'match_type'      => $matchType,
            ];
        }

        return $results;
    }

    /**
     * Tautkan guru ke sekolah berdasarkan hasil smart match.
     */
    private function executeAutoLink(array $matchResults, float $minScore, bool $dryRun): int
    {
        $eligible = collect($matchResults)->filter(function ($item) use ($minScore) {
            return ($item['match_type'] === 'EXACT' || $item['score'] >= $minScore)
                && ! empty($item['suggested_school']);
        });

        $count = $eligible->count();
        if ($count === 0) {
            $this->warn("Tidak ada guru yang memenuhi syarat skor minimal ({$minScore}%) untuk auto-link.");
            return 0;
        }

        $this->info("Menautkan {$count} guru yang memenuhi syarat (skor >= {$minScore}%)...");

        $linked = 0;
        foreach ($eligible as $teacherId => $data) {
            $teacher = $data['teacher'];
            $school = $data['suggested_school'];

            if (! $dryRun) {
                DB::table('teachers')
                    ->where('id', $teacherId)
                    ->update([
                        'school_id'  => $school->id,
                        'updated_at' => now(),
                    ]);
            }

            $prefix = $dryRun ? '[DRY-RUN] ' : '✓ ';
            $this->line("  {$prefix}ID #{$teacher->id} \"{$teacher->nama}\" → [{$school->id}] {$school->nama} (Skor: {$data['score']}%)");
            $linked++;
        }

        $verb = $dryRun ? 'dapat ditautkan' : 'berhasil ditautkan';
        $this->info("🎉 Selesai: {$linked} data guru {$verb} ke sekolah!");
        $this->newLine();

        return $linked;
    }

    /**
     * Tampilkan detail per baris di terminal.
     */
    private function renderDetails(array $issues, array $matchResults, int $limit): void
    {
        $this->line('<fg=cyan;options=bold>── Rincian Data Guru Bermasalah (Maksimal ' . $limit . ' baris per kategori) ───</>');

        // 1. Kategori: school_id NULL tapi ada unit kerja
        if (! empty($issues['null_with_unit'])) {
            $this->newLine();
            $this->line('<fg=yellow;options=bold>▶ Kategori: school_id NULL dengan Unit Kerja (' . count($issues['null_with_unit']) . ' data)</>');
            $rows = [];
            foreach (array_slice($issues['null_with_unit'], 0, $limit) as $t) {
                $match = $matchResults[$t->id] ?? null;
                $sug = '-';
                if ($match && ! empty($match['suggested_school'])) {
                    $sug = "[{$match['suggested_school']->id}] {$match['suggested_school']->nama} ({$match['score']}%)";
                }

                $rows[] = [
                    $t->id,
                    $t->nama,
                    $t->nuptk ?: ($t->nomor_induk_maarif ?: '-'),
                    $t->unit_kerja,
                    $sug,
                ];
            }
            $this->table(['ID', 'Nama Guru', 'NUPTK / NIM', 'Unit Kerja di Data Guru', 'Saran Sekolah Cocok'], $rows);
        }

        // 2. Kategori: school_id NULL tanpa unit kerja
        if (! empty($issues['null_without_unit'])) {
            $this->newLine();
            $this->line('<fg=red;options=bold>▶ Kategori: Yatim Piatu (school_id NULL & Unit Kerja Kosong) (' . count($issues['null_without_unit']) . ' data)</>');
            $rows = [];
            foreach (array_slice($issues['null_without_unit'], 0, $limit) as $t) {
                $rows[] = [
                    $t->id,
                    $t->nama,
                    $t->nuptk ?: '-',
                    $t->nomor_induk_maarif ?: '-',
                    $t->is_active ? 'Aktif' : 'Non-Aktif',
                ];
            }
            $this->table(['ID', 'Nama Guru', 'NUPTK', 'NIM', 'Status Aktif'], $rows);
        }

        // 3. Kategori: orphan school_id
        if (! empty($issues['orphan_school'])) {
            $this->newLine();
            $this->line('<fg=red;options=bold>▶ Kategori: Orphan (school_id Tidak Ditemukan di Master Sekolah) (' . count($issues['orphan_school']) . ' data)</>');
            $rows = [];
            foreach (array_slice($issues['orphan_school'], 0, $limit) as $t) {
                $rows[] = [
                    $t->id,
                    $t->nama,
                    $t->school_id,
                    $t->unit_kerja ?: '-',
                ];
            }
            $this->table(['ID', 'Nama Guru', 'Invalid school_id', 'Unit Kerja'], $rows);
        }

        // 4. Kategori: soft-deleted school
        if (! empty($issues['soft_deleted_school'])) {
            $this->newLine();
            $this->line('<fg=yellow;options=bold>▶ Kategori: Terhubung ke Sekolah Soft-Deleted (' . count($issues['soft_deleted_school']) . ' data)</>');
            $rows = [];
            foreach (array_slice($issues['soft_deleted_school'], 0, $limit) as $t) {
                $delSch = $t->getAttribute('soft_deleted_school_info');
                $rows[] = [
                    $t->id,
                    $t->nama,
                    $t->school_id,
                    $delSch ? $delSch->nama : 'Unknown',
                    $delSch ? $delSch->deleted_at : '-',
                ];
            }
            $this->table(['ID', 'Nama Guru', 'school_id', 'Nama Sekolah Terhapus', 'Waktu Hapus'], $rows);
        }

        // 5. Kategori: name mismatch
        if (! empty($issues['name_mismatch'])) {
            $this->newLine();
            $this->line('<fg=magenta;options=bold>▶ Kategori: Mismatch Nama Unit Kerja vs Nama Sekolah Terhubung (' . count($issues['name_mismatch']) . ' data)</>');
            $rows = [];
            foreach (array_slice($issues['name_mismatch'], 0, $limit) as $t) {
                $rows[] = [
                    $t->id,
                    $t->nama,
                    $t->unit_kerja,
                    "[{$t->school_id}] " . $t->getAttribute('current_school_name'),
                    $t->getAttribute('unit_similarity') . '%',
                ];
            }
            $this->table(['ID', 'Nama Guru', 'Unit Kerja di Guru', 'Sekolah Saat Ini', 'Kemiripan'], $rows);
        }

        $this->newLine();
    }

    /**
     * Export hasil diagnosa ke file CSV.
     */
    private function exportToCsv(string $path, array $issues, array $matchResults): void
    {
        $dir = dirname($path);
        if ($dir && ! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $handle = fopen($path, 'w');
        // UTF-8 BOM agar rapi saat dibuka di Microsoft Excel
        fwrite($handle, "\xEF\xBB\xBF");

        fputcsv($handle, [
            'ID Guru',
            'Nama Guru',
            'NUPTK',
            'NIM',
            'NIP',
            'Unit Kerja Guru',
            'Current School ID',
            'Kategori Masalah',
            'Status Keaktifan',
            'Saran School ID',
            'Saran Nama Sekolah',
            'Skor Kemiripan (%)',
            'Tipe Kecocokan',
        ]);

        $exportList = [
            'NULL_DENGAN_UNIT_KERJA' => $issues['null_with_unit'],
            'NULL_TANPA_UNIT_KERJA'  => $issues['null_without_unit'],
            'ORPHAN_SCHOOL_ID'       => $issues['orphan_school'],
            'SEKOLAH_SOFT_DELETED'   => $issues['soft_deleted_school'],
            'NAMA_UNIT_MISMATCH'     => $issues['name_mismatch'],
        ];

        foreach ($exportList as $catCode => $list) {
            foreach ($list as $t) {
                $match = $matchResults[$t->id] ?? null;
                $sugSchool = $match['suggested_school'] ?? null;

                fputcsv($handle, [
                    $t->id,
                    $t->nama,
                    $t->nuptk ?: '',
                    $t->nomor_induk_maarif ?: '',
                    $t->nip ?: '',
                    $t->unit_kerja ?: '',
                    $t->school_id ?: '',
                    $catCode,
                    $t->is_active ? 'Aktif' : 'Non-Aktif',
                    $sugSchool ? $sugSchool->id : '',
                    $sugSchool ? $sugSchool->nama : '',
                    $match ? $match['score'] : '',
                    $match ? $match['match_type'] : '',
                ]);
            }
        }

        fclose($handle);
    }
}
