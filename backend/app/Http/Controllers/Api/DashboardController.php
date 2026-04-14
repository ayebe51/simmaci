<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\School;
use App\Models\SkDocument;
use App\Models\Student;
use App\Models\StudentAttendanceLog;
use App\Models\Teacher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * GET /api/dashboard/stats — Super admin global stats
     */
    public function stats(Request $request): JsonResponse
    {
        $teachers = Teacher::active()->count();
        $students = Student::count();
        $schools = School::count();
        $totalSk = SkDocument::count();
        $activeSk = SkDocument::where('status', 'active')->count();
        $draftSk = SkDocument::where('status', 'draft')->count();

        $recentLogs = ActivityLog::with('causer')
            ->orderByDesc('id')
            ->take(15)
            ->get()
            ->map(fn($l) => [
                '_id' => (string) $l->id,
                'user' => $l->causer?->name ?? 'System',
                'role' => $l->causer?->role ?? 'system',
                'action' => $l->event ?? $l->log_name ?? 'Aktivitas',
                'details' => $l->description ?? '-',
                'timestamp' => $l->created_at->getTimestamp() * 1000,
            ]);

        return $this->successResponse([
            'totalTeachers' => $teachers,
            'totalStudents' => $students,
            'totalSchools' => $schools,
            'totalSk' => $totalSk,
            'activeSk' => $activeSk,
            'draftSk' => $draftSk,
            'lastUpdated' => now()->getTimestamp() * 1000,
            'recentLogs' => $recentLogs,
        ]);
    }

    /**
     * GET /api/dashboard/school-stats — Operator school-specific stats
     */
    public function schoolStats(Request $request): JsonResponse
    {
        $user = $request->user();

        // Allow operator OR admin_yayasan; use school_id as primary key
        if (! in_array($user->role, ['operator', 'admin_yayasan']) || ! $user->school_id) {
            return response()->json(['error' => 'Not an operator or no school assigned'], 403);
        }

        $schoolId  = $user->school_id;
        $schoolName = $user->unit ?? $user->school?->nama ?? 'Sekolah';

        $teachersList = Teacher::withoutTenantScope()
            ->where('school_id', $schoolId)
            ->where('is_active', true)
            ->get();

        $students = Student::withoutTenantScope()->where('school_id', $schoolId)->count();
        $skBase   = SkDocument::withoutTenantScope()->where('school_id', $schoolId);
 
        $statusCounts = ['PNS' => 0, 'GTY' => 0, 'GTT' => 0, 'Tendik' => 0];
        $certCounts = ['Sudah Sertifikasi' => 0, 'Belum Sertifikasi' => 0];
 
        foreach ($teachersList as $t) {
            $label = $this->determineTeacherStatus($t);
            if (isset($statusCounts[$label])) $statusCounts[$label]++;
            if ($label !== 'Tendik') {
                $t->is_certified
                    ? $certCounts['Sudah Sertifikasi']++
                    : $certCounts['Belum Sertifikasi']++;
            }
        }
 
        return $this->successResponse([
            'schoolName' => $schoolName,
            'teachers' => $teachersList->count(),
            'students' => $students,
            'totalSk' => (clone $skBase)->count(),
            'skDrafts' => (clone $skBase)->where('status', 'draft')->count(),
            'skApproved' => (clone $skBase)->whereIn('status', ['approved', 'active'])->count(),
            'skRejected' => (clone $skBase)->where('status', 'rejected')->count(),
            'status' => collect($statusCounts)->map(fn($v, $k) => ['name' => $k, 'value' => $v])->values(),
            'certification' => collect($certCounts)->map(fn($v, $k) => ['name' => $k, 'value' => $v])->values(),
            'recentLogs' => ActivityLog::with('causer')
                ->where('school_id', $schoolId)
                ->orderByDesc('id')
                ->take(10)
                ->get()
                ->map(fn($l) => [
                '_id' => (string) $l->id,
                'user' => $l->causer?->name ?? 'System',
                'role' => $l->causer?->role ?? 'system',
                'action' => $l->event ?? $l->log_name ?? 'Aktivitas',
                'details' => $l->description ?? '-',
                'timestamp' => $l->created_at->getTimestamp() * 1000,
            ]),
        ]);
    }

    /**
     * GET /api/dashboard/charts
     */
    public function charts(Request $request): JsonResponse
    {
        $user = $request->user();
        $schoolId = ($user && $user->role === 'operator' && $user->school_id)
            ? $user->school_id
            : null;

        // Group by unit_kerja — aggregasi di DB, bukan di PHP
        $unitQuery = Teacher::withoutTenantScope()
            ->selectRaw("COALESCE(NULLIF(TRIM(unit_kerja), ''), 'Lainnya') as name, COUNT(*) as jumlah")
            ->where('is_active', true);
        if ($schoolId) $unitQuery->where('school_id', $schoolId);
        $unitMap = $unitQuery->groupBy('unit_kerja')->orderByDesc('jumlah')->limit(8)->get();

        // Group by status
        $statusQuery = Teacher::withoutTenantScope()
            ->selectRaw("COALESCE(NULLIF(status, ''), 'GTT') as name, COUNT(*) as value")
            ->where('is_active', true);
        if ($schoolId) $statusQuery->where('school_id', $schoolId);
        $statusMap = $statusQuery->groupBy('status')->get();

        // Certification counts
        $certBase = Teacher::withoutTenantScope()->where('is_active', true);
        if ($schoolId) $certBase->where('school_id', $schoolId);
        $certMap = [
            ['name' => 'Sudah Sertifikasi', 'value' => (clone $certBase)->where('is_certified', true)->count()],
            ['name' => 'Belum Sertifikasi', 'value' => (clone $certBase)->where('is_certified', false)->count()],
        ];

        // Group by kecamatan
        $kecQuery = Teacher::withoutTenantScope()
            ->selectRaw("COALESCE(NULLIF(kecamatan, ''), 'Lainnya') as name, COUNT(*) as jumlah")
            ->where('is_active', true);
        if ($schoolId) $kecQuery->where('school_id', $schoolId);
        $kecMap = $kecQuery->groupBy('kecamatan')->orderByDesc('jumlah')->limit(10)->get();

        return $this->successResponse([
            'units' => $unitMap,
            'status' => $statusMap,
            'certification' => $certMap,
            'kecamatan' => $kecMap,
        ]);
    }

    /**
     * GET /api/dashboard/sk-statistics
     */
    public function skStatistics(Request $request): JsonResponse
    {
        $query = SkDocument::query();

        if ($request->unit_kerja) {
            $query->where('unit_kerja', $request->unit_kerja);
        }

        $sks = $query->get();

        return $this->successResponse([
            'total' => $sks->count(),
            'draft' => $sks->where('status', 'draft')->count(),
            'pending' => $sks->where('status', 'pending')->count(),
            'approved' => $sks->where('status', 'approved')->count(),
            'rejected' => $sks->where('status', 'rejected')->count(),
            'active' => $sks->where('status', 'active')->count(),
        ]);
    }

    /**
     * GET /api/dashboard/sk-trend
     */
    public function skTrend(Request $request): JsonResponse
    {
        $months = $request->integer('months', 6);
        $query = SkDocument::query();

        if ($request->unit_kerja) {
            $query->where('unit_kerja', $request->unit_kerja);
        }

        $sks = $query->get();
        $trendData = [];

        for ($i = $months - 1; $i >= 0; $i--) {
            $date = now()->subMonths($i);
            $monthKey = $date->format('Y-m');
            $monthName = $date->translatedFormat('M Y');

            $count = $sks->filter(fn($sk) => $sk->created_at?->format('Y-m') === $monthKey)->count();

            $trendData[] = ['month' => $monthName, 'count' => $count];
        }

        return $this->successResponse($trendData);
    }

    /**
     * GET /api/dashboard/school-breakdown
     */
    public function schoolBreakdown(): JsonResponse
    {
        $breakdown = SkDocument::selectRaw('COALESCE(unit_kerja, \'Unknown\') as school, COUNT(*) as count')
            ->groupBy('unit_kerja')
            ->orderByDesc('count')
            ->limit(10)
            ->get();

        return $this->successResponse($breakdown);
    }

    private function determineTeacherStatus($teacher): string
    {
        $status = strtolower($teacher->status ?? '');

        if (str_contains($status, 'pns') || str_contains($status, 'asn')) return 'PNS';
        if (str_contains($status, 'gty') || str_contains($status, 'tetap yayasan')) return 'GTY';
        if (str_contains($status, 'gtt') || str_contains($status, 'tidak tetap') || str_contains($status, 'honorer')) return 'GTT';
        if (str_contains($status, 'tendik') || str_contains($status, 'administrasi') || str_contains($status, 'tata usaha')) return 'Tendik';

        return 'GTT'; // Default
    }
}
