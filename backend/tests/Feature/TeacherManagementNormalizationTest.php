<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use App\Models\ActivityLog;
use App\Services\NormalizationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeacherManagementNormalizationTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $operator;
    private School $school;
    private NormalizationService $normalizationService;

    protected function setUp(): void
    {
        parent::setUp();

        // Create test school
        $this->school = School::factory()->create([
            'nama' => 'MI Darwata Glempang',
            'nsm'  => '111233010001',
            'kecamatan' => 'Glempang Pasir',
        ]);

        // Create users
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

        $this->normalizationService = app(NormalizationService::class);
    }

    // ── Teacher Creation Normalization Tests ──────────────────────────────────

    /**
     * Test that teacher creation normalizes teacher name
     * Requirements: 4.1
     */
    public function test_teacher_creation_normalizes_name(): void
    {
        $payload = [
            'nama' => 'ahmad rifai, s.pd.i, m.pd.i', // Mixed case with multiple degrees
            'nuptk' => '1234567890123456',
            'jenis_kelamin' => 'L',
            'tempat_lahir' => 'Cilacap',
            'pendidikan_terakhir' => 'S2',
            'mapel' => 'Bahasa Arab',
            'unit_kerja' => 'mi darwata glempang', // Mixed case school name
            'status' => 'GTY',
            'phone_number' => '081234567890',
            'email' => 'ahmad.rifai@example.com',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers', $payload);

        $response->assertStatus(201);

        // Verify teacher name was normalized to UPPERCASE with preserved degrees
        $teacher = Teacher::latest()->first();
        $this->assertEquals('AHMAD RIFAI, S.Pd.I, M.Pd.I', $teacher->nama);
        
        // Verify unit_kerja was normalized to Title Case with MI preserved
        $this->assertEquals('MI Darwata Glempang', $teacher->unit_kerja);
        
        // Verify school was found using case-insensitive lookup
        $this->assertEquals($this->school->id, $teacher->school_id);
    }

    /**
     * Test teacher creation with name without degrees
     * Requirements: 4.1
     */
    public function test_teacher_creation_normalizes_name_without_degrees(): void
    {
        $payload = [
            'nama' => 'siti aminah', // No degrees, mixed case
            'nuptk' => '2345678901234567',
            'jenis_kelamin' => 'P',
            'unit_kerja' => 'MI Darwata Glempang',
            'status' => 'GTT',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers', $payload);

        $response->assertStatus(201);

        // Verify name without degrees is converted to UPPERCASE
        $teacher = Teacher::latest()->first();
        $this->assertEquals('SITI AMINAH', $teacher->nama);
    }

    /**
     * Test teacher creation with special characters in name
     * Requirements: 4.1
     */
    public function test_teacher_creation_normalizes_name_with_special_characters(): void
    {
        $payload = [
            'nama' => 'al-farabi ibn sina, dr., s.h', // Hyphens and apostrophes
            'nuptk' => '3456789012345678',
            'jenis_kelamin' => 'L',
            'unit_kerja' => 'MI Darwata Glempang',
            'status' => 'GTY',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers', $payload);

        $response->assertStatus(201);

        // Verify special characters are preserved
        $teacher = Teacher::latest()->first();
        $this->assertEquals('AL-FARABI IBN SINA, Dr., S.H.', $teacher->nama);
    }

    /**
     * Test operator role restrictions during teacher creation
     * Requirements: 4.1
     */
    public function test_operator_teacher_creation_uses_assigned_school(): void
    {
        $payload = [
            'nama' => 'operator teacher, s.pd',
            'nuptk' => '4567890123456789',
            'jenis_kelamin' => 'P',
            'unit_kerja' => 'some other school', // Should be overridden
            'status' => 'GTT',
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers', $payload);

        $response->assertStatus(201);

        // Verify teacher was created with operator's school
        $teacher = Teacher::latest()->first();
        $this->assertEquals('OPERATOR TEACHER, S.Pd.', $teacher->nama);
        $this->assertEquals($this->operator->school_id, $teacher->school_id);
    }

    // ── Teacher Update Normalization Tests ────────────────────────────────────

    /**
     * Test that teacher update normalizes teacher name
     * Requirements: 4.2
     */
    public function test_teacher_update_normalizes_name(): void
    {
        // Create existing teacher
        $teacher = Teacher::factory()->create([
            'nama' => 'Original Name',
            'nuptk' => '5678901234567890',
            'school_id' => $this->school->id,
        ]);

        $payload = [
            'nama' => 'updated name, s.ag, m.ag', // New name with degrees
            'mapel' => 'Fiqh',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/teachers/{$teacher->id}", $payload);

        $response->assertOk();

        // Verify name was normalized
        $teacher->refresh();
        $this->assertEquals('UPDATED NAME, S.Ag., M.Ag.', $teacher->nama);
        $this->assertEquals('Fiqh', $teacher->mapel);
    }

    /**
     * Test teacher update with unit_kerja normalization
     * Requirements: 4.2
     */
    public function test_teacher_update_normalizes_unit_kerja(): void
    {
        // Create another school for testing
        $newSchool = School::factory()->create([
            'nama' => 'SMP NU Cilacap',
            'nsm' => '111233020001',
        ]);

        $teacher = Teacher::factory()->create([
            'nama' => 'EXISTING TEACHER',
            'school_id' => $this->school->id,
        ]);

        $payload = [
            'unit_kerja' => 'smp nu cilacap', // Lowercase school name
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/teachers/{$teacher->id}", $payload);

        $response->assertOk();

        // Verify unit_kerja was normalized and school was found
        $teacher->refresh();
        $this->assertEquals('SMP NU Cilacap', $teacher->unit_kerja);
    }

    /**
     * Test partial teacher update only normalizes provided fields
     * Requirements: 4.2
     */
    public function test_teacher_partial_update_only_normalizes_provided_fields(): void
    {
        $teacher = Teacher::factory()->create([
            'nama' => 'ORIGINAL NAME, S.Pd.',
            'unit_kerja' => 'Original School',
            'school_id' => $this->school->id,
        ]);

        // Only update mapel, not nama or unit_kerja
        $payload = [
            'mapel' => 'Matematika',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/teachers/{$teacher->id}", $payload);

        $response->assertOk();

        // Verify original nama and unit_kerja are unchanged
        $teacher->refresh();
        $this->assertEquals('ORIGINAL NAME, S.Pd.', $teacher->nama);
        $this->assertEquals('Original School', $teacher->unit_kerja);
        $this->assertEquals('Matematika', $teacher->mapel);
    }

    // ── Bulk Import Normalization Tests ───────────────────────────────────────

    /**
     * Test that bulk import normalizes all teacher names
     * Requirements: 4.3
     */
    public function test_bulk_import_normalizes_all_names(): void
    {
        $payload = [
            'teachers' => [
                [
                    'nama' => 'teacher one, s.pd',
                    'nuptk' => '1111111111111111',
                    'jenis_kelamin' => 'L',
                    'unit_kerja' => 'MI Darwata Glempang',
                    'status' => 'GTY',
                ],
                [
                    'nama' => 'TEACHER TWO', // No degree
                    'nuptk' => '2222222222222222',
                    'jenis_kelamin' => 'P',
                    'unit_kerja' => 'MI Darwata Glempang',
                    'status' => 'GTT',
                ],
                [
                    'nama' => 'Teacher Three, Dr., M.Pd.I', // Multiple degrees
                    'nuptk' => '3333333333333333',
                    'jenis_kelamin' => 'L',
                    'unit_kerja' => 'MI Darwata Glempang',
                    'status' => 'GTY',
                ],
            ],
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers/import', $payload);

        $response->assertOk();

        // Verify all names were normalized
        $teachers = Teacher::latest()->take(3)->get();
        
        $actualNames = $teachers->pluck('nama')->toArray();
        $expectedNames = [
            'TEACHER THREE, Dr., M.Pd.I',
            'TEACHER TWO',
            'TEACHER ONE, S.Pd.',
        ];

        // Sort both arrays to avoid order dependency
        sort($actualNames);
        sort($expectedNames);

        $this->assertEquals($expectedNames, $actualNames);
        
        // Verify all have correct unit_kerja and school_id
        foreach ($teachers as $teacher) {
            $this->assertEquals('MI Darwata Glempang', $teacher->unit_kerja);
            $this->assertEquals($this->school->id, $teacher->school_id);
        }
    }

    /**
     * Test bulk import with mixed case school names
     * Requirements: 4.3
     */
    public function test_bulk_import_normalizes_school_names(): void
    {
        // Create additional schools
        $smpSchool = School::factory()->create([
            'nama' => 'SMP NU Cilacap',
            'nsm' => '111233020001',
        ]);

        $maSchool = School::factory()->create([
            'nama' => 'MA NU Cilacap',
            'nsm' => '111233030001',
        ]);

        $payload = [
            'teachers' => [
                [
                    'nama' => 'Teacher MI',
                    'nuptk' => '4444444444444444',
                    'unit_kerja' => 'mi darwata glempang', // Lowercase
                ],
                [
                    'nama' => 'Teacher SMP',
                    'nuptk' => '5555555555555555',
                    'unit_kerja' => 'SMP NU CILACAP', // Uppercase
                ],
                [
                    'nama' => 'Teacher MA',
                    'nuptk' => '6666666666666666',
                    'unit_kerja' => 'Ma Nu Cilacap', // Mixed case
                ],
            ],
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers/import', $payload);

        $response->assertOk();

        // Verify school names were normalized and correct schools were assigned
        $teachers = Teacher::whereIn('nuptk', ['4444444444444444', '5555555555555555', '6666666666666666'])
            ->get()
            ->keyBy('nuptk');

        $this->assertEquals('MI Darwata Glempang', $teachers['4444444444444444']->unit_kerja);
        $this->assertEquals($this->school->id, $teachers['4444444444444444']->school_id);

        $this->assertEquals('SMP NU Cilacap', $teachers['5555555555555555']->unit_kerja);
        $this->assertEquals($smpSchool->id, $teachers['5555555555555555']->school_id);

        $this->assertEquals('MA NU Cilacap', $teachers['6666666666666666']->unit_kerja);
        $this->assertEquals($maSchool->id, $teachers['6666666666666666']->school_id);
    }

    /**
     * Test bulk import with operator role restrictions
     * Requirements: 4.3
     */
    public function test_bulk_import_operator_role_restrictions(): void
    {
        $payload = [
            'teachers' => [
                [
                    'nama' => 'operator import teacher',
                    'nuptk' => '7777777777777777',
                    'unit_kerja' => 'Some Other School', // Should be ignored
                ],
            ],
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', $payload);

        $response->assertOk();

        // Verify teacher was assigned to operator's school regardless of unit_kerja
        $teacher = Teacher::where('nuptk', '7777777777777777')->first();
        $this->assertNotNull($teacher);
        $this->assertEquals('OPERATOR IMPORT TEACHER', $teacher->nama);
        $this->assertEquals($this->operator->school_id, $teacher->school_id);
    }

    /**
     * Test bulk import handles existing teachers (upsert behavior)
     * Requirements: 4.3
     */
    public function test_bulk_import_handles_existing_teachers(): void
    {
        // Create existing teacher
        $existingTeacher = Teacher::factory()->create([
            'nama' => 'old name',
            'nuptk' => '8888888888888888',
            'school_id' => $this->school->id,
            'mapel' => 'Old Subject',
        ]);

        $payload = [
            'teachers' => [
                [
                    'nama' => 'updated name, s.pd', // Updated name with degree
                    'nuptk' => '8888888888888888', // Same NUPTK
                    'mapel' => 'New Subject',
                    'unit_kerja' => 'MI Darwata Glempang',
                ],
            ],
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers/import', $payload);

        $response->assertOk();

        // Verify existing teacher was updated with normalized data
        $existingTeacher->refresh();
        $this->assertEquals('UPDATED NAME, S.Pd.', $existingTeacher->nama);
        $this->assertEquals('New Subject', $existingTeacher->mapel);
        $this->assertEquals('MI Darwata Glempang', $existingTeacher->unit_kerja);
        
        // Verify only one teacher with this NUPTK exists
        $this->assertEquals(1, Teacher::where('nuptk', '8888888888888888')->count());
    }

    // ── Database Persistence Verification Tests ───────────────────────────────

    /**
     * Test that normalized data is properly saved to database
     * Requirements: 4.1, 4.2, 4.3
     */
    public function test_normalized_data_is_saved_to_database(): void
    {
        // Test creation
        $createPayload = [
            'nama' => 'database test teacher, s.kom, m.kom',
            'nuptk' => '9999999999999999',
            'unit_kerja' => 'mi darwata glempang',
            'jenis_kelamin' => 'L',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers', $createPayload);

        $response->assertStatus(201);

        // Verify normalized data in database
        $this->assertDatabaseHas('teachers', [
            'nama' => 'DATABASE TEST TEACHER, S.Kom., M.Kom.',
            'unit_kerja' => 'MI Darwata Glempang',
            'nuptk' => '9999999999999999',
            'school_id' => $this->school->id,
        ]);

        // Test update
        $teacher = Teacher::where('nuptk', '9999999999999999')->first();
        $updatePayload = [
            'nama' => 'updated database teacher, dr.',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/teachers/{$teacher->id}", $updatePayload);

        $response->assertOk();

        // Verify updated normalized data in database
        $this->assertDatabaseHas('teachers', [
            'id' => $teacher->id,
            'nama' => 'UPDATED DATABASE TEACHER, Dr.',
            'nuptk' => '9999999999999999',
        ]);
    }

    /**
     * Test that activity logs are created for normalization changes
     * Requirements: 13.2
     */
    public function test_activity_logs_created_for_normalization(): void
    {
        // Test creation with normalization
        $payload = [
            'nama' => 'activity log teacher, s.ag',
            'nuptk' => '1010101010101010',
            'unit_kerja' => 'mi darwata glempang',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers', $payload);

        $response->assertStatus(201);

        // Verify activity log was created
        $this->assertDatabaseHas('activity_logs', [
            'event' => 'create_teacher',
            'log_name' => 'master',
            'causer_id' => $this->superAdmin->id,
        ]);

        // Verify activity log includes normalization details
        $activityLog = ActivityLog::where('event', 'create_teacher')->latest()->first();
        $properties = $activityLog->properties;
        
        $this->assertArrayHasKey('normalization', $properties);
        $this->assertArrayHasKey('nama', $properties['normalization']);
        $this->assertArrayHasKey('unit_kerja', $properties['normalization']);
        
        $this->assertEquals('activity log teacher, s.ag', $properties['normalization']['nama']['original']);
        $this->assertEquals('ACTIVITY LOG TEACHER, S.Ag.', $properties['normalization']['nama']['normalized']);
    }

    /**
     * Test bulk import creates activity logs for normalization
     * Requirements: 13.2
     */
    public function test_bulk_import_creates_activity_logs(): void
    {
        $payload = [
            'teachers' => [
                [
                    'nama' => 'bulk import teacher, s.pd.i',
                    'nuptk' => '1212121212121212',
                    'unit_kerja' => 'mi darwata glempang',
                ],
            ],
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers/import', $payload);

        $response->assertOk();

        // Verify activity log was created for import normalization
        $this->assertDatabaseHas('activity_logs', [
            'event' => 'import_normalize_teacher',
            'log_name' => 'master',
            'causer_id' => $this->superAdmin->id,
        ]);

        // Verify activity log includes normalization details
        $activityLog = ActivityLog::where('event', 'import_normalize_teacher')->latest()->first();
        $properties = $activityLog->properties;
        
        $this->assertArrayHasKey('normalization', $properties);
        $this->assertEquals('bulk import teacher, s.pd.i', $properties['normalization']['nama']['original']);
        $this->assertEquals('BULK IMPORT TEACHER, S.Pd.I', $properties['normalization']['nama']['normalized']);
    }

    // ── Edge Cases and Error Handling ─────────────────────────────────────────

    /**
     * Test normalization with null and empty values
     */
    public function test_normalization_handles_null_and_empty_values(): void
    {
        $payload = [
            'nama' => 'Simple Teacher', // No degree
            'nuptk' => '1313131313131313',
            'unit_kerja' => null, // Null unit_kerja
            'mapel' => '', // Empty mapel
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers', $payload);

        $response->assertStatus(201);

        // Verify normalization works with null/empty values
        $teacher = Teacher::latest()->first();
        $this->assertEquals('SIMPLE TEACHER', $teacher->nama);
        $this->assertNull($teacher->unit_kerja);
        $this->assertNull($teacher->school_id); // No school found
    }

    /**
     * Test case-insensitive school lookup during teacher operations
     */
    public function test_case_insensitive_school_lookup(): void
    {
        $testCases = [
            'mi darwata glempang',     // All lowercase
            'MI DARWATA GLEMPANG',     // All uppercase  
            'Mi Darwata Glempang',     // Title case
            'mI dArWaTa GlEmPaNg',     // Mixed case
        ];

        foreach ($testCases as $index => $unitKerja) {
            $payload = [
                'nama' => "Test Teacher {$index}",
                'nuptk' => "131313131313131{$index}",
                'unit_kerja' => $unitKerja,
            ];

            $response = $this->actingAs($this->superAdmin)
                ->postJson('/api/teachers', $payload);

            $response->assertStatus(201);

            // Verify school was found regardless of case
            $teacher = Teacher::latest()->first();
            $this->assertEquals($this->school->id, $teacher->school_id);
            $this->assertEquals('MI Darwata Glempang', $teacher->unit_kerja); // Normalized
        }
    }
}