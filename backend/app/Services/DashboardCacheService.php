<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DashboardCacheService
{
    private const DASHBOARD_TTL = 60;      // seconds
    private const SCHOOL_TTL = 300;        // 5 minutes

    /**
     * Get global dashboard stats (super_admin / admin_yayasan).
     */
    public function getStats(User $user): array
    {
        $key = $this->buildKey('stats', $user);

        return $this->remember($key, self::DASHBOARD_TTL, function () use ($user) {
            return $this->computeStats($user);
        });
    }

    /**
     * Get school-specific stats (operator / admin_yayasan).
     */
    public function getSchoolStats(User $user): array
    {
        $key = $this->buildKey('school-stats', $user);

        return $this->remember($key, self::DASHBOARD_TTL, function () use ($user) {
            return $this->computeSchoolStats($user);
        });
    }

    /**
     * Get chart data for dashboard.
     */
    public function getCharts(User $user): array
    {
        $key = $this->buildKey('charts', $user);

        return $this->remember($key, self::DASHBOARD_TTL, function () use ($user) {
            return $this->computeCharts($user);
        });
    }

    /**
     * Get SK statistics (counts by status).
     */
    public function getSkStatistics(User $user): array
    {
        $key = $this->buildKey('sk-statistics', $user);

        return $this->remember($key, self::DASHBOARD_TTL, function () use ($user) {
            return $this->computeSkStatistics($user);
        });
    }

    /**
     * Get SK trend data (monthly counts).
     */
    public function getSkTrend(User $user, int $months = 6): array
    {
        $key = $this->buildKey('sk-trend', $user);

        return $this->remember($key, self::DASHBOARD_TTL, function () use ($user, $months) {
            return $this->computeSkTrend($user, $months);
        });
    }

    /**
     * Get school breakdown (SK count per unit_kerja).
     */
    public function getSchoolBreakdown(User $user): array
    {
        $key = $this->buildKey('school-breakdown', $user);

        return $this->remember($key, self::DASHBOARD_TTL, function () use ($user) {
            return $this->computeSchoolBreakdown($user);
        });
    }

    /**
     * Get school statistics by affiliation and jenjang.
     */
    public function getSchoolStatistics(User $user): array
    {
        $key = $this->buildKey('school-statistics', $user);

        return $this->remember($key, self::DASHBOARD_TTL, function () use ($user) {
            return $this->computeSchoolStatistics($user);
        });
    }

    /**
     * Get all school id→name pairs, cached for 300 seconds.
     */
    public function getSchoolNames(): array
    {
        return $this->remember('school:names:all', self::SCHOOL_TTL, function () {
            return DB::table('schools')
                ->whereNull('deleted_at')
                ->pluck('nama', 'id')
                ->toArray();
        });
    }

    /**
     * Build a cache key scoped by endpoint, role, and school_id.
     */
    public function buildKey(string $endpoint, User $user): string
    {
        $scope = $user->role === 'operator' ? (string) $user->school_id : 'all';

        return "dashboard:{$endpoint}:{$user->role}:{$scope}";
    }

    /**
     * Invalidate all dashboard cache variants for a given school.
     */
    public function invalidateForSchool(int $schoolId): void
    {
        $endpoints = ['stats', 'school-stats', 'charts', 'sk-statistics', 'sk-trend', 'school-breakdown', 'school-statistics'];
        $roles = ['operator', 'admin_yayasan', 'super_admin'];

        foreach ($endpoints as $endpoint) {
            // Invalidate operator-scoped key for this school
            $this->forget("dashboard:{$endpoint}:operator:{$schoolId}");

            // Invalidate global keys for admin roles
            foreach (['admin_yayasan', 'super_admin'] as $role) {
                $this->forget("dashboard:{$endpoint}:{$role}:all");
            }
        }
    }

    // ─── Private compute methods ───────────────────────────────────────────────

    private function computeStats(User $user): array
    {
        // Use aggregate COUNT queries without loading model instances
        $teachers = DB::table('teachers')->whereNull('deleted_at')->where('is_active', true)->count();
        $students = DB::table('students')->whereNull('deleted_at')->count();
        $schools = DB::table('schools')->whereNull('deleted_at')->count();

        // Single query for all SK status counts
        $skCounts = DB::table('sk_documents')->whereNull('deleted_at')
            ->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft
            ")
            ->first();

        $schoolNames = $this->getSchoolNames();

        // Recent activity logs — individual entries are expected for activity feed
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
                'school'    => $l->school_id ? ($schoolNames[$l->school_id] ?? null) : null,
                'timestamp' => $l->created_at->getTimestamp() * 1000,
            ]);

        return [
            'totalTeachers' => $teachers,
            'totalStudents' => $students,
            'totalSchools' => $schools,
            'totalSk' => (int) ($skCounts->total ?? 0),
            'activeSk' => (int) ($skCounts->active ?? 0),
            'draftSk' => (int) ($skCounts->draft ?? 0),
            'lastUpdated' => now()->getTimestamp() * 1000,
            'recentLogs' => $recentLogs->toArray(),
        ];
    }

    private function computeSchoolStats(User $user): array
    {
        $schoolId = $user->school_id;
        $schoolName = $user->unit ?? ($this->getSchoolNames()[$schoolId] ?? 'Sekolah');

        // Use aggregate COUNT queries without loading model instances
        $teacherCount = DB::table('teachers')
            ->whereNull('deleted_at')
            ->where('school_id', $schoolId)
            ->where('is_active', true)
            ->count();

        // Status counts via single aggregate query
        $statusCounts = DB::table('teachers')
            ->selectRaw("LOWER(COALESCE(status, 'gtt')) as status_key, COUNT(*) as total")
            ->whereNull('deleted_at')
            ->where('school_id', $schoolId)
            ->where('is_active', true)
            ->groupBy('status_key')
            ->pluck('total', 'status_key');

        // Certification counts via single aggregate query
        $certCounts = DB::table('teachers')
            ->selectRaw("
                SUM(CASE WHEN is_certified = true THEN 1 ELSE 0 END) as certified,
                SUM(CASE WHEN is_certified = false OR is_certified IS NULL THEN 1 ELSE 0 END) as not_certified
            ")
            ->whereNull('deleted_at')
            ->where('school_id', $schoolId)
            ->where('is_active', true)
            ->first();

        $students = DB::table('students')
            ->whereNull('deleted_at')
            ->where('school_id', $schoolId)
            ->count();

        // Single query for all SK status counts
        $skCounts = DB::table('sk_documents')
            ->whereNull('deleted_at')
            ->where('school_id', $schoolId)
            ->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as drafts,
                SUM(CASE WHEN status IN ('approved', 'active') THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
            ")
            ->first();

        // Map status counts to expected format
        $statusMap = ['PNS' => 0, 'GTY' => 0, 'GTT' => 0, 'Tendik' => 0];
        foreach ($statusCounts as $key => $count) {
            if (str_contains($key, 'pns') || str_contains($key, 'asn')) {
                $statusMap['PNS'] += $count;
            } elseif (str_contains($key, 'gty') || str_contains($key, 'tetap yayasan')) {
                $statusMap['GTY'] += $count;
            } elseif (str_contains($key, 'tendik') || str_contains($key, 'administrasi') || str_contains($key, 'tata usaha')) {
                $statusMap['Tendik'] += $count;
            } else {
                $statusMap['GTT'] += $count;
            }
        }

        $schoolNames = $this->getSchoolNames();

        // Recent activity logs — individual entries are expected for activity feed
        $recentLogs = ActivityLog::with('causer')
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
            ]);

        return [
            'schoolName'   => $schoolName,
            'teachers'     => $teacherCount,
            'students'     => $students,
            'totalSk'      => (int) ($skCounts->total ?? 0),
            'skDrafts'     => (int) ($skCounts->drafts ?? 0),
            'skApproved'   => (int) ($skCounts->approved ?? 0),
            'skRejected'   => (int) ($skCounts->rejected ?? 0),
            'status'       => collect($statusMap)->map(fn($v, $k) => ['name' => $k, 'value' => $v])->values()->toArray(),
            'certification' => [
                ['name' => 'Sudah Sertifikasi', 'value' => (int) ($certCounts->certified ?? 0)],
                ['name' => 'Belum Sertifikasi', 'value' => (int) ($certCounts->not_certified ?? 0)],
            ],
            'recentLogs' => $recentLogs->toArray(),
        ];
    }

    private function computeCharts(User $user): array
    {
        $schoolId = ($user->role === 'operator' && $user->school_id)
            ? $user->school_id
            : null;

        // Group by unit_kerja — aggregate counts only, no model instances
        $unitQuery = DB::table('teachers')
            ->selectRaw("COALESCE(NULLIF(TRIM(unit_kerja), ''), 'Lainnya') as name, COUNT(*) as jumlah")
            ->whereNull('deleted_at')
            ->where('is_active', true);
        if ($schoolId) {
            $unitQuery->where('school_id', $schoolId);
        }
        $unitMap = $unitQuery->groupBy('unit_kerja')->orderByDesc('jumlah')->limit(8)->get()
            ->map(fn($row) => ['name' => $row->name, 'jumlah' => (int) $row->jumlah])
            ->toArray();

        // Group by status with canonical labels — aggregate counts only
        $statusCaseExpr = "
            CASE
                WHEN LOWER(COALESCE(status, '')) IN ('pns', 'asn') OR LOWER(COALESCE(status, '')) LIKE 'pns %' OR LOWER(COALESCE(status, '')) LIKE 'asn %' THEN 'PNS'
                WHEN LOWER(COALESCE(status, '')) IN ('gty', 'guru tetap yayasan', 'kepala madrasah') THEN 'GTY'
                WHEN LOWER(COALESCE(status, '')) IN ('tendik', 'tenaga kependidikan', 'administrasi', 'tata usaha') THEN 'Tendik'
                ELSE 'GTT'
            END";
        $statusQuery = DB::table('teachers')
            ->selectRaw("{$statusCaseExpr} as name, COUNT(*) as value")
            ->whereNull('deleted_at')
            ->where('is_active', true);
        if ($schoolId) {
            $statusQuery->where('school_id', $schoolId);
        }
        $statusMap = $statusQuery->groupByRaw($statusCaseExpr)->get()
            ->map(fn($row) => ['name' => $row->name, 'value' => (int) $row->value])
            ->toArray();

        // Certification counts — aggregate counts only
        $certQuery = DB::table('teachers')
            ->selectRaw("
                SUM(CASE WHEN is_certified = true THEN 1 ELSE 0 END) as certified,
                SUM(CASE WHEN is_certified = false OR is_certified IS NULL THEN 1 ELSE 0 END) as not_certified
            ")
            ->whereNull('deleted_at')
            ->where('is_active', true);
        if ($schoolId) {
            $certQuery->where('school_id', $schoolId);
        }
        $certCounts = $certQuery->first();
        $certMap = [
            ['name' => 'Sudah Sertifikasi', 'value' => (int) ($certCounts->certified ?? 0)],
            ['name' => 'Belum Sertifikasi', 'value' => (int) ($certCounts->not_certified ?? 0)],
        ];

        // Group by kecamatan — aggregate counts only
        $kecQuery = DB::table('teachers')
            ->selectRaw("COALESCE(NULLIF(kecamatan, ''), 'Lainnya') as name, COUNT(*) as jumlah")
            ->whereNull('deleted_at')
            ->where('is_active', true);
        if ($schoolId) {
            $kecQuery->where('school_id', $schoolId);
        }
        $kecMap = $kecQuery->groupBy('kecamatan')->orderByDesc('jumlah')->limit(10)->get()
            ->map(fn($row) => ['name' => $row->name, 'jumlah' => (int) $row->jumlah])
            ->toArray();

        return [
            'units' => $unitMap,
            'status' => $statusMap,
            'certification' => $certMap,
            'kecamatan' => $kecMap,
        ];
    }

    private function computeSkStatistics(User $user): array
    {
        $query = DB::table('sk_documents')->whereNull('deleted_at');

        // Scope by school for operators
        if ($user->role === 'operator' && $user->school_id) {
            $query->where('school_id', $user->school_id);
        }

        $counts = $query->selectRaw("
            COUNT(*) as total,
            SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
        ")->first();

        return [
            'total'    => (int) ($counts->total ?? 0),
            'draft'    => (int) ($counts->draft ?? 0),
            'pending'  => (int) ($counts->pending ?? 0),
            'approved' => (int) ($counts->approved ?? 0),
            'rejected' => (int) ($counts->rejected ?? 0),
            'active'   => (int) ($counts->active ?? 0),
        ];
    }

    private function computeSkTrend(User $user, int $months): array
    {
        $trendData = [];

        for ($i = $months - 1; $i >= 0; $i--) {
            $date = now()->subMonths($i);
            $monthKey = $date->format('Y-m');
            $monthName = $date->translatedFormat('M Y');

            $query = DB::table('sk_documents')->whereNull('deleted_at');

            if ($user->role === 'operator' && $user->school_id) {
                $query->where('school_id', $user->school_id);
            }

            $count = $query->whereRaw("TO_CHAR(created_at, 'YYYY-MM') = ?", [$monthKey])->count();
            $trendData[] = ['month' => $monthName, 'count' => $count];
        }

        return $trendData;
    }

    private function computeSchoolBreakdown(User $user): array
    {
        $query = DB::table('sk_documents')
            ->whereNull('deleted_at')
            ->selectRaw("COALESCE(unit_kerja, 'Unknown') as school, COUNT(*) as count")
            ->groupBy('unit_kerja')
            ->orderByDesc('count')
            ->limit(10);

        if ($user->role === 'operator' && $user->school_id) {
            $query->where('school_id', $user->school_id);
        }

        return $query->get()->toArray();
    }

    private function computeSchoolStatistics(User $user): array
    {
        $query = DB::table('schools')->whereNull('deleted_at');

        // Apply tenant scoping: operators see only their school
        if ($user->role === 'operator' && $user->school_id) {
            $query->where('id', $user->school_id);
        }

        // Get affiliation statistics with aggregation
        $affiliationStats = (clone $query)
            ->selectRaw("
                CASE
                    WHEN LOWER(status_jamiyyah) LIKE '%jama%ah%'
                      OR LOWER(status_jamiyyah) LIKE '%afiliasi%' THEN 'jamaah'
                    WHEN LOWER(status_jamiyyah) LIKE '%jam%iyyah%' THEN 'jamiyyah'
                    ELSE 'undefined'
                END as category,
                COUNT(*) as count
            ")
            ->groupBy('category')
            ->pluck('count', 'category');

        // Get jenjang statistics with aggregation
        $jenjangStats = (clone $query)
            ->selectRaw("
                CASE
                    WHEN LOWER(jenjang) LIKE '%mi%' OR LOWER(jenjang) LIKE '%sd%' THEN 'mi_sd'
                    WHEN LOWER(jenjang) LIKE '%mts%' OR LOWER(jenjang) LIKE '%smp%' THEN 'mts_smp'
                    WHEN LOWER(jenjang) LIKE '%ma%' OR LOWER(jenjang) LIKE '%sma%' OR LOWER(jenjang) LIKE '%smk%' THEN 'ma_sma_smk'
                    WHEN jenjang IS NULL OR jenjang = '' THEN 'undefined'
                    ELSE 'lainnya'
                END as category,
                COUNT(*) as count
            ")
            ->groupBy('category')
            ->pluck('count', 'category');

        // Get total count
        $total = (clone $query)->count();

        return [
            'affiliation' => [
                'jamaah' => (int) ($affiliationStats['jamaah'] ?? 0),
                'jamiyyah' => (int) ($affiliationStats['jamiyyah'] ?? 0),
                'undefined' => (int) ($affiliationStats['undefined'] ?? 0),
            ],
            'jenjang' => [
                'mi_sd' => (int) ($jenjangStats['mi_sd'] ?? 0),
                'mts_smp' => (int) ($jenjangStats['mts_smp'] ?? 0),
                'ma_sma_smk' => (int) ($jenjangStats['ma_sma_smk'] ?? 0),
                'lainnya' => (int) ($jenjangStats['lainnya'] ?? 0),
                'undefined' => (int) ($jenjangStats['undefined'] ?? 0),
            ],
            'total' => $total,
        ];
    }

    // ─── Private helpers ───────────────────────────────────────────────────────

    /**
     * Cache remember with Redis fallback to default cache driver.
     *
     * Catches connection-related exceptions from phpredis (\RedisException),
     * Predis (\Predis\Connection\ConnectionException), or any other
     * connection failure and falls back to the application's default cache store.
     */
    private function remember(string $key, int $ttl, \Closure $callback): mixed
    {
        try {
            return Cache::store('redis')->remember($key, $ttl, $callback);
        } catch (\Throwable $e) {
            if ($this->isConnectionException($e)) {
                Log::warning('Redis unavailable, falling back to default cache', [
                    'error' => $e->getMessage(),
                    'key' => $key,
                ]);

                return Cache::remember($key, $ttl, $callback);
            }

            throw $e;
        }
    }

    /**
     * Forget a cache key with Redis fallback.
     */
    private function forget(string $key): void
    {
        try {
            Cache::store('redis')->forget($key);
        } catch (\Throwable $e) {
            if ($this->isConnectionException($e)) {
                Log::warning('Redis unavailable during cache invalidation, falling back to default cache', [
                    'error' => $e->getMessage(),
                    'key' => $key,
                ]);

                Cache::forget($key);
                return;
            }

            throw $e;
        }
    }

    /**
     * Determine if an exception is a Redis connection-related exception.
     */
    private function isConnectionException(\Throwable $e): bool
    {
        // phpredis extension exception
        if ($e instanceof \RedisException) {
            return true;
        }

        // Predis connection exception
        if (is_a($e, 'Predis\Connection\ConnectionException')) {
            return true;
        }

        // Laravel's generic connection exception wrapping
        $message = strtolower($e->getMessage());
        if (
            str_contains($message, 'connection refused') ||
            str_contains($message, 'connection timed out') ||
            str_contains($message, 'no connection') ||
            str_contains($message, 'went away') ||
            str_contains($message, 'redis') ||
            str_contains($message, 'class "redis" not found')
        ) {
            return true;
        }

        return false;
    }

    private function formatActivityLabel(?string $event, ?string $logName, ?string $description): string
    {
        $eventMap = [
            'login'              => 'Login',
            'logout'             => 'Logout',
            'created'            => 'Data Ditambahkan',
            'updated'            => 'Data Diperbarui',
            'deleted'            => 'Data Dihapus',
            'create_teacher'     => 'Tambah Guru',
            'update_teacher'     => 'Update Guru',
            'delete_teacher'     => 'Hapus Guru',
            'import_teacher'     => 'Import Guru',
            'create_student'     => 'Tambah Siswa',
            'update_student'     => 'Update Siswa',
            'delete_student'     => 'Hapus Siswa',
            'create_school'      => 'Tambah Sekolah',
            'update_school'      => 'Update Sekolah',
            'create_sk'          => 'Buat SK',
            'submit_sk'          => 'Ajukan SK',
            'approve_sk'         => 'Setujui SK',
            'reject_sk'          => 'Tolak SK',
            'generate_sk'        => 'Generate SK',
        ];

        if ($event && isset($eventMap[$event])) {
            return $eventMap[$event];
        }

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
}
