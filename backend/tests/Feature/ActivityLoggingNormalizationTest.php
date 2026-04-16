<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tests for activity logging during normalization operations.
 *
 * Requirements: 13.1, 13.2, 13.3
 */
class ActivityLoggingNormalizationTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $operator;
    private School $school;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create([
            'nama'      => 'MI Darwata Glempang',
            'nsm'       => '111233010001',
            'kecamatan' => 'Glempang Pasir',
        ]);

        $this->superAdmin = User::factory()->create([
            'role'      => 'super_admin',
            'email'     => 'admin@test.com',
            'is_active' => true,
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'operator@test.com',
            'school_id' => $this->school->id,
            'unit'      => 'MI Darwata Glempang',
            'is_active' => true,
        ]);
    }

    // ── SK Submission Activity Logging ────────────────────────────────────────

    /**
     * SK submission creates an activity log entry when normalization occurs.
     * Requirements: 13.1, 13.3
     */
    public function test_sk_submission_creates_activity_log_when_normalization_occurs(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-documents/submit-request', [
                'nama'                 => 'siti aminah, s.pd',
                'nuptk'                => '1234567890123456',
                'jenis_sk'             => 'Pengangkatan',
                'unit_kerja'           => 'mi darwata glempang',
                'jabatan'              => 'Guru Kelas',
                'surat_permohonan_url' => 'https://example.com/surat.pdf',
                'tanggal_penetapan'    => '2025-01-15',
            ]);

        $response->assertStatus(201);

        $log = ActivityLog::where('event', 'submit_sk_request')->latest()->first();

        $this->assertNotNull($log, 'Activity log should be created for SK submission');
        $this->assertEquals('sk', $log->log_name);
        $this->assertEquals($this->superAdmin->id, $log->causer_id);
        $this->assertNotNull($log->subject_id);
        $this->assertEquals(SkDocument::class, $log->subject_type);
    }

    /**
     * SK submission log includes original and normalized unit_kerja.
     * Requirements: 13.2, 13.3
     */
    public function test_sk_submission_log_includes_original_and_normalized_unit_kerja(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-documents/submit-request', [
                'nama'                 => 'Test Teacher',
                'nuptk'                => '1111111111111111',
                'jenis_sk'             => 'Pengangkatan',
                'unit_kerja'           => 'mi darwata glempang',
                'jabatan'              => 'Guru Kelas',
                'surat_permohonan_url' => 'https://example.com/surat.pdf',
                'tanggal_penetapan'    => '2025-01-15',
            ])
            ->assertStatus(201);

        $log = ActivityLog::where('event', 'submit_sk_request')->latest()->first();
        $properties = $log->properties;

        $this->assertArrayHasKey('normalization', $properties);
        $this->assertArrayHasKey('unit_kerja', $properties['normalization']);

        $change = $properties['normalization']['unit_kerja'];
        $this->assertEquals('mi darwata glempang', $change['original']);
        $this->assertEquals('MI Darwata Glempang', $change['normalized']);
    }

    /**
     * SK submission log includes original and normalized nama.
     * Requirements: 13.2, 13.3
     */
    public function test_sk_submission_log_includes_original_and_normalized_nama(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-documents/submit-request', [
                'nama'                 => "ahmad ayub nu'man, s.h",
                'nuptk'                => '2222222222222222',
                'jenis_sk'             => 'Pengangkatan',
                'unit_kerja'           => 'MI Darwata Glempang',
                'jabatan'              => 'Guru Kelas',
                'surat_permohonan_url' => 'https://example.com/surat.pdf',
                'tanggal_penetapan'    => '2025-01-15',
            ])
            ->assertStatus(201);

        $log = ActivityLog::where('event', 'submit_sk_request')->latest()->first();
        $properties = $log->properties;

        $this->assertArrayHasKey('normalization', $properties);
        $this->assertArrayHasKey('nama', $properties['normalization']);

        $change = $properties['normalization']['nama'];
        $this->assertEquals("ahmad ayub nu'man, s.h", $change['original']);
        $this->assertEquals("AHMAD AYUB NU'MAN, S.H.", $change['normalized']);
    }

    /**
     * SK submission log omits normalization key when data is already normalized.
     * Requirements: 13.3
     */
    public function test_sk_submission_log_omits_normalization_when_data_already_normalized(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-documents/submit-request', [
                'nama'                 => 'ALREADY NORMALIZED',
                'nuptk'                => '3333333333333333',
                'jenis_sk'             => 'Pengangkatan',
                'unit_kerja'           => 'MI Darwata Glempang',
                'jabatan'              => 'Guru Kelas',
                'surat_permohonan_url' => 'https://example.com/surat.pdf',
                'tanggal_penetapan'    => '2025-01-15',
            ])
            ->assertStatus(201);

        $log = ActivityLog::where('event', 'submit_sk_request')->latest()->first();
        $properties = $log->properties;

        $this->assertTrue(
            !isset($properties['normalization']) || empty($properties['normalization']),
            'Normalization key should be absent when no normalization was needed'
        );
    }

    // ── Teacher Creation Activity Logging ─────────────────────────────────────

    /**
     * Teacher creation creates an activity log entry.
     * Requirements: 13.1, 13.2
     */
    public function test_teacher_creation_creates_activity_log(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers', [
                'nama'      => 'budi santoso, s.pd',
                'unit_kerja' => 'mi darwata glempang',
                'school_id' => $this->school->id,
                'status'    => 'GTY',
            ])
            ->assertStatus(201);

        $log = ActivityLog::where('event', 'create_teacher')->latest()->first();

        $this->assertNotNull($log, 'Activity log should be created on teacher creation');
        $this->assertEquals('master', $log->log_name);
        $this->assertEquals($this->superAdmin->id, $log->causer_id);
        $this->assertEquals(Teacher::class, $log->subject_type);
    }

    /**
     * Teacher creation log includes original and normalized name values.
     * Requirements: 13.2
     */
    public function test_teacher_creation_log_includes_normalization_details(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers', [
                'nama'      => 'budi santoso, s.pd',
                'unit_kerja' => 'mi darwata glempang',
                'school_id' => $this->school->id,
                'status'    => 'GTY',
            ])
            ->assertStatus(201);

        $log = ActivityLog::where('event', 'create_teacher')->latest()->first();
        $properties = $log->properties;

        $this->assertArrayHasKey('normalization', $properties);

        // nama was normalized
        $this->assertArrayHasKey('nama', $properties['normalization']);
        $this->assertEquals('budi santoso, s.pd', $properties['normalization']['nama']['original']);
        $this->assertEquals('BUDI SANTOSO, S.Pd.', $properties['normalization']['nama']['normalized']);

        // unit_kerja was normalized
        $this->assertArrayHasKey('unit_kerja', $properties['normalization']);
        $this->assertEquals('mi darwata glempang', $properties['normalization']['unit_kerja']['original']);
        $this->assertEquals('MI Darwata Glempang', $properties['normalization']['unit_kerja']['normalized']);
    }

    /**
     * Teacher creation log references the correct teacher record.
     * Requirements: 13.2
     */
    public function test_teacher_creation_log_references_correct_teacher(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers', [
                'nama'      => 'fatimah zahra',
                'unit_kerja' => 'MI Darwata Glempang',
                'school_id' => $this->school->id,
                'status'    => 'GTY',
            ])
            ->assertStatus(201);

        $teacher = Teacher::where('nama', 'FATIMAH ZAHRA')->first();
        $log = ActivityLog::where('event', 'create_teacher')->latest()->first();

        $this->assertNotNull($teacher);
        $this->assertEquals($teacher->id, $log->subject_id);
        $this->assertEquals($teacher->school_id, $log->school_id);
    }

    /**
     * Teacher creation log omits normalization key when name is already normalized.
     * Requirements: 13.2
     */
    public function test_teacher_creation_log_omits_normalization_when_already_normalized(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers', [
                'nama'      => 'ALREADY NORMALIZED TEACHER',
                'unit_kerja' => 'MI Darwata Glempang',
                'school_id' => $this->school->id,
                'status'    => 'GTY',
            ])
            ->assertStatus(201);

        $log = ActivityLog::where('event', 'create_teacher')->latest()->first();
        $properties = $log->properties;

        $this->assertTrue(
            !isset($properties['normalization']) || empty($properties['normalization']),
            'Normalization key should be absent when no normalization was needed'
        );
    }

    // ── Migration Command Activity Logging ────────────────────────────────────

    /**
     * Migration command creates a summary activity log on completion.
     * Requirements: 13.1
     */
    public function test_migration_command_creates_summary_activity_log(): void
    {
        School::factory()->create(['nama' => 'mi test school']);

        $this->artisan('normalize:data')->assertExitCode(0);

        $log = ActivityLog::where('event', 'normalize_data')->first();

        $this->assertNotNull($log, 'Summary activity log should be created after command runs');
        $this->assertEquals('system', $log->log_name);
        $this->assertStringContainsString('Data normalization completed', $log->description);
    }

    /**
     * Migration command summary log description includes counts for each entity type.
     * Requirements: 13.2
     */
    public function test_migration_command_summary_log_includes_entity_counts(): void
    {
        $school = School::factory()->create(['nama' => 'mi test school']);
        Teacher::factory()->create([
            'nama'      => 'ahmad dahlan, s.pd',
            'unit_kerja' => 'ma test school',
            'school_id' => $school->id,
        ]);

        $this->artisan('normalize:data')->assertExitCode(0);

        $log = ActivityLog::where('event', 'normalize_data')->first();

        $this->assertStringContainsString('1 schools', $log->description);
        $this->assertStringContainsString('1 teachers', $log->description);
    }

    /**
     * Migration command creates batch logs with original and normalized values per record.
     * Requirements: 13.2
     */
    public function test_migration_command_batch_logs_include_original_and_normalized_values(): void
    {
        $school = School::factory()->create(['nama' => 'mi test school']);
        Teacher::factory()->create([
            'nama'      => 'ahmad dahlan, s.pd',
            'unit_kerja' => 'ma test school',
            'school_id' => $school->id,
        ]);

        $this->artisan('normalize:data')->assertExitCode(0);

        $batchLogs = ActivityLog::where('event', 'batch_normalize_data')->get();
        $this->assertGreaterThan(0, $batchLogs->count());

        foreach ($batchLogs as $batchLog) {
            $properties = $batchLog->properties;

            $this->assertArrayHasKey('entity_type', $properties);
            $this->assertArrayHasKey('changes', $properties);
            $this->assertArrayHasKey('batch_size', $properties);

            foreach ($properties['changes'] as $change) {
                $this->assertArrayHasKey('table', $change);
                $this->assertArrayHasKey('record_id', $change);
                $this->assertArrayHasKey('field', $change);
                $this->assertArrayHasKey('original', $change);
                $this->assertArrayHasKey('normalized', $change);
                $this->assertNotEquals($change['original'], $change['normalized']);
            }
        }
    }

    /**
     * Migration command does NOT create activity logs in dry-run mode.
     * Requirements: 13.1
     */
    public function test_migration_command_does_not_create_logs_in_dry_run_mode(): void
    {
        School::factory()->create(['nama' => 'mi test school']);

        $this->artisan('normalize:data --dry-run')->assertExitCode(0);

        $this->assertNull(ActivityLog::where('event', 'normalize_data')->first());
        $this->assertEquals(0, ActivityLog::where('event', 'batch_normalize_data')->count());
    }

    /**
     * Migration command batch logs reference the correct table and record IDs.
     * Requirements: 13.2
     */
    public function test_migration_command_batch_logs_reference_correct_table_and_record(): void
    {
        $school = School::factory()->create(['nama' => 'mi test school']);

        $this->artisan('normalize:data')->assertExitCode(0);

        $schoolBatchLog = ActivityLog::where('event', 'batch_normalize_data')
            ->whereJsonContains('properties->entity_type', 'schools')
            ->first();

        $this->assertNotNull($schoolBatchLog);

        $changes = $schoolBatchLog->properties['changes'];
        $this->assertNotEmpty($changes);

        $change = $changes[0];
        $this->assertEquals('schools', $change['table']);
        $this->assertEquals($school->id, $change['record_id']);
        $this->assertEquals('nama', $change['field']);
        $this->assertEquals('mi test school', $change['original']);
        $this->assertEquals('MI Test School', $change['normalized']);
    }
}
