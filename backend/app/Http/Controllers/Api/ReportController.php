<?php

namespace App\Http\Controllers\Api;

use App\Exports\SkBelumMengajukanExport;
use App\Http\Controllers\Controller;
use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ReportController extends Controller
{
    /**
     * GET /api/reports/sk — SK summary report
     */
    public function skReport(Request $request): JsonResponse
    {
        $query = SkDocument::with(['teacher', 'school']);

        if ($request->user()->isOperator()) {
            $query->forSchool($request->user()->school_id);
        } elseif ($request->school_id) {
            $query->forSchool($request->school_id);
        }

        if ($request->jenis_sk) $query->byJenis($request->jenis_sk);
        if ($request->status) $query->byStatus($request->status);
        if ($request->start_date) $query->where('created_at', '>=', $request->start_date);
        if ($request->end_date) $query->where('created_at', '<=', $request->end_date);

        $sks = $query->orderByDesc('created_at')->get();

        // Normalize status to canonical values for counting
        // approved/active/Approved/Active → approved
        // rejected/Rejected → rejected
        // pending → pending
        // draft → draft
        $approvedCount  = $sks->filter(fn($s) => in_array(strtolower($s->status), ['approved', 'active']))->count();
        $pendingCount   = $sks->filter(fn($s) => strtolower($s->status) === 'pending')->count();
        $rejectedCount  = $sks->filter(fn($s) => strtolower($s->status) === 'rejected')->count();
        $draftCount     = $sks->filter(fn($s) => strtolower($s->status) === 'draft')->count();

        $summary = [
            'total'    => $sks->count(),
            'approved' => $approvedCount,
            'pending'  => $pendingCount,
            'rejected' => $rejectedCount,
            'draft'    => $draftCount,
        ];

        // Group by jenis_sk — normalize to lowercase and strip "sk " prefix for matching
        // e.g. "SK GTY" → "gty", "SK GTT" → "gtt", "SK Tendik" → "tendik"
        $byJenis = $sks->groupBy(function ($item) {
            $raw = strtolower(trim($item->jenis_sk ?? ''));
            // Strip leading "sk " prefix
            return preg_replace('/^sk\s+/', '', $raw);
        })->map->count();

        $byType = [
            'gty'    => $byJenis->get('gty', 0),
            'gtt'    => $byJenis->get('gtt', 0),
            'kamad'  => $byJenis->filter(fn($v, $k) => str_contains($k, 'kamad') || str_contains($k, 'kepala'))->sum(),
            'tendik' => $byJenis->filter(fn($v, $k) => str_contains($k, 'tendik'))->sum(),
        ];

        return response()->json([
            'summary' => $summary,
            'byType' => $byType,
            'data' => $sks,
        ]);
    }

    /**
     * GET /api/reports/teachers — Teacher summary report
     *
     * Query params:
     *   search        — filter by nama / nuptk / nip
     *   status        — filter by status (GTY, GTT, PNS, etc.)
     *   kecamatan     — filter by kecamatan
     *   is_certified  — filter by certification (1 / 0)
     *   is_active     — filter by active status (1 / 0, default: all)
     *   school_id     — filter by school (super_admin only)
     */
    public function teacherReport(Request $request): JsonResponse
    {
        $query = Teacher::with('school');

        // Tenant scoping
        if ($request->user()->isOperator()) {
            $query->forSchool($request->user()->school_id);
        } elseif ($request->filled('school_id')) {
            $query->forSchool($request->school_id);
        }

        // Default: only active teachers unless explicitly requested otherwise
        if ($request->filled('is_active')) {
            $query->where('is_active', (bool) $request->is_active);
        } else {
            $query->where('is_active', true);
        }

        // Filters
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('nama', 'ilike', "%{$search}%")
                  ->orWhere('nuptk', 'ilike', "%{$search}%")
                  ->orWhere('nip', 'ilike', "%{$search}%")
                  ->orWhere('nomor_induk_maarif', 'ilike', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('kecamatan')) {
            $query->where('kecamatan', $request->kecamatan);
        }

        if ($request->filled('is_certified')) {
            $query->where('is_certified', (bool) $request->is_certified);
        }

        $teachers = $query->orderBy('nama')->get();

        // Summary stats (computed from the full unfiltered set for the tenant)
        $allQuery = Teacher::where('is_active', true);
        if ($request->user()->isOperator()) {
            $allQuery->forSchool($request->user()->school_id);
        } elseif ($request->filled('school_id')) {
            $allQuery->forSchool($request->school_id);
        }
        $allTeachers = $allQuery->get();

        $byStatus = $allTeachers->groupBy('status')->map->count()->sortDesc();
        $byCertification = [
            'certified'   => $allTeachers->where('is_certified', true)->count(),
            'uncertified' => $allTeachers->where('is_certified', false)->count(),
        ];
        $bySchool = $allTeachers->groupBy(fn($t) => $t->school?->nama ?? $t->unit_kerja ?? 'Unknown')
            ->map->count()->sortDesc()->take(20);

        // Distinct kecamatan list for filter dropdown
        $kecamatanList = Teacher::where('is_active', true)
            ->when($request->user()->isOperator(), fn($q) => $q->forSchool($request->user()->school_id))
            ->whereNotNull('kecamatan')
            ->distinct()
            ->orderBy('kecamatan')
            ->pluck('kecamatan');

        return response()->json([
            'total'            => $allTeachers->count(),
            'filtered_total'   => $teachers->count(),
            'by_status'        => $byStatus,
            'by_certification' => $byCertification,
            'by_school'        => $bySchool,
            'kecamatan_list'   => $kecamatanList,
            'data'             => $teachers,
        ]);
    }

    /**
     * GET /api/reports/sk-per-sekolah — SK submission report grouped per school
     *
     * Only includes submissions that are NOT rejected (pending, approved, active, draft).
     * Intended for the printed PDF report of queued/active SK submissions per school.
     *
     * Query params:
     *   start_date  — filter by created_at (inclusive)
     *   end_date    — filter by created_at (inclusive, end of day)
     *   school_id   — filter by specific school (super_admin only)
     *   jenis_sk    — filter by SK type
     */
    public function skPerSekolah(Request $request): JsonResponse
    {
        $query = SkDocument::with(['school'])
            ->whereNotIn('status', ['rejected', 'Rejected']);

        // Tenant scoping
        if ($request->user()->isOperator()) {
            $query->forSchool($request->user()->school_id);
        } elseif ($request->filled('school_id')) {
            $query->forSchool($request->school_id);
        }

        if ($request->filled('jenis_sk')) {
            $query->byJenis($request->jenis_sk);
        }

        if ($request->filled('start_date')) {
            $query->where('created_at', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            // Include the full end day
            $query->where('created_at', '<=', $request->end_date . ' 23:59:59');
        }

        $sks = $query->orderBy('unit_kerja')->orderByDesc('created_at')->get();

        // Group by school
        $grouped = $sks->groupBy(fn($sk) => $sk->school_id ?? 0)
            ->map(function ($items) {
                $first = $items->first();
                $school = $first->school;

                $byJenis = $items->groupBy(function ($item) {
                    $raw = strtolower(trim($item->jenis_sk ?? ''));
                    return preg_replace('/^sk\s+/', '', $raw);
                })->map->count();

                return [
                    'school_id'   => $first->school_id,
                    'nama_sekolah' => $school?->nama ?? $first->unit_kerja ?? 'Tidak Diketahui',
                    'kecamatan'   => $school?->kecamatan ?? '-',
                    'unit_kerja'  => $first->unit_kerja ?? $school?->nama ?? '-',
                    'total'       => $items->count(),
                    'pending'     => $items->filter(fn($s) => strtolower($s->status) === 'pending')->count(),
                    'approved'    => $items->filter(fn($s) => in_array(strtolower($s->status), ['approved', 'active']))->count(),
                    'draft'       => $items->filter(fn($s) => strtolower($s->status) === 'draft')->count(),
                    'gty'         => $byJenis->filter(fn($v, $k) => str_contains($k, 'gty') || str_contains($k, 'tetap yayasan'))->sum(),
                    'gtt'         => $byJenis->filter(fn($v, $k) => str_contains($k, 'gtt') || str_contains($k, 'tidak tetap'))->sum(),
                    'kamad'       => $byJenis->filter(fn($v, $k) => str_contains($k, 'kamad') || str_contains($k, 'kepala'))->sum(),
                    'tendik'      => $byJenis->filter(fn($v, $k) => str_contains($k, 'tendik'))->sum(),
                    'tanggal_awal' => $items->min('created_at'),
                    'tanggal_akhir' => $items->max('created_at'),
                    'items'       => $items->map(fn($sk) => [
                        'id'               => $sk->id,
                        'nomor_sk'         => $sk->nomor_sk,
                        'nama'             => $sk->nama,
                        'jenis_sk'         => $sk->jenis_sk,
                        'jabatan'          => $sk->jabatan,
                        'status'           => $sk->status,
                        'tanggal_penetapan' => $sk->tanggal_penetapan,
                        'created_at'       => $sk->created_at,
                    ])->values(),
                ];
            })
            ->values()
            ->sortBy('nama_sekolah')
            ->values();

        $summary = [
            'total_sekolah'   => $grouped->count(),
            'total_pengajuan' => $sks->count(),
            'pending'         => $sks->filter(fn($s) => strtolower($s->status) === 'pending')->count(),
            'approved'        => $sks->filter(fn($s) => in_array(strtolower($s->status), ['approved', 'active']))->count(),
            'draft'           => $sks->filter(fn($s) => strtolower($s->status) === 'draft')->count(),
        ];

        return response()->json([
            'summary' => $summary,
            'data'    => $grouped,
        ]);
    }

    /**
     * GET /api/reports/summary — Overall system summary
     */
    public function summary(): JsonResponse
    {
        return response()->json([
            'schools' => School::count(),
            'teachers' => Teacher::where('is_active', true)->count(),
            'students' => Student::where('status', 'Aktif')->count(),
            'sk_total' => SkDocument::count(),
            'sk_active' => SkDocument::whereIn('status', ['active', 'approved'])->count(),
            'sk_pending' => SkDocument::where('status', 'draft')->count(),
        ]);
    }

    /**
     * GET /api/reports/sk-belum-mengajukan
     *
     * Returns list of jam'iyyah schools that have NOT submitted SK documents.
     * Restricted to super_admin and admin_yayasan roles.
     *
     * Query params:
     *   jenjang    — filter by jenjang (RA, MI, MTs, MA)
     *   kecamatan  — filter by kecamatan
     *   search     — search by nama or NPSN (case-insensitive)
     *   start_date — period start (only SK submissions within this range count)
     *   end_date   — period end
     */
    public function skBelumMengajukan(Request $request): JsonResponse
    {
        // Inline role check — only super_admin and admin_yayasan
        if (!in_array($request->user()->role, ['super_admin', 'admin_yayasan'])) {
            return response()->json([
                'message' => 'Akses ditolak. Hanya super admin dan admin yayasan yang dapat mengakses laporan ini.',
            ], 403);
        }

        $query = DB::table('schools as s')
            ->leftJoin('sk_documents as sk', function ($join) use ($request) {
                $join->on('sk.school_id', '=', 's.id')
                    ->whereNull('sk.deleted_at');

                // Period filter applies to sk_documents.created_at in the JOIN condition
                if ($request->filled('start_date')) {
                    $join->where('sk.created_at', '>=', $request->start_date);
                }
                if ($request->filled('end_date')) {
                    $join->where('sk.created_at', '<=', $request->end_date . ' 23:59:59');
                }
            })
            ->whereNull('sk.id')
            ->whereRaw("LOWER(s.status_jamiyyah) LIKE '%jam''iyyah%'")
            ->whereNull('s.deleted_at');

        // Optional filters
        if ($request->filled('jenjang')) {
            $query->where('s.jenjang', $request->jenjang);
        }

        if ($request->filled('kecamatan')) {
            $query->where('s.kecamatan', $request->kecamatan);
        }

        if ($request->filled('search')) {
            $search = strtolower($request->search);
            $query->where(function ($q) use ($search) {
                $q->whereRaw("LOWER(s.nama) LIKE ?", ["%{$search}%"])
                  ->orWhereRaw("LOWER(s.npsn) LIKE ?", ["%{$search}%"]);
            });
        }

        // Get distinct kecamatan values from the filtered results (before selecting specific columns)
        $kecamatanList = (clone $query)
            ->whereNotNull('s.kecamatan')
            ->distinct()
            ->orderBy('s.kecamatan')
            ->pluck('s.kecamatan')
            ->values()
            ->toArray();

        // Select the data
        $data = $query->select([
            's.id',
            's.nama',
            's.npsn',
            's.jenjang',
            's.kecamatan',
            's.kepala_madrasah',
            's.telepon',
        ])
            ->orderBy('s.nama', 'asc')
            ->get();

        return response()->json([
            'total' => $data->count(),
            'kecamatan_list' => $kecamatanList,
            'data' => $data,
        ]);
    }

    /**
     * GET /api/reports/sk-belum-mengajukan/export
     *
     * Generates Excel file of jam'iyyah schools without SK submissions.
     * Same filters as skBelumMengajukan apply.
     */
    public function exportSkBelumMengajukan(Request $request): BinaryFileResponse|JsonResponse
    {
        // Inline role check — only super_admin and admin_yayasan
        if (!in_array($request->user()->role, ['super_admin', 'admin_yayasan'])) {
            return response()->json([
                'message' => 'Akses ditolak. Hanya super admin dan admin yayasan yang dapat mengakses laporan ini.',
            ], 403);
        }

        try {
            $export = new SkBelumMengajukanExport(
                $request->input('jenjang'),
                $request->input('kecamatan'),
                $request->input('search'),
                $request->input('start_date'),
                $request->input('end_date'),
            );

            $filename = 'Laporan_Belum_Mengajukan_SK_' . now()->format('Y-m-d') . '.xlsx';

            return Excel::download($export, $filename);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Gagal menghasilkan file Excel. Silakan coba lagi.',
            ], 500);
        }
    }
}
