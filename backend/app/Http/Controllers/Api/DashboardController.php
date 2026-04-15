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
                '_id'       => (string) $l->id,
                'user'      => $l->causer?->name ?? 'System',
                'role'      => $l->causer?->role ?? 'system',
                'action'    => $this->formatActivityLabel($l->event, $l->log_name, $l->description),
                'details'   => $l->description ?? '-',
                'school'    => $l->school_id ? \App\Models\School::find($l->school_id)?->nama : null,
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

        if (! in_array($user->role, ['operator', 'admin_yayasan']) || ! $user->school_id) {
            return response()->json(['error' => 'Not an operator or no school assigned'], 403);
        }

        $schoolId   = $user->school_id;
        $schoolName = $user->unit ?? $user->school?->nama ?? 'Sekolah';

        // Aggregasi di DB — tidak load semua guru ke memory
        $teacherCount = Teacher::withoutTenantScope()
            ->where('school_id', $schoolId)
            ->where('is_active', true)
            ->count();

        $statusCounts = Teacher::withoutTenantScope()
            ->selectRaw("LOWER(COALESCE(status, 'gtt')) as status_key, COUNT(*) as total")
            ->where('school_id', $schoolId)
            ->where('is_active', true)
            ->groupBy('status_key')
            ->pluck('total', 'status_key');

        $certCounts = Teacher::withoutTenantScope()
            ->selectRaw('is_certified, COUNT(*) as total')
            ->where('school_id', $schoolId)
            ->where('is_active', true)
            ->groupBy('is_certified')
            ->pluck('total', 'is_certified');

        $students = Student::withoutTenantScope()->where('school_id', $schoolId)->count();

        $skBase = SkDocument::withoutTenantScope()->where('school_id', $schoolId);

        // Map status counts to expected format
        $statusMap = ['PNS' => 0, 'GTY' => 0, 'GTT' => 0, 'Tendik' => 0];
        foreach ($statusCounts as $key => $count) {
            if (str_contains($key, 'pns') || str_contains($key, 'asn')) $statusMap['PNS'] += $count;
            elseif (str_contains($key, 'gty') || str_contains($key, 'tetap yayasan')) $statusMap['GTY'] += $count;
            elseif (str_contains($key, 'tendik') || str_contains($key, 'administrasi') || str_contains($key, 'tata usaha')) $statusMap['Tendik'] += $count;
            else $statusMap['GTT'] += $count;
        }

        return $this->successResponse([
            'schoolName'   => $schoolName,
            'teachers'     => $teacherCount,
            'students'     => $students,
            'totalSk'      => (clone $skBase)->count(),
            'skDrafts'     => (clone $skBase)->where('status', 'draft')->count(),
            'skApproved'   => (clone $skBase)->whereIn('status', ['approved', 'active'])->count(),
            'skRejected'   => (clone $skBase)->where('status', 'rejected')->count(),
            'status'       => collect($statusMap)->map(fn($v, $k) => ['name' => $k, 'value' => $v])->values(),
            'certification' => [
                ['name' => 'Sudah Sertifikasi', 'value' => (int)($certCounts[1] ?? $certCounts['1'] ?? 0)],
                ['name' => 'Belum Sertifikasi', 'value' => (int)($certCounts[0] ?? $certCounts['0'] ?? 0)],
            ],
            'recentLogs' => ActivityLog::with('causer')
                ->where('school_id', $schoolId)
                ->orderByDesc('id')
                ->take(10)
                ->get()
                ->map(fn($l) => [
                    '_id'       => (string) $l->id,
                    'user'      => $l->causer?->name ?? 'System',
                    'role'      => $l->causer?->role ?? 'system',
                    'action'    => $this->formatActivityLabel($l->event, $l->log_name, $l->description),
                    'details'   => $l->description ?? '-',
                    'school'    => null,
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

        // Aggregasi di DB, bukan load semua ke memory
        $counts = (clone $query)
            ->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
            ")
            ->first();

        return $this->successResponse([
            'total'    => (int)($counts->total ?? 0),
            'draft'    => (int)($counts->draft ?? 0),
            'pending'  => (int)($counts->pending ?? 0),
            'approved' => (int)($counts->approved ?? 0),
            'rejected' => (int)($counts->rejected ?? 0),
            'active'   => (int)($counts->active ?? 0),
        ]);
    }

    /**
     * GET /api/dashboard/sk-trend
     */
    public function skTrend(Request $request): JsonResponse
    {
        $months = $request->integer('months', 6);

        $trendData = [];
        for ($i = $months - 1; $i >= 0; $i--) {
            $date      = now()->subMonths($i);
            $monthKey  = $date->format('Y-m');
            $monthName = $date->translatedFormat('M Y');

            $query = SkDocument::query();
            if ($request->unit_kerja) {
                $query->where('unit_kerja', $request->unit_kerja);
            }

            $count = $query->whereRaw("TO_CHAR(created_at, 'YYYY-MM') = ?", [$monthKey])->count();
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

    private function formatActivityLabel(?string $event, ?string $logName, ?string $description): string
    {
        $eventMap = [
            // Auth
            'login'              => 'Login',
            'logout'             => 'Logout',
            // Teacher
            'created'            => 'Data Ditambahkan',
            'updated'            => 'Data Diperbarui',
            'deleted'            => 'Data Dihapus',
            'create_teacher'     => 'Tambah Guru',
            'update_teacher'     => 'Update Guru',
            'delete_teacher'     => 'Hapus Guru',
            'import_teacher'     => 'Import Guru',
            // Student
            'create_student'     => 'Tambah Siswa',
            'update_student'     => 'Update Siswa',
            'delete_student'     => 'Hapus Siswa',
            // School
            'create_school'      => 'Tambah Sekolah',
            'update_school'      => 'Update Sekolah',
            // SK
            'create_sk'          => 'Buat SK',
            'submit_sk'          => 'Ajukan SK',
            'approve_sk'         => 'Setujui SK',
            'reject_sk'          => 'Tolak SK',
            'generate_sk'        => 'Generate SK',
        ];

        if ($event && isset($eventMap[$event])) {
            return $eventMap[$event];
        }

        // Fallback: derive from log_name + event
        if ($logName && $event) {
            $logLabels = [
                'teacher' => 'Guru', 'student' => 'Siswa', 'school' => 'Sekolah',
                'master'  => 'Data', 'sk'      => 'SK',    'user'   => 'Pengguna',
            ];
            $eventLabels = [
                'created' => 'Ditambahkan', 'updated' => 'Diperbarui', 'deleted' => 'Dihapus',
            ];
            $subject = $logLabels[$logName] ?? ucfirst($logName);
            $action  = $eventLabels[$event] ?? ucfirst($event);
            return "{$subject} {$action}";
        }

        return $event ?? $logName ?? 'Aktivitas';
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
