<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\School;
use App\Services\StudentStatisticsService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * StudentStatisticsController
 *
 * Provides endpoints for student statistics per jenjang, per madrasah, and per kelas.
 * Includes Excel export functionality for per-kelas and rekap per-jenjang data.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.7, 2.1, 2.2, 2.5, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6,
 *               5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.1, 6.2, 6.3, 6.4
 */
class StudentStatisticsController extends Controller
{
    use ApiResponse;

    private const VALID_JENJANG = ['ra', 'mi', 'mts', 'ma', 'tidak_terdefinisi', 'lainnya'];

    public function __construct(
        private StudentStatisticsService $service
    ) {}

    /**
     * GET /api/student-statistics/per-jenjang
     *
     * Returns aggregated student counts per jenjang category.
     */
    public function perJenjang(Request $request): JsonResponse
    {
        $schoolId = $this->resolveSchoolId($request);

        $data = $this->service->getPerJenjang($schoolId);

        return $this->successResponse($data);
    }

    /**
     * GET /api/student-statistics/per-jenjang/{jenjang}/madrasah
     *
     * Returns list of madrasah with active student counts for a given jenjang.
     */
    public function madrasahByJenjang(Request $request, string $jenjang): JsonResponse
    {
        if (!$this->isValidJenjang($jenjang)) {
            return $this->errorResponse('Kategori jenjang tidak valid.', null, 400);
        }

        $schoolId = $this->resolveSchoolId($request);

        $data = $this->service->getMadrasahByJenjang($jenjang, $schoolId);

        return $this->successResponse($data);
    }

    /**
     * GET /api/student-statistics/madrasah/{id}/per-kelas
     *
     * Returns student counts per kelas for a specific madrasah.
     */
    public function perKelas(Request $request, int $id): JsonResponse
    {
        $school = School::find($id);

        if (!$school) {
            return $this->errorResponse('Madrasah tidak ditemukan.', null, 404);
        }

        $data = $this->service->getPerKelas($id);

        return $this->successResponse($data);
    }

    /**
     * GET /api/student-statistics/madrasah/{id}/per-kelas/export
     *
     * Generates Excel file with per-kelas student counts for a specific madrasah.
     * Columns: Nama Madrasah, NPSN, Kelas, Jumlah Siswa + summary row.
     */
    public function exportPerKelas(Request $request, int $id): BinaryFileResponse|JsonResponse
    {
        $school = School::find($id);

        if (!$school) {
            return $this->errorResponse('Madrasah tidak ditemukan.', null, 404);
        }

        try {
            $kelasData = $this->service->getPerKelas($id);
            $filename = $this->service->generateExportFilename('Jumlah_Siswa', $school->nama);

            $totalSiswa = $kelasData->sum('jumlah_siswa');

            $export = new class($school, $kelasData, $totalSiswa) implements FromCollection, WithHeadings {
                public function __construct(
                    private School $school,
                    private $kelasData,
                    private int $totalSiswa
                ) {}

                public function headings(): array
                {
                    return ['Nama Madrasah', 'NPSN', 'Kelas', 'Jumlah Siswa'];
                }

                public function collection()
                {
                    $rows = [];

                    foreach ($this->kelasData as $item) {
                        $rows[] = [
                            $this->school->nama,
                            $this->school->npsn,
                            $item->kelas,
                            $item->jumlah_siswa,
                        ];
                    }

                    // Summary row
                    $rows[] = [
                        $this->school->nama,
                        $this->school->npsn,
                        'TOTAL',
                        $this->totalSiswa,
                    ];

                    return collect($rows);
                }
            };

            return Excel::download($export, $filename);
        } catch (\Exception $e) {
            \Log::error('Failed to generate per-kelas Excel export', [
                'school_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->errorResponse('Gagal menghasilkan file Excel.', null, 500);
        }
    }

    /**
     * GET /api/student-statistics/per-jenjang/{jenjang}/export
     *
     * Generates Excel file with rekap per-madrasah student counts for a given jenjang.
     * Columns: No, Nama Madrasah, NPSN, Kecamatan, Jumlah Siswa + grand total row.
     */
    public function exportRekapPerJenjang(Request $request, string $jenjang): BinaryFileResponse|JsonResponse
    {
        if (!$this->isValidJenjang($jenjang)) {
            return $this->errorResponse('Kategori jenjang tidak valid.', null, 400);
        }

        try {
            $schoolId = $this->resolveSchoolId($request);
            $madrasahData = $this->service->getMadrasahByJenjang($jenjang, $schoolId);

            // Sort alphabetically by nama for export (requirement 5.4)
            $madrasahData = $madrasahData->sortBy('nama')->values();

            $filename = $this->service->generateExportFilename('Rekap_Siswa', $jenjang);
            $grandTotal = $madrasahData->sum('jumlah_siswa');

            $export = new class($madrasahData, $grandTotal) implements FromCollection, WithHeadings {
                public function __construct(
                    private $madrasahData,
                    private int $grandTotal
                ) {}

                public function headings(): array
                {
                    return ['No', 'Nama Madrasah', 'NPSN', 'Kecamatan', 'Jumlah Siswa'];
                }

                public function collection()
                {
                    $rows = [];
                    $no = 1;

                    foreach ($this->madrasahData as $item) {
                        $rows[] = [
                            $no++,
                            $item->nama,
                            $item->npsn,
                            $item->kecamatan ?? '-',
                            $item->jumlah_siswa,
                        ];
                    }

                    // Grand total row
                    $rows[] = [
                        '',
                        'TOTAL',
                        '',
                        '',
                        $this->grandTotal,
                    ];

                    return collect($rows);
                }
            };

            return Excel::download($export, $filename);
        } catch (\Exception $e) {
            \Log::error('Failed to generate rekap per-jenjang Excel export', [
                'jenjang' => $jenjang,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->errorResponse('Gagal menghasilkan file Excel.', null, 500);
        }
    }

    /**
     * Resolve the school_id based on the authenticated user's role.
     * Operators are scoped to their own school; admins see all data.
     */
    private function resolveSchoolId(Request $request): ?int
    {
        $user = $request->user();

        if ($user->isOperator()) {
            return $user->school_id;
        }

        return null;
    }

    /**
     * Validate that the jenjang parameter is one of the accepted categories.
     */
    private function isValidJenjang(string $jenjang): bool
    {
        return in_array(strtolower($jenjang), self::VALID_JENJANG);
    }
}
