<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardCacheService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class PublicPortalController extends Controller
{
    public function __construct(
        protected DashboardCacheService $cacheService
    ) {}

    /**
     * GET /api/public/portal/stats
     * Returns macro KPI counts for public landing hero section.
     * Cached for 30 minutes.
     */
    public function stats(): JsonResponse
    {
        $data = Cache::remember('public:landing-stats', 1800, function () {
            // Formal schools (MI, MTs, MA, SMK) - exclude RA/TK/PAUD/BA
            $schoolsQuery = DB::table('schools')
                ->whereNull('deleted_at')
                ->where(function ($q) {
                    $q->whereNull('jenjang')
                      ->orWhereRaw("UPPER(TRIM(jenjang)) NOT IN ('RA', 'TK', 'PAUD', 'BA')");
                })
                ->whereRaw("UPPER(TRIM(nama)) NOT LIKE 'RA %'")
                ->whereRaw("UPPER(TRIM(nama)) NOT LIKE 'TK %'")
                ->whereRaw("UPPER(TRIM(nama)) NOT LIKE 'PAUD %'")
                ->whereRaw("UPPER(TRIM(nama)) NOT LIKE 'BA %'");

            $totalSchools = (clone $schoolsQuery)->count();
            $schoolIds = (clone $schoolsQuery)->pluck('id')->toArray();

            $totalTeachers = DB::table('teachers')
                ->whereIn('school_id', $schoolIds)
                ->whereNull('deleted_at')
                ->where('is_active', true)
                ->where(function ($q) {
                    $q->whereNull('status')
                      ->orWhere('status', '!=', 'Tendik');
                })
                ->count();

            $totalTendiks = DB::table('teachers')
                ->whereIn('school_id', $schoolIds)
                ->whereNull('deleted_at')
                ->where('is_active', true)
                ->where('status', 'Tendik')
                ->count();

            // Student count: for MI/SD strictly prioritize manual input; for other levels use max(detail, manual)
            $studentDetailCounts = DB::table('students')
                ->whereIn('school_id', $schoolIds)
                ->whereNull('deleted_at')
                ->selectRaw('school_id, count(*) as count')
                ->groupBy('school_id')
                ->pluck('count', 'school_id')
                ->toArray();

            $schoolsMeta = DB::table('schools')
                ->whereIn('id', $schoolIds)
                ->select('id', 'jenjang', 'nama', 'jumlah_siswa_manual')
                ->get()
                ->keyBy('id');

            $totalStudents = 0;
            foreach ($schoolIds as $sId) {
                $sch = $schoolsMeta->get($sId);
                $detail = (int) ($studentDetailCounts[$sId] ?? 0);
                $manual = (int) ($sch?->jumlah_siswa_manual ?? 0);
                if ($manual > 0) {
                    $totalStudents += $manual;
                } elseif ($detail > 0) {
                    $totalStudents += $detail;
                }
            }

            return [
                'total_schools' => $totalSchools,
                'total_teachers' => $totalTeachers,
                'total_tendiks' => $totalTendiks,
                'total_students' => $totalStudents,
                'total_districts' => 24,
                'updated_at' => now()->toIso8601String(),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * GET /api/public/portal/distribution-map
     * Returns distribution map data per kecamatan for public.
     * Cached for 30 minutes.
     */
    public function distributionMap(): JsonResponse
    {
        $data = $this->cacheService->getPublicDistributionMap();

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * GET /api/public/portal/schools-directory
     * Public search directory for madrasahs with strictly sanitized columns.
     */
    public function schoolsDirectory(Request $request): JsonResponse
    {
        $query = DB::table('schools')
            ->whereNull('deleted_at')
            ->where(function ($q) {
                $q->whereNull('jenjang')
                  ->orWhereRaw("UPPER(TRIM(jenjang)) NOT IN ('RA', 'TK', 'PAUD', 'BA')");
            })
            ->whereRaw("UPPER(TRIM(nama)) NOT LIKE 'RA %'")
            ->whereRaw("UPPER(TRIM(nama)) NOT LIKE 'TK %'")
            ->whereRaw("UPPER(TRIM(nama)) NOT LIKE 'PAUD %'")
            ->whereRaw("UPPER(TRIM(nama)) NOT LIKE 'BA %'");

        if ($request->filled('search')) {
            $search = '%' . trim($request->search) . '%';
            $query->where(function ($q) use ($search) {
                $q->where('nama', 'LIKE', $search)
                  ->orWhere('nsm', 'LIKE', $search)
                  ->orWhere('npsn', 'LIKE', $search);
            });
        }

        if ($request->filled('kecamatan') && $request->kecamatan !== 'all') {
            $query->where('kecamatan', $request->kecamatan);
        }

        if ($request->filled('jenjang') && $request->jenjang !== 'all') {
            $jenjang = strtoupper(trim($request->jenjang));
            $isMtsSmp = in_array($jenjang, ['MTS', 'SMP', 'MTS / SMP', 'MTS/SMP', 'MTS - SMP']);
            $isMaSmkSma = in_array($jenjang, ['MA', 'SMK', 'SMA', 'MA / SMK / SMA', 'MA/SMK/SMA', 'MA - SMK - SMA']);
            $isMiSd = in_array($jenjang, ['MI', 'SD', 'MI / SD', 'MI/SD', 'MI - SD']);

            $query->where(function ($q) use ($jenjang, $isMtsSmp, $isMaSmkSma, $isMiSd) {
                if ($isMtsSmp) {
                    $q->whereIn(DB::raw("UPPER(COALESCE(jenjang, ''))"), ['MTS', 'SMP'])
                      ->orWhereRaw("UPPER(nama) LIKE 'MTS %'")
                      ->orWhereRaw("UPPER(nama) LIKE '% MTS %'")
                      ->orWhereRaw("UPPER(nama) LIKE '%TSANAWIYAH%'")
                      ->orWhereRaw("UPPER(nama) LIKE 'SMP %'")
                      ->orWhereRaw("UPPER(nama) LIKE '% SMP %'");
                } elseif ($isMaSmkSma) {
                    $q->whereIn(DB::raw("UPPER(COALESCE(jenjang, ''))"), ['MA', 'SMK', 'SMA'])
                      ->orWhere(function ($sub) {
                          $sub->where(function ($s2) {
                              $s2->whereRaw("UPPER(nama) LIKE 'MA %'")
                                 ->whereRaw("UPPER(nama) NOT LIKE 'SMA %'")
                                 ->whereRaw("UPPER(nama) NOT LIKE 'SMK %'");
                          })
                          ->orWhereRaw("UPPER(nama) LIKE '% MA %'")
                          ->orWhereRaw("UPPER(nama) LIKE '%ALIYAH%'")
                          ->orWhereRaw("UPPER(nama) LIKE 'SMK %'")
                          ->orWhereRaw("UPPER(nama) LIKE '% SMK %'")
                          ->orWhereRaw("UPPER(nama) LIKE '%KEJURUAN%'")
                          ->orWhereRaw("UPPER(nama) LIKE 'SMA %'")
                          ->orWhereRaw("UPPER(nama) LIKE '% SMA %'");
                      });
                } elseif ($isMiSd) {
                    $q->whereIn(DB::raw("UPPER(COALESCE(jenjang, ''))"), ['MI', 'SD'])
                      ->orWhereRaw("UPPER(nama) LIKE 'MI %'")
                      ->orWhereRaw("UPPER(nama) LIKE '% MI %'")
                      ->orWhereRaw("UPPER(nama) LIKE '%IBTIDAIYAH%'")
                      ->orWhereRaw("UPPER(nama) LIKE 'SD %'")
                      ->orWhereRaw("UPPER(nama) LIKE '% SD %'");
                } else {
                    $q->whereRaw("UPPER(COALESCE(jenjang, '')) = ?", [$jenjang]);
                }
            });
        }

        $paginated = $query
            ->select([
                'id',
                'nama',
                'nsm',
                'npsn',
                'jenjang',
                'status_jamiyyah',
                'akreditasi',
                'kecamatan',
                'alamat',
                'telepon',
            ])
            ->orderBy('nama', 'asc')
            ->paginate((int) ($request->per_page ?? 12));

        return response()->json([
            'success' => true,
            'data' => $paginated->items(),
            'current_page' => $paginated->currentPage(),
            'last_page' => $paginated->lastPage(),
            'per_page' => $paginated->perPage(),
            'total' => $paginated->total(),
        ]);
    }
}
