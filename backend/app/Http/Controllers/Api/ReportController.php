<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
}
