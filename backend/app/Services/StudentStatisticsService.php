<?php

namespace App\Services;

use App\Models\Student;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * StudentStatisticsService
 *
 * Provides aggregated student statistics per jenjang, per madrasah, and per kelas.
 * Uses database-level GROUP BY for performance with large datasets.
 */
class StudentStatisticsService
{
    /**
     * Get aggregated student counts per jenjang category.
     * Categories: RA, MI, MTs, MA, Tidak Terdefinisi, Lainnya
     *
     * @param int|null $schoolId — if provided, scope to this school only
     * @return array{categories: array, total: int}
     */
    public function getPerJenjang(?int $schoolId = null): array
    {
        $query = Student::withoutTenantScope()
            ->join('schools as s', 'students.school_id', '=', 's.id')
            ->where('students.status', 'Aktif')
            ->whereNull('students.deleted_at')
            ->whereNull('s.deleted_at');

        if ($schoolId) {
            $query->where('students.school_id', $schoolId);
        }

        $results = $query
            ->selectRaw("
                CASE
                    WHEN s.jenjang IS NULL OR TRIM(s.jenjang) = '' THEN 'Tidak Terdefinisi'
                    WHEN LOWER(s.jenjang) IN ('ra') THEN 'RA'
                    WHEN LOWER(s.jenjang) IN ('mi') THEN 'MI'
                    WHEN LOWER(s.jenjang) IN ('mts') THEN 'MTs'
                    WHEN LOWER(s.jenjang) IN ('ma') THEN 'MA'
                    ELSE 'Lainnya'
                END AS jenjang_category,
                COUNT(students.id) AS jumlah_siswa
            ")
            ->groupBy('jenjang_category')
            ->get();

        $total = $results->sum('jumlah_siswa');

        // Ensure all categories are present, even with 0 count
        $allCategories = ['RA', 'MI', 'MTs', 'MA', 'Tidak Terdefinisi', 'Lainnya'];
        $categories = [];

        foreach ($allCategories as $category) {
            $found = $results->firstWhere('jenjang_category', $category);
            $jumlah = $found ? (int) $found->jumlah_siswa : 0;
            $persentase = $total > 0 ? (int) round(($jumlah / $total) * 100) : 0;

            $categories[] = [
                'jenjang' => $category,
                'jumlah_siswa' => $jumlah,
                'persentase' => $persentase,
            ];
        }

        return [
            'categories' => $categories,
            'total' => $total,
        ];
    }

    /**
     * Get list of madrasah with active student counts for a given jenjang category.
     * Sorted by student count descending.
     *
     * @param string $jenjangCategory — one of: RA, MI, MTs, MA, tidak_terdefinisi, lainnya
     * @param int|null $schoolId — if provided, scope to this school only
     * @return Collection
     */
    public function getMadrasahByJenjang(string $jenjangCategory, ?int $schoolId = null): Collection
    {
        $query = DB::table('schools as s')
            ->leftJoin('students as st', function ($join) {
                $join->on('st.school_id', '=', 's.id')
                    ->where('st.status', '=', 'Aktif')
                    ->whereNull('st.deleted_at');
            })
            ->whereNull('s.deleted_at');

        // Apply jenjang filter based on category
        $this->applyJenjangFilter($query, $jenjangCategory);

        if ($schoolId) {
            $query->where('s.id', $schoolId);
        }

        return $query
            ->select([
                's.id',
                's.nama',
                's.npsn',
                's.kecamatan',
                DB::raw('COUNT(st.id) AS jumlah_siswa'),
            ])
            ->groupBy('s.id', 's.nama', 's.npsn', 's.kecamatan')
            ->orderByDesc('jumlah_siswa')
            ->get();
    }

    /**
     * Get student counts per kelas for a specific madrasah.
     * Sorted alphanumerically, "Belum Ditentukan" last.
     *
     * @param int $schoolId
     * @return Collection
     */
    public function getPerKelas(int $schoolId): Collection
    {
        return DB::table('students')
            ->where('school_id', $schoolId)
            ->where('status', 'Aktif')
            ->whereNull('deleted_at')
            ->selectRaw("
                CASE
                    WHEN kelas IS NULL OR TRIM(kelas) = '' THEN 'Belum Ditentukan'
                    ELSE TRIM(kelas)
                END AS kelas,
                COUNT(*) AS jumlah_siswa
            ")
            ->groupBy('kelas')
            ->orderByRaw("CASE WHEN kelas IS NULL OR TRIM(kelas) = '' THEN 1 ELSE 0 END")
            ->orderBy('kelas')
            ->get();
    }

    /**
     * Categorize a jenjang value into one of the standard categories.
     * - NULL/empty → "Tidak Terdefinisi"
     * - RA, MI, MTs, MA (case-insensitive) → respective category
     * - anything else → "Lainnya"
     *
     * @param string|null $jenjang
     * @return string
     */
    public function categorizeJenjang(?string $jenjang): string
    {
        if ($jenjang === null || trim($jenjang) === '') {
            return 'Tidak Terdefinisi';
        }

        $normalized = strtolower(trim($jenjang));

        return match ($normalized) {
            'ra' => 'RA',
            'mi' => 'MI',
            'mts' => 'MTs',
            'ma' => 'MA',
            default => 'Lainnya',
        };
    }

    /**
     * Normalize kelas value.
     * - NULL/empty/whitespace-only → "Belum Ditentukan"
     * - otherwise → trimmed value
     *
     * @param string|null $kelas
     * @return string
     */
    public function normalizeKelas(?string $kelas): string
    {
        if ($kelas === null || trim($kelas) === '') {
            return 'Belum Ditentukan';
        }

        return trim($kelas);
    }

    /**
     * Generate sanitized filename for export.
     * Replaces special characters with underscores, appends timestamp.
     *
     * @param string $prefix — e.g., "Jumlah_Siswa" or "Rekap_Siswa"
     * @param string $identifier — e.g., madrasah name or jenjang
     * @return string — e.g., "Jumlah_Siswa_MI_Nurul_Huda_20250101_120000.xlsx"
     */
    public function generateExportFilename(string $prefix, string $identifier): string
    {
        // Replace any non-alphanumeric character (except underscores) with underscore
        $sanitized = preg_replace('/[^a-zA-Z0-9_]/', '_', $identifier);

        // Collapse multiple consecutive underscores into one
        $sanitized = preg_replace('/_+/', '_', $sanitized);

        // Remove leading/trailing underscores
        $sanitized = trim($sanitized, '_');

        // Fallback if sanitized result is empty (all special characters input)
        if ($sanitized === '') {
            $sanitized = 'unnamed';
        }

        $timestamp = now()->format('Ymd_His');

        return "{$prefix}_{$sanitized}_{$timestamp}.xlsx";
    }

    /**
     * Apply jenjang category filter to a query builder.
     *
     * @param \Illuminate\Database\Query\Builder $query
     * @param string $jenjangCategory
     * @return void
     */
    private function applyJenjangFilter($query, string $jenjangCategory): void
    {
        $category = strtolower($jenjangCategory);

        match ($category) {
            'ra' => $query->whereRaw("LOWER(s.jenjang) = 'ra'"),
            'mi' => $query->whereRaw("LOWER(s.jenjang) = 'mi'"),
            'mts' => $query->whereRaw("LOWER(s.jenjang) = 'mts'"),
            'ma' => $query->whereRaw("LOWER(s.jenjang) = 'ma'"),
            'tidak_terdefinisi' => $query->where(function ($q) {
                $q->whereNull('s.jenjang')
                    ->orWhereRaw("TRIM(s.jenjang) = ''");
            }),
            'lainnya' => $query->where(function ($q) {
                $q->whereNotNull('s.jenjang')
                    ->whereRaw("TRIM(s.jenjang) != ''")
                    ->whereRaw("LOWER(s.jenjang) NOT IN ('ra', 'mi', 'mts', 'ma')");
            }),
            default => $query->whereRaw('1 = 0'), // Invalid category returns no results
        };
    }
}
