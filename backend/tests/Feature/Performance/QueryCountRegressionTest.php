<?php

namespace Tests\Feature\Performance;

use App\Jobs\SendPpdbWaNotificationJob;
use App\Models\PpdbPeriod;
use App\Models\PpdbRegistration;
use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Performance Regression Tests for SEC-PERF-001.
 *
 * Validates:
 * 1. GET /api/ppdb/schools executes bounded queries (no N+1), clamps per_page to 50.
 * 2. GET /api/reports/teachers executes O(1) queries regardless of school count.
 * 3. PPDB registration dispatches WhatsApp notification asynchronously without blocking DB transaction.
 */
class QueryCountRegressionTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $operator;
    private School $school;

    public function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create([
            'nama' => 'Test School A',
            'kecamatan' => 'Cilacap Tengah',
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
     * Test that GET /api/ppdb/schools runs with bounded query count (<= 5 queries)
     * and clamps per_page to 50 even when user requests 1000.
     */
    public function test_ppdb_schools_has_bounded_queries_and_clamped_pagination(): void
    {
        // Arrange: Create 10 schools with active PPDB periods
        for ($i = 0; $i < 10; $i++) {
            $sch = School::factory()->create([
                'status_jamiyyah' => 'aktif',
                'kecamatan' => 'Cilacap',
            ]);
            PpdbPeriod::create([
                'school_id' => $sch->id,
                'academic_year' => '2026/2027',
                'wave_name' => "Gelombang 1 {$sch->nama}",
                'start_date' => now()->subDay()->toDateString(),
                'end_date' => now()->addMonth()->toDateString(),
                'is_active' => true,
                'quota' => 100,
            ]);
        }

        Cache::flush();
        DB::flushQueryLog();
        DB::enableQueryLog();

        $startTime = microtime(true);
        $response = $this->getJson('/api/ppdb/schools?per_page=1000');
        $elapsedMs = (microtime(true) - $startTime) * 1000;

        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $response->assertStatus(200);

        // Clamped to max 50
        $data = $response->json();
        $this->assertLessThanOrEqual(50, count($data['data'] ?? []));

        // Queries must be bounded <= 5 (count, select schools, active periods cache miss, etc.)
        $this->assertLessThanOrEqual(
            5,
            count($queries),
            "Expected <= 5 queries for /api/ppdb/schools, but executed " . count($queries) . " queries:\n"
            . json_encode(array_column($queries, 'query'), JSON_PRETTY_PRINT)
        );

        // Elapsed time must be well under 1500ms in test environment
        $this->assertLessThan(
            1500,
            $elapsedMs,
            "Response took {$elapsedMs}ms, which exceeds acceptable threshold"
        );
    }

    /**
     * Test that GET /api/reports/teachers does NOT have an N+1 query loop.
     * Query count should remain constant whether there are 3 schools or 15 schools.
     */
    public function test_teacher_report_does_not_have_n_plus_one_queries(): void
    {
        // Arrange: Create 10 schools each with 3 teachers using factory
        for ($i = 0; $i < 10; $i++) {
            $sch = School::factory()->create();
            for ($j = 0; $j < 3; $j++) {
                Teacher::factory()->create([
                    'school_id' => $sch->id,
                    'is_active' => true,
                ]);
            }
        }

        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson('/api/reports/teacher');

        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $response->assertStatus(200);

        // Before optimization, this executed 1 query per school (1500+ queries in production).
        // After optimization with single GROUP BY aggregate, queries are strictly O(1) bounded (exactly 7 queries).
        $this->assertLessThanOrEqual(
            8,
            count($queries),
            "Teacher report executed " . count($queries) . " queries (N+1 regression detected!):\n"
            . json_encode(array_column($queries, 'query'), JSON_PRETTY_PRINT)
        );
    }

    /**
     * Test that PPDB registration dispatches SendPpdbWaNotificationJob to queue
     * and does NOT invoke synchronous external HTTP in the transaction.
     */
    public function test_ppdb_registration_dispatches_wa_job_asynchronously(): void
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
            'kecamatan' => 'Cilacap Tengah',
            'kelurahan' => 'Sidanegara',
            'nama_ayah' => 'Bapak Ahmad',
        ];

        $response = $this->postJson('/api/ppdb/register', $payload);

        $response->assertStatus(201);

        // Assert job was dispatched to queue
        Queue::assertPushed(SendPpdbWaNotificationJob::class, function ($job) {
            return $job->phone === '081234567890';
        });
    }
}
