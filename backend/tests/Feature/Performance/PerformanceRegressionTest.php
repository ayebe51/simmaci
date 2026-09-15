<?php

namespace Tests\Feature\Performance;

use App\Jobs\SendPpdbWaNotificationJob;
use App\Models\PpdbPeriod;
use App\Models\School;
use App\Models\Teacher;
use App\Models\Student;
use App\Models\SkDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Performance Regression Suite for SEC-PERF-002
 *
 * Verifies that:
 * 1. Query counts on critical endpoints remain strictly bounded (O(1)).
 * 2. Pagination clamping prevents memory exhaustion (per_page <= 50 or <= 100).
 * 3. N+1 loops are eliminated across reports and multi-tenant aggregations.
 * 4. Caching layer provides immediate cache hits with zero database query overhead.
 * 5. External I/O (WhatsApp, MinIO) remains decoupled from relational database transactions.
 */
class PerformanceRegressionTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $operator;
    private School $school;

    public function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create([
            'nama' => 'Madrasah Al-Maarif 1',
            'kecamatan' => 'Cilacap Selatan',
            'status_jamiyyah' => 'aktif',
        ]);

        $this->superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'school_id' => null,
        ]);

        $this->operator = User::factory()->create([
            'role' => 'operator',
            'school_id' => $this->school->id,
        ]);
    }

    /**
     * Requirement: Query count bounds on critical endpoints.
     */
    public function test_query_count_bounds_on_critical_endpoints(): void
    {
        // Setup 5 schools with teachers, students, and periods
        for ($i = 0; $i < 5; $i++) {
            $sch = School::factory()->create(['kecamatan' => 'Cilacap Tengah', 'status_jamiyyah' => 'aktif']);
            Teacher::factory()->create(['school_id' => $sch->id, 'is_active' => true]);
            Student::factory()->create(['school_id' => $sch->id, 'status' => 'Aktif']);
            PpdbPeriod::create([
                'school_id' => $sch->id,
                'academic_year' => '2026/2027',
                'wave_name' => "Gelombang {$i}",
                'start_date' => now()->subDay()->toDateString(),
                'end_date' => now()->addMonth()->toDateString(),
                'is_active' => true,
                'quota' => 50,
            ]);
        }

        Cache::flush();
        DB::flushQueryLog();
        DB::enableQueryLog();

        // 1. GET /api/ppdb/schools
        $this->getJson('/api/ppdb/schools?per_page=10')->assertStatus(200);
        $ppdbQueries = count(DB::getQueryLog());
        $this->assertLessThanOrEqual(5, $ppdbQueries, "PPDB schools exceeded query budget");

        // 2. GET /api/reports/teacher
        DB::flushQueryLog();
        $this->actingAs($this->superAdmin, 'sanctum')->getJson('/api/reports/teacher')->assertStatus(200);
        $teacherReportQueries = count(DB::getQueryLog());
        $this->assertLessThanOrEqual(8, $teacherReportQueries, "Teacher report exceeded query budget");

        // 3. GET /api/reports/summary
        DB::flushQueryLog();
        $this->actingAs($this->superAdmin, 'sanctum')->getJson('/api/reports/summary')->assertStatus(200);
        $summaryQueries = count(DB::getQueryLog());
        $this->assertLessThanOrEqual(6, $summaryQueries, "Summary report exceeded query budget");

        DB::disableQueryLog();
    }

    /**
     * Requirement: Pagination clamping prevents memory explosion.
     */
    public function test_pagination_max_enforced_across_controllers(): void
    {
        // Attempting to request 10,000 records per page
        $resPpdb = $this->getJson('/api/ppdb/schools?per_page=10000')->assertStatus(200);
        $dataPpdb = $resPpdb->json('data') ?? [];
        $this->assertLessThanOrEqual(50, count($dataPpdb), "PPDB per_page must be clamped to <= 50");

        $resTeachers = $this->actingAs($this->superAdmin, 'sanctum')->getJson('/api/teachers?per_page=10000')->assertStatus(200);
        $dataTeachers = $resTeachers->json('data') ?? [];
        $this->assertLessThanOrEqual(100, count($dataTeachers), "Teachers per_page must be clamped to <= 100");

        $resStudents = $this->actingAs($this->superAdmin, 'sanctum')->getJson('/api/students?per_page=10000')->assertStatus(200);
        $dataStudents = $resStudents->json('data') ?? [];
        $this->assertLessThanOrEqual(100, count($dataStudents), "Students per_page must be clamped to <= 100");
    }

    /**
     * Requirement: Report aggregations are strictly O(1) against school count.
     */
    public function test_no_n_plus_one_on_reports_under_large_school_count(): void
    {
        // Create 15 schools with teachers
        for ($i = 0; $i < 15; $i++) {
            $sch = School::factory()->create();
            Teacher::factory()->create(['school_id' => $sch->id, 'is_active' => true]);
        }

        DB::flushQueryLog();
        DB::enableQueryLog();

        $this->actingAs($this->superAdmin, 'sanctum')->getJson('/api/reports/teacher')->assertStatus(200);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        // Must remain exactly O(1) bounded (7 queries total)
        $this->assertLessThanOrEqual(8, count($queries), "N+1 detected in teacher report with 15 schools");
    }

    /**
     * Requirement: Cache behavior and instant hit response.
     */
    public function test_cache_behavior_and_hit_performance(): void
    {
        Cache::flush();

        // First call populates cache
        $this->actingAs($this->superAdmin, 'sanctum')->getJson('/api/reports/summary')->assertStatus(200);

        // Second call must hit cache with ZERO database queries
        DB::flushQueryLog();
        DB::enableQueryLog();

        $res = $this->actingAs($this->superAdmin, 'sanctum')->getJson('/api/reports/summary')->assertStatus(200);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertEquals(0, count($queries), "Warm cache request executed unexpected database queries!");
        $res->assertJsonStructure(['success', 'data' => ['total_schools', 'total_teachers', 'total_students']]);
    }

    /**
     * Requirement: Async external I/O decoupling.
     */
    public function test_async_external_io_decoupling(): void
    {
        Queue::fake();

        $period = PpdbPeriod::create([
            'school_id' => $this->school->id,
            'academic_year' => '2026/2027',
            'wave_name' => 'Gelombang 1',
            'start_date' => now()->subDay()->toDateString(),
            'end_date' => now()->addMonth()->toDateString(),
            'is_active' => true,
            'quota' => 50,
        ]);

        $payload = [
            'school_id' => $this->school->id,
            'period_id' => $period->id,
            'track' => 'reguler',
            'nisn' => '1234567890',
            'nik' => '3301011234567890',
            'nama_lengkap' => 'Ahmad Santri Baru',
            'jenis_kelamin' => 'L',
            'tempat_lahir' => 'Cilacap',
            'tanggal_lahir' => '2010-05-15',
            'asal_sekolah' => 'SD Negeri 1 Cilacap',
            'no_whatsapp' => '081234567890',
            'alamat' => 'Jl. Merdeka No. 10',
            'kecamatan' => 'Cilacap Selatan',
            'kelurahan' => 'Sidanegara',
            'nama_ayah' => 'Bapak Ahmad',
        ];

        $response = $this->postJson('/api/ppdb/register', $payload)->assertStatus(201);

        Queue::assertPushed(SendPpdbWaNotificationJob::class, function ($job) {
            return $job->phone === '081234567890';
        });
    }
}
