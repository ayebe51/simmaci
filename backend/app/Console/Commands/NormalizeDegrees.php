<?php

namespace App\Console\Commands;

use App\Models\Teacher;
use App\Services\NormalizationService;
use Illuminate\Console\Command;

class NormalizeDegrees extends Command
{
    protected $signature = 'data:normalize-degrees
                            {--field=nama : Field yang dinormalisasi: nama, pendidikan_terakhir, atau all}
                            {--school= : Filter berdasarkan school_id}
                            {--dry-run : Preview perubahan tanpa menyimpan}
                            {--limit= : Batasi jumlah record yang diproses}
                            {--show-unchanged : Tampilkan juga record yang tidak berubah}';

    protected $description = 'Normalisasi gelar akademik pada data guru (field nama dan/atau pendidikan_terakhir)';

    public function __construct(private NormalizationService $normalizationService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun       = $this->option('dry-run');
        $field        = $this->option('field');
        $schoolId     = $this->option('school');
        $limit        = $this->option('limit') ? (int) $this->option('limit') : null;
        $showUnchanged = $this->option('show-unchanged');

        $validFields = ['nama', 'pendidikan_terakhir', 'all'];
        if (!in_array($field, $validFields, true)) {
            $this->error("Field tidak valid: '{$field}'. Pilihan: nama, pendidikan_terakhir, all");
            return self::FAILURE;
        }

        $fields = $field === 'all'
            ? ['nama', 'pendidikan_terakhir']
            : [$field];

        if ($dryRun) {
            $this->warn('DRY RUN — tidak ada perubahan yang disimpan.');
        }

        $this->info("Field: " . implode(', ', $fields));
        if ($schoolId) {
            $this->info("Filter school_id: {$schoolId}");
        }
        $this->newLine();

        $stats = array_fill_keys($fields, ['fixed' => 0, 'skipped' => 0]);

        $query = Teacher::withoutTenantScope()->orderBy('id');

        if ($schoolId) {
            $query->where('school_id', $schoolId);
        }

        if ($limit) {
            $query->limit($limit);
        }

        $query->chunkById(200, function ($teachers) use ($dryRun, $fields, $showUnchanged, &$stats) {
            foreach ($teachers as $teacher) {
                $changes = [];

                foreach ($fields as $f) {
                    $original = $teacher->{$f};

                    if ($original === null || trim($original) === '') {
                        $stats[$f]['skipped']++;
                        continue;
                    }

                    $normalized = $f === 'nama'
                        ? $this->normalizationService->normalizeTeacherName($original)
                        : $this->normalizeDegreesOnly($original);

                    if ($original === $normalized) {
                        $stats[$f]['skipped']++;
                        if ($showUnchanged) {
                            $this->line("  <fg=gray>ID {$teacher->id} [{$f}]: '{$original}' (tidak berubah)</>");
                        }
                        continue;
                    }

                    $changes[$f] = ['from' => $original, 'to' => $normalized];
                    $stats[$f]['fixed']++;
                }

                if (!empty($changes)) {
                    foreach ($changes as $f => $diff) {
                        $this->line("  <fg=yellow>ID {$teacher->id}</> [{$f}]: '<fg=red>{$diff['from']}</>' → '<fg=green>{$diff['to']}</>'");
                    }

                    if (!$dryRun) {
                        $teacher->update(array_map(fn($c) => $c['to'], $changes));
                    }
                }
            }
        });

        $this->newLine();
        foreach ($fields as $f) {
            $fixed   = $stats[$f]['fixed'];
            $skipped = $stats[$f]['skipped'];
            $suffix  = $dryRun ? ' (dry run)' : '';
            $this->info("[{$f}] → {$fixed} dinormalisasi, {$skipped} tidak berubah{$suffix}");
        }

        return self::SUCCESS;
    }

    /**
     * Normalize only the degree portion of a pendidikan_terakhir value.
     *
     * pendidikan_terakhir biasanya berisi nilai seperti:
     *   "S1", "S2", "S.Pd.", "AMAPDSD", "A.Ma.Pd.SD.", "Strata 1", dll.
     *
     * Jika nilainya adalah singkatan gelar yang dikenali (tanpa nama orang),
     * kembalikan bentuk kanoniknya. Jika tidak dikenali, kembalikan as-is.
     */
    private function normalizeDegreesOnly(string $value): string
    {
        $trimmed = trim($value);

        // Mapping sederhana untuk nilai pendidikan_terakhir yang umum
        $map = [
            // Strata
            'S1'       => 'S1',
            'S2'       => 'S2',
            'S3'       => 'S3',
            'STRATA1'  => 'S1',
            'STRATA2'  => 'S2',
            'STRATA3'  => 'S3',
            'STRATA 1' => 'S1',
            'STRATA 2' => 'S2',
            'STRATA 3' => 'S3',
            // Diploma
            'D1'       => 'D1',
            'D2'       => 'D2',
            'D3'       => 'D3',
            'D4'       => 'D4',
            'DIII'     => 'D3',
            'DIV'      => 'D4',
            // SMA/sederajat
            'SMA'      => 'SMA',
            'SMK'      => 'SMK',
            'MA'       => 'MA',
            'SLTA'     => 'SLTA',
            'SMP'      => 'SMP',
            'MTS'      => 'MTs',
            'SLTP'     => 'SLTP',
            'SD'       => 'SD',
            'MI'       => 'MI',
        ];

        $key = mb_strtoupper(preg_replace('/[\s.]+/', '', $trimmed), 'UTF-8');

        if (isset($map[$key])) {
            return $map[$key];
        }

        // Jika nilai mengandung gelar akademik (misal "AMAPDSD", "SPDSD"),
        // coba normalisasi sebagai nama gelar saja menggunakan normalizeTeacherName
        // dengan membungkusnya sebagai nama dummy lalu ekstrak hasilnya.
        // Hanya lakukan ini jika nilai tidak mengandung spasi (kemungkinan besar gelar saja).
        if (!str_contains($trimmed, ' ')) {
            $asName = $this->normalizationService->normalizeTeacherName($trimmed);
            // Jika hasilnya berbeda dan mengandung koma (artinya gelar terdeteksi),
            // ambil bagian gelarnya saja
            if ($asName !== $trimmed && str_contains($asName, ',')) {
                $parts = explode(',', $asName, 2);
                return trim($parts[1]);
            }
        }

        return $trimmed;
    }
}
