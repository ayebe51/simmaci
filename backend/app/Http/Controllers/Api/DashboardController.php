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

        $recentLogs = ActivityLog::orderByDesc('id')
            ->take(15)
            ->get()
            ->map(fn($l) => [
                '_id' => (string) $l->id,
                'user' => $l->user ?? 'Unknown',
                'role' => $l->role ?? 'User',
                'action' => $l->action ?? 'Aktivitas',
                'details' => $l->details ?? '-',
                'timestamp' => $l->timestamp?->getTimestamp() * 1000 ?? $l->created_at->getTimestamp() * 1000,
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
 
        if ($user->role !== 'operator' || ! $user->unit) {
            return response()->json(['error' => 'Not an operator or no unit assigned'], 403);
        }
 
        $schoolId = $user->school_id;
        $schoolName = $user->unit;
 
        $teachersList = Teacher::where('school_id', $schoolId)
            ->where('is_active', true)
            ->get();
 
        $students = Student::where('school_id', $schoolId)->count();
        $skBase = SkDocument::where('school_id', $schoolId);
 
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
            'recentLogs' => ActivityLog::orderByDesc('id')->take(10)->get()->map(fn($l) => [
                '_id' => (string) $l->id,
                'user' => $l->user ?? 'Unknown',
                'role' => $l->role ?? 'User',
                'action' => $l->action ?? 'Aktivitas',
                'details' => $l->details ?? '-',
                'timestamp' => $l->timestamp?->getTimestamp() * 1000 ?? $l->created_at->getTimestamp() * 1000,
            ]),
        ]);
    }

    /**
     * GET /api/dashboard/charts
     */
    public function charts(): JsonResponse
    {
        $teachers = Teacher::active()->get();

        // Group by unit kerja (Jenjang)
        $unitMap = $teachers->groupBy(fn($t) => strtolower(trim($t->unit_kerja ?? '')))
            ->map(fn($group, $key) => [
                'name' => strtoupper($key),
                'jumlah' => $group->count(),
            ])
            ->sortByDesc('jumlah')
            ->values()
            ->take(8);

        // Group by status
        $statusMap = $teachers->groupBy(fn($t) => $t->status ?? 'GTT')
            ->map(fn($group, $key) => ['name' => $key, 'value' => $group->count()])
            ->values();

        // Group by certification
        $certMap = [
            ['name' => 'Sudah Sertifikasi', 'value' => $teachers->where('is_certified', true)->count()],
            ['name' => 'Belum Sertifikasi', 'value' => $teachers->where('is_certified', false)->count()],
        ];

        // Group by kecamatan
        $kecMap = Teacher::selectRaw('COALESCE(kecamatan, \'Lainnya\') as name, COUNT(*) as jumlah')
            ->groupBy('kecamatan')
            ->orderByDesc('jumlah')
            ->limit(10)
            ->get();

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
