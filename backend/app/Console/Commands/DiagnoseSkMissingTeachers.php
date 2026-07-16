<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Artisan command: sk:diagnose-missing-teachers
 *
 * Mendiagnosis sk_documents di generator (status pending/draft) yang
 * data gurunya kosong (TTL/TMT/NIM kosong), lalu:
 *   1. Cari kesamaan nama di tabel teachers (aktif maupun soft-deleted)
 *   2. Tentukan apakah guru tersebut pernah ada tapi terhapus (soft-deleted)
 *
 * Output: tabel dan CSV opsional
 */
class DiagnoseSkMissingTeachers extends Command
{
    protected $signature = 'sk:diagnose-missing-teachers
                            {--school-id=   : Filter per school_id}
                            {--school-name= : Filter per nama sekolah (partial match)}
                            {--csv=         : Export ke file CSV (path relatif dari root project)}
                            {--show-all     : Tampilkan semua SK, bukan hanya yang datanya kosong}';

    protected $description = 'Diagnosis nama guru di generator SK yang data TTL/TMT/NIM-nya kosong';

    public function handle(): int
    {
        $schoolId   = $this->option('school-id');
        $schoolName = $this->option('school-name');
        $csvPath    = $this->option('csv');
        $showAll    = $this->option('show-all');

        $this->info('');
        $this->info('═══════════════════════════════════════════════════════════');
        $this->info('  DIAGNOSA SK GENERATOR — DATA GURU TIDAK LENGKAP');
        $this->info('═══════════════════════════════════════════════════════════');

        // ── Step 1: Ambil SK di generator (pending/draft) ──────────────────
        $skQuery = DB::table('sk_documents as sd')
            ->leftJoin('teachers as t', 't.id', '=', 'sd.teacher_id')
            ->leftJoin('schools as sc', 'sc.id', '=', 'sd.school_id')
            ->whereIn('sd.status', ['pending', 'draft'])
            ->whereNull('sd.deleted_at')
            ->select([
                'sd.id as sk_id',
                'sd.nomor_sk',
                'sd.nama as nama_sk',
                'sd.unit_kerja',
                'sd.school_id',
                'sc.nama as nama_sekolah',
                'sd.teacher_id',
                't.nama as nama_teacher',
                't.nomor_induk_maarif as nim',
                't.tmt',
                't.tempat_lahir',
                't.tanggal_lahir',
                't.deleted_at as teacher_deleted_at',
                'sd.created_at',
            ]);

        if ($schoolId) {
            $skQuery->where('sd.school_id', $schoolId);
        }
        if ($schoolName) {
            $skQuery->where('sc.nama', 'ilike', "%{$schoolName}%");
        }

        $allSks = $skQuery->orderBy('sc.nama')->orderBy('sd.nama')->get();

        $this->info("Total SK di generator (pending/draft): " . $allSks->count());

        // ── Step 2: Filter yang datanya tidak lengkap ──────────────────────
        $incomplete = $allSks->filter(function ($sk) {
            return empty($sk->nim) || empty($sk->tmt) || (empty($sk->tempat_lahir) && empty($sk->tanggal_lahir));
        });

        $this->info("SK dengan data guru tidak lengkap (NIM/TMT/TTL kosong): " . $incomplete->count());
        $this->info('');

        if ($incomplete->isEmpty()) {
            $this->info('✅ Semua SK di generator sudah memiliki data guru yang lengkap!');
            return self::SUCCESS;
        }

        // ── Step 3: Untuk setiap nama yang tidak lengkap, cari di teachers ─
        // termasuk yang soft-deleted
        $namaList = $incomplete->pluck('nama_sk')->map(fn($n) => mb_strtolower(trim($n)))->unique()->values();

        $teachersAll = DB::table('teachers')
            ->whereRaw('LOWER(TRIM(nama)) IN (' . implode(',', array_fill(0, count($namaList), '?')) . ')', $namaList->toArray())
            ->select([
                'id',
                'nama',
                'school_id',
                'nomor_induk_maarif',
                'tmt',
                'tempat_lahir',
                'tanggal_lahir',
                'deleted_at',
            ])
            ->orderBy('school_id')
            ->get()
            ->groupBy(fn($t) => mb_strtolower(trim($t->nama)));

        // Juga cari kesamaan fuzzy (nama SK mengandung nama teacher atau sebaliknya)
        // untuk mendeteksi typo/perbedaan gelar
        $teachersForFuzzy = DB::table('teachers')
            ->select(['id', 'nama', 'school_id', 'nomor_induk_maarif', 'tmt', 'tempat_lahir', 'tanggal_lahir', 'deleted_at'])
            ->get();

        // ── Step 4: Build hasil ────────────────────────────────────────────
        $results   = [];
        $csvRows   = [];

        foreach ($incomplete as $sk) {
            $normNama = mb_strtolower(trim($sk->nama_sk));

            // a) Exact match (case-insensitive) di teachers (termasuk deleted)
            $exactMatches = $teachersAll[$normNama] ?? collect();

            // b) Fuzzy match: nama teacher ada di dalam nama SK atau sebaliknya
            //    Berguna untuk kasus: "SAEFUL ANAM" di SK vs "SAEFUL ANAM, S.Pd." di teachers
            $fuzzyMatches = $teachersForFuzzy->filter(function ($t) use ($normNama) {
                $tNorm = mb_strtolower(trim($t->nama));
                return $tNorm !== $normNama && (
                    str_contains($tNorm, $normNama) ||
                    str_contains($normNama, $tNorm) ||
                    similar_text($normNama, $tNorm, $pct) > 0 && $pct >= 80
                );
            })->values();

            // Tentukan status
            $status = $this->determineStatus($sk, $exactMatches, $fuzzyMatches);

            $results[] = [
                'sk'            => $sk,
                'exact'         => $exactMatches,
                'fuzzy'         => $fuzzyMatches,
                'status'        => $status,
            ];
        }

        // ── Step 5: Kelompokkan hasil per sekolah dan tampilkan ────────────
        $bySchool = collect($results)->groupBy(fn($r) => $r['sk']->nama_sekolah ?? 'Unknown');

        foreach ($bySchool as $sekolah => $rows) {
            $this->line('');
            $this->line("<fg=cyan>▶ {$sekolah}</>");
            $this->line(str_repeat('─', 70));

            $tableData = [];
            foreach ($rows as $r) {
                $sk     = $r['sk'];
                $status = $r['status'];
                $exact  = $r['exact'];
                $fuzzy  = $r['fuzzy'];

                $statusLabel = match ($status['code']) {
                    'NO_TEACHER_ID'       => '<fg=red>❌ Tidak ada teacher_id</>',
                    'TEACHER_SOFT_DELETED' => '<fg=yellow>⚠️  Teacher TERHAPUS (soft-delete)</>',
                    'DATA_EMPTY'          => '<fg=yellow>⚠️  Teacher ada tapi data kosong</>',
                    'FUZZY_MATCH'         => '<fg=magenta>🔍 Fuzzy match ditemukan</>',
                    default               => '<fg=red>❓ Tidak ada di teachers</>',
                };

                $matchInfo = '';
                if ($exact->isNotEmpty()) {
                    $matchInfo = $exact->map(fn($t) =>
                        "  exact→ ID:{$t->id} \"{$t->nama}\" school:{$t->school_id}" .
                        ($t->deleted_at ? " [DELETED:{$t->deleted_at}]" : " [aktif]") .
                        " NIM:" . ($t->nomor_induk_maarif ?: '-') .
                        " TMT:" . ($t->tmt ?: '-')
                    )->implode("\n");
                } elseif ($fuzzy->isNotEmpty()) {
                    $matchInfo = $fuzzy->take(3)->map(fn($t) =>
                        "  fuzzy→ ID:{$t->id} \"{$t->nama}\" school:{$t->school_id}" .
                        ($t->deleted_at ? " [DELETED:{$t->deleted_at}]" : " [aktif]") .
                        " NIM:" . ($t->nomor_induk_maarif ?: '-')
                    )->implode("\n");
                }

                $this->line('');
                $this->line("  SK #{$sk->sk_id} | {$sk->nomor_sk}");
                $this->line("  Nama SK   : <fg=white;options=bold>{$sk->nama_sk}</>");
                $this->line("  teacher_id: " . ($sk->teacher_id ?: '<fg=red>NULL</>'));
                $this->line("  NIM       : " . ($sk->nim ?: '<fg=red>-</>') . "  |  TMT: " . ($sk->tmt ?: '<fg=red>-</>'));
                $this->line("  TTL       : " . ($sk->tempat_lahir ?: '-') . ", " . ($sk->tanggal_lahir ?: '-'));
                $this->line("  Status    : {$statusLabel}");
                if ($matchInfo) {
                    $this->line("  Match     :");
                    $this->line("<fg=gray>{$matchInfo}</>");
                }

                // Untuk CSV
                $csvRows[] = [
                    $sk->sk_id,
                    $sk->nomor_sk,
                    $sk->nama_sk,
                    $sk->unit_kerja,
                    $sk->nama_sekolah,
                    $sk->teacher_id ?: '',
                    $sk->nim ?: '',
                    $sk->tmt ?: '',
                    ($sk->tempat_lahir ?: '') . ', ' . ($sk->tanggal_lahir ?: ''),
                    $status['code'],
                    $status['message'],
                    $exact->isNotEmpty()
                        ? $exact->map(fn($t) => "ID:{$t->id}|{$t->nama}|deleted:" . ($t->deleted_at ?: 'no'))->implode('; ')
                        : ($fuzzy->isNotEmpty()
                            ? $fuzzy->take(3)->map(fn($t) => "FUZZY:ID:{$t->id}|{$t->nama}|deleted:" . ($t->deleted_at ?: 'no'))->implode('; ')
                            : ''),
                ];
            }
        }

        // ── Step 6: Summary ────────────────────────────────────────────────
        $this->line('');
        $this->line('═══════════════════════════════════════════════════════════');
        $this->info('  RINGKASAN');
        $this->line('═══════════════════════════════════════════════════════════');

        $statusGroups = collect($results)->groupBy(fn($r) => $r['status']['code']);
        $statusGroups->each(function ($group, $code) {
            $label = match ($code) {
                'TEACHER_SOFT_DELETED' => '⚠️  Teacher pernah ada tapi terhapus (soft-delete)',
                'NO_TEACHER_ID'       => '❌ Tidak ada teacher_id (kemungkinan dari bulk import)',
                'DATA_EMPTY'          => '⚠️  Teacher ada tapi datanya memang kosong di DB',
                'FUZZY_MATCH'         => '🔍 Nama berbeda sedikit — ada fuzzy match di teachers',
                'NO_MATCH'            => '❓ Tidak ditemukan sama sekali di teachers',
                default               => $code,
            };
            $this->line("  {$label}: <fg=white>" . $group->count() . "</>");
        });

        // ── Step 7: Export CSV (opsional) ──────────────────────────────────
        if ($csvPath) {
            $this->exportCsv($csvPath, $csvRows);
            $this->info("\n📄 CSV tersimpan: {$csvPath}");
        }

        $this->line('');
        $this->info('Rekomendasi tindakan:');
        $this->line('  1. TEACHER_SOFT_DELETED → restore dengan: UPDATE teachers SET deleted_at=NULL WHERE id=<id>');
        $this->line('  2. NO_TEACHER_ID        → jalankan: php artisan sk:link-teachers --dry-run');
        $this->line('  3. FUZZY_MATCH          → perbaiki nama guru di Data GTK agar sama persis dengan nama di SK');
        $this->line('  4. DATA_EMPTY           → lengkapi data guru di halaman Data GTK');
        $this->line('');

        return self::SUCCESS;
    }

    private function determineStatus(object $sk, $exactMatches, $fuzzyMatches): array
    {
        // Kasus 1: teacher_id ada, teacher ada (aktif), tapi datanya kosong
        if ($sk->teacher_id && !$sk->teacher_deleted_at && ($exactMatches->where('deleted_at', null)->isNotEmpty())) {
            return ['code' => 'DATA_EMPTY', 'message' => 'Teacher aktif tapi TMT/TTL/NIM kosong di DB'];
        }

        // Kasus 2: teacher_id ada tapi teacher sudah soft-deleted
        if ($sk->teacher_id && $sk->teacher_deleted_at) {
            return ['code' => 'TEACHER_SOFT_DELETED', 'message' => "Teacher di-delete pada {$sk->teacher_deleted_at}"];
        }

        // Kasus 3: teacher_id NULL, tapi exact match ditemukan di teachers
        if (!$sk->teacher_id && $exactMatches->isNotEmpty()) {
            $deleted = $exactMatches->whereNotNull('deleted_at');
            $active  = $exactMatches->whereNull('deleted_at');
            if ($active->isNotEmpty()) {
                return ['code' => 'NO_TEACHER_ID', 'message' => 'teacher_id NULL padahal nama cocok di teachers (aktif) — kemungkinan dari bulk import'];
            }
            if ($deleted->isNotEmpty()) {
                return ['code' => 'TEACHER_SOFT_DELETED', 'message' => 'teacher_id NULL, nama cocok dengan teacher yang sudah di-delete'];
            }
        }

        // Kasus 4: teacher_id NULL, tidak ada exact match, tapi ada fuzzy match
        if (!$sk->teacher_id && $fuzzyMatches->isNotEmpty()) {
            return ['code' => 'FUZZY_MATCH', 'message' => 'Tidak ada exact match tapi ada nama serupa di teachers'];
        }

        // Kasus 5: teacher_id NULL, tidak ada match sama sekali
        if (!$sk->teacher_id) {
            return ['code' => 'NO_MATCH', 'message' => 'Nama tidak ditemukan di tabel teachers sama sekali'];
        }

        // Kasus 6: teacher_id ada tapi exact match di-delete (teacher_id masih ada di join)
        if ($exactMatches->whereNotNull('deleted_at')->isNotEmpty()) {
            return ['code' => 'TEACHER_SOFT_DELETED', 'message' => 'Teacher exact match ditemukan tapi sudah di-delete'];
        }

        return ['code' => 'DATA_EMPTY', 'message' => 'Teacher ada, data kosong'];
    }

    private function exportCsv(string $path, array $rows): void
    {
        $handle = fopen($path, 'w');
        // BOM untuk Excel UTF-8
        fwrite($handle, "\xEF\xBB\xBF");
        fputcsv($handle, [
            'SK ID', 'Nomor SK', 'Nama di SK', 'Unit Kerja', 'Sekolah',
            'teacher_id', 'NIM', 'TMT', 'TTL', 'Status Code', 'Keterangan', 'Match Info'
        ]);
        foreach ($rows as $row) {
            fputcsv($handle, $row);
        }
        fclose($handle);
    }
}
