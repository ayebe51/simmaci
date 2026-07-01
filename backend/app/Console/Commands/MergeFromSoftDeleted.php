<?php

namespace App\Console\Commands;

use App\Models\Teacher;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MergeFromSoftDeleted extends Command
{
    protected $signature = 'teachers:merge-from-deleted
                            {--date= : Tanggal soft-delete yang ingin di-merge (format: YYYY-MM-DD, default: hari ini)}
                            {--dry-run : Hanya tampilkan preview tanpa menyimpan}';

    protected $description = 'Merge field-field yang kosong di guru aktif dengan data dari guru yang ter-soft-delete (duplikat) pada tanggal tertentu.';

    public function handle(): int
    {
        $date = $this->option('date') ?? now()->toDateString();
        $isDryRun = $this->option('dry-run');

        if ($isDryRun) {
            $this->info("🔍 DRY RUN — tidak ada perubahan yang disimpan.");
        }

        $this->info("Mencari guru yang di-soft-delete pada tanggal {$date}...");
        $this->newLine();

        $deletedTeachers = Teacher::withoutTenantScope()
            ->onlyTrashed()
            ->whereDate('deleted_at', $date)
            ->get();

        if ($deletedTeachers->isEmpty()) {
            $this->warn("Tidak ada guru yang di-soft-delete pada tanggal {$date}.");
            return self::SUCCESS;
        }

        $this->info("Ditemukan {$deletedTeachers->count()} guru yang ter-soft-delete.");
        $this->newLine();

        $mergeFields = [
            'school_id', 'nuptk', 'nomor_induk_maarif', 'nip',
            'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin',
            'pendidikan_terakhir', 'mapel', 'unit_kerja',
            'status_kepegawaian', 'status', 'tmt',
            'phone_number', 'email', 'is_certified',
            'provinsi', 'kabupaten', 'kecamatan', 'kelurahan',
            'pdpkpnu', 'kta_number',
            'photo_id', 'surat_permohonan_url',
            'nomor_surat_permohonan', 'tanggal_surat_permohonan',
        ];

        $invalidValues = ['-', 'null', 'NULL', 'N/A', '_', 'n/a', 'undefined'];

        $totalMerged = 0;
        $totalFieldsMerged = 0;
        $noMatchFound = 0;

        foreach ($deletedTeachers as $deleted) {
            // Extract bare name (before comma)
            $bareName = strtoupper(trim(explode(',', $deleted->nama)[0]));

            // Find active teacher with same bare name
            $candidates = Teacher::withoutTenantScope()
                ->whereNull('deleted_at')
                ->whereRaw("UPPER(TRIM(SPLIT_PART(nama, ',', 1))) = ?", [$bareName])
                ->get();

            if ($candidates->isEmpty()) {
                $noMatchFound++;
                continue;
            }

            // Find the best match: same school_id, same unit_kerja, or same NUPTK
            $activeMatch = null;
            foreach ($candidates as $candidate) {
                $sameSchool = $deleted->school_id && $candidate->school_id && $deleted->school_id === $candidate->school_id;
                $sameNuptk = !empty($deleted->nuptk) && $deleted->nuptk === $candidate->nuptk;
                $sameNim = !empty($deleted->nomor_induk_maarif) && $deleted->nomor_induk_maarif === $candidate->nomor_induk_maarif;

                $deletedUnit = strtoupper(trim($deleted->unit_kerja ?? ''));
                $candidateUnit = strtoupper(trim($candidate->unit_kerja ?? ''));
                $sameUnit = !empty($deletedUnit) && !empty($candidateUnit) && $deletedUnit === $candidateUnit;

                if ($sameSchool || $sameUnit || $sameNuptk || $sameNim) {
                    $activeMatch = $candidate;
                    break;
                }
            }

            // Fallback: if only 1 candidate, use it
            if (!$activeMatch && $candidates->count() === 1) {
                $activeMatch = $candidates->first();
            }

            if (!$activeMatch) {
                $noMatchFound++;
                continue;
            }

            // Merge fields
            $merged = [];
            foreach ($mergeFields as $f) {
                $activeVal = $activeMatch->$f;
                $deletedVal = $deleted->$f;

                $activeEmpty = empty($activeVal) || in_array(trim((string)$activeVal), $invalidValues);
                $deletedEmpty = empty($deletedVal) || in_array(trim((string)$deletedVal), $invalidValues);

                if ($activeEmpty && !$deletedEmpty) {
                    $activeMatch->$f = $deletedVal;
                    $merged[] = "{$f}=\"{$deletedVal}\"";
                }
            }

            if (!empty($merged)) {
                $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                $this->info("✅ KEEP (aktif): ID={$activeMatch->id} | \"{$activeMatch->nama}\"");
                $this->warn("📥 FROM (deleted): ID={$deleted->id} | \"{$deleted->nama}\"");
                $this->line("   📋 Merged: " . implode(', ', $merged));

                if (!$isDryRun) {
                    $activeMatch->save();
                }

                $totalMerged++;
                $totalFieldsMerged += count($merged);
            }
        }

        $this->newLine();
        $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        $mode = $isDryRun ? ' (dry run)' : '';
        $this->info("📊 Hasil{$mode}:");
        $this->info("   - Guru ter-soft-delete: {$deletedTeachers->count()}");
        $this->info("   - Berhasil di-merge: {$totalMerged} guru ({$totalFieldsMerged} field)");
        $this->info("   - Tidak ada pasangan aktif: {$noMatchFound}");

        return self::SUCCESS;
    }
}
