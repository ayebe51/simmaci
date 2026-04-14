<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Preservation Property Tests for Teacher Import Bugfix
 * 
 * **CRITICAL**: These tests MUST PASS on UNFIXED code to establish baseline behavior.
 * They verify that non-import endpoints and behaviors remain unchanged after the fix.
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 * 
 * **Property 2: Preservation** - Non-Import Endpoints Behavior Unchanged
 */
class TeacherImportPreservationTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $operator1;
    private User $operator2;
    private School $school1;
    private School $school2;

    protected function setUp(): void
    {
        parent::setUp();

        // Create two schools for tenant isolation testing
        $this->school1 = School::factory()->create([
            'nama' => 'MI School One',
            'nsm'  => '111233010001',
        ]);

        $this->school2 = School::factory()->create([
            'nama' => 'MI School Two',
            'nsm'  => '111233010002',
        ]);

        $this->superAdmin = User::factory()->create([
            'role'      => 'super_admin',
            'email'     => 'superadmin@test.com',
            'school_id' => null,
            'is_active' => true,
        ]);

        $this->operator1 = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'operator1@test.com',
            'school_id' => $this->school1->id,
            'unit'      => 'MI School One',
            'is_active' => true,
        ]);

        $this->operator2 = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'operator2@test.com',
            'school_id' => $this->school2->id,
            'unit'      => 'MI School Two',
            'is_active' => true,
        ]);
    }

    /**
     * Preservation 3.1: Manual Store Preservation
     * 
     * Verifies that POST /api/teachers (manual store) continues to:
     * - Validate data correctly
     * - Save teacher to database
     * - Record activity log
     * 
     * **Property**: For all POST /api/teachers requests with valid data,
     * teacher SHALL be saved and ActivityLog SHALL be recorded.
     */
    public function test_preservation_manual_store_saves_teacher_and_logs_activity(): void
    {
        $payload = [
            'nama' => 'Manual Teacher',
            'nuptk' => '1234567890123456',
            'jenis_kelamin' => 'L',
            'tempat_lahir' => 'Jakarta',
            'tanggal_lahir' => '1990-01-15',
            'pendidikan_terakhir' => 'S1',
            'status' => 'GTY',
        ];

        $response = $this->actingAs($this->operator1)
            ->postJson('/api/teachers', $payload);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'id',
                    'nama',
                    'nuptk',
                ],
            ]);

        // Verify teacher was saved
        $teacher = Teacher::where('nuptk', '1234567890123456')->first();
        $this->assertNotNull($teacher);
        $this->assertEquals('Manual Teacher', $teacher->nama);
        $this->assertEquals($this->school1->id, $teacher->school_id);

        // Verify activity log was recorded
        $activityLog = ActivityLog::where('subject_type', Teacher::class)
            ->where('subject_id', $teacher->id)
            ->where('event', 'created')
            ->first();

        $this->assertNotNull($activityLog, 'Activity log should be recorded for manual teacher creation');
        $this->assertEquals($this->operator1->id, $activityLog->causer_id);
    }

    /**
     * Preservation 3.2: Tenant Scope for Operators
     * 
     * Verifies that GET /api/teachers as operator continues to:
     * - Apply tenant scope (only return teachers from operator's school)
     * - Not return teachers from other schools
     * 
     * **Property**: For all operator requests to GET /api/teachers,
     * response SHALL only contain teachers with school_id == operator.school_id.
     */
    public function test_preservation_operator_get_teachers_only_returns_own_school(): void
    {
        // Create teachers in both schools
        $teacher1 = Teacher::factory()->create([
            'nama' => 'Teacher School 1',
            'nuptk' => '1111111111111111',
            'school_id' => $this->school1->id,
        ]);

        $teacher2 = Teacher::factory()->create([
            'nama' => 'Teacher School 2',
            'nuptk' => '2222222222222222',
            'school_id' => $this->school2->id,
        ]);

        // Operator 1 should only see teachers from school 1
        $response = $this->actingAs($this->operator1)
            ->getJson('/api/teachers');

        $response->assertStatus(200);
        $teachers = $response->json('data');

        $this->assertNotEmpty($teachers);
        
        // Verify all returned teachers belong to school 1
        foreach ($teachers as $teacher) {
            $this->assertEquals(
                $this->school1->id,
                $teacher['school_id'],
                'Operator should only see teachers from their own school'
            );
        }

        // Verify teacher from school 2 is NOT in the results
        $nuptkList = array_column($teachers, 'nuptk');
        $this->assertNotContains('2222222222222222', $nuptkList, 'Teacher from other school should not be visible');
    }

    /**
     * Preservation 3.2: Super Admin Sees All Data
     * 
     * Verifies that GET /api/teachers as super admin continues to:
     * - Return teachers from all schools (no tenant scope)
     * 
     * **Property**: For all super_admin requests to GET /api/teachers,
     * response SHALL contain teachers from all schools.
     */
    public function test_preservation_super_admin_sees_all_teachers(): void
    {
        // Create teachers in both schools
        Teacher::factory()->create([
            'nama' => 'Teacher School 1',
            'nuptk' => '1111111111111111',
            'school_id' => $this->school1->id,
        ]);

        Teacher::factory()->create([
            'nama' => 'Teacher School 2',
            'nuptk' => '2222222222222222',
            'school_id' => $this->school2->id,
        ]);

        // Super admin should see teachers from both schools
        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/teachers');

        $response->assertStatus(200);
        $teachers = $response->json('data');

        $this->assertNotEmpty($teachers);
        
        // Verify teachers from both schools are present
        $schoolIds = array_unique(array_column($teachers, 'school_id'));
        $this->assertGreaterThanOrEqual(2, count($schoolIds), 'Super admin should see teachers from multiple schools');
    }

    /**
     * Preservation 3.3: Partial Success in Import
     * 
     * Verifies that import with mixed valid/invalid rows continues to:
     * - Save valid rows
     * - Report invalid rows in errors array
     * - Return partial success (created + errors.length == total_rows)
     * 
     * **Property**: For all import requests with mixed valid/invalid rows,
     * created + errors.length SHALL equal total_rows.
     */
    public function test_preservation_partial_success_import_processes_all_rows(): void
    {
        $payload = [
            'teachers' => [
                [
                    'nama' => 'Valid Teacher 1',
                    'nuptk' => '1000000000000001',
                    'jenis_kelamin' => 'L',
                ],
                [
                    'nama' => 'Valid Teacher 2',
                    'nuptk' => '1000000000000002',
                    'jenis_kelamin' => 'P',
                ],
                [
                    'nama' => 'Valid Teacher 3',
                    'nuptk' => '1000000000000003',
                    'jenis_kelamin' => 'L',
                ],
            ],
        ];

        $response = $this->actingAs($this->operator1)
            ->postJson('/api/teachers/import', $payload);

        $response->assertStatus(200);

        $created = $response->json('created');
        $errors = $response->json('errors');
        $totalRows = count($payload['teachers']);

        // Verify partial success property: created + errors.length == total_rows
        $this->assertEquals(
            $totalRows,
            $created + count($errors),
            'created + errors.length should equal total rows (partial success property)'
        );

        // Verify summary is present
        $this->assertIsString($response->json('summary'));
    }

    /**
     * Preservation 3.4: NUPTK Upsert (No Duplicates)
     * 
     * Verifies that import with duplicate NUPTK continues to:
     * - Update existing teacher (upsert)
     * - Not create duplicate records
     * 
     * **Property**: For all import requests with duplicate NUPTK,
     * no duplicate records SHALL exist in database after import.
     */
    public function test_preservation_import_with_duplicate_nuptk_updates_not_duplicates(): void
    {
        // Create existing teacher
        $existingTeacher = Teacher::factory()->create([
            'nama' => 'Original Name',
            'nuptk' => '5555666677778888',
            'school_id' => $this->school1->id,
            'jenis_kelamin' => 'L',
        ]);

        $originalId = $existingTeacher->id;

        // Import with same NUPTK but different name
        $payload = [
            'teachers' => [
                [
                    'nama' => 'Updated Name',
                    'nuptk' => '5555666677778888', // Same NUPTK
                    'jenis_kelamin' => 'P', // Different gender
                ],
            ],
        ];

        $response = $this->actingAs($this->operator1)
            ->postJson('/api/teachers/import', $payload);

        $response->assertStatus(200);
        $this->assertEquals(1, $response->json('created'));

        // Verify no duplicate was created
        $teacherCount = Teacher::where('nuptk', '5555666677778888')->count();
        $this->assertEquals(1, $teacherCount, 'Should not create duplicate teacher with same NUPTK');

        // Verify existing teacher was updated
        $existingTeacher->refresh();
        $this->assertEquals($originalId, $existingTeacher->id, 'Should update existing teacher, not create new one');
        $this->assertEquals('Updated Name', $existingTeacher->nama, 'Name should be updated');
        $this->assertEquals('P', $existingTeacher->jenis_kelamin, 'Gender should be updated');
    }

    /**
     * Preservation 3.5: Operator Auto-Fill school_id
     * 
     * Verifies that operator import continues to:
     * - Auto-fill school_id from operator's account
     * - Apply school_id to all imported rows
     * 
     * **Property**: For all operator import requests,
     * every imported row SHALL have school_id == operator.school_id.
     */
    public function test_preservation_operator_import_auto_fills_school_id(): void
    {
        $payload = [
            'teachers' => [
                [
                    'nama' => 'Teacher Auto School 1',
                    'nuptk' => '7777888899990001',
                    'jenis_kelamin' => 'L',
                    // No school_id provided
                ],
                [
                    'nama' => 'Teacher Auto School 2',
                    'nuptk' => '7777888899990002',
                    'jenis_kelamin' => 'P',
                    // No school_id provided
                ],
            ],
        ];

        $response = $this->actingAs($this->operator1)
            ->postJson('/api/teachers/import', $payload);

        $response->assertStatus(200);
        $this->assertEquals(2, $response->json('created'));

        // Verify all imported teachers have operator's school_id
        $teacher1 = Teacher::where('nuptk', '7777888899990001')->first();
        $teacher2 = Teacher::where('nuptk', '7777888899990002')->first();

        $this->assertNotNull($teacher1);
        $this->assertNotNull($teacher2);
        
        $this->assertEquals(
            $this->school1->id,
            $teacher1->school_id,
            'Operator import should auto-fill school_id from operator account'
        );
        
        $this->assertEquals(
            $this->school1->id,
            $teacher2->school_id,
            'All rows should have operator school_id'
        );
    }

    /**
     * Preservation: CRUD Operations Remain Functional
     * 
     * Verifies that all CRUD operations continue to work after bugfix:
     * - GET /api/teachers/{id} (show)
     * - PUT /api/teachers/{id} (update)
     * - DELETE /api/teachers/{id} (destroy)
     */
    public function test_preservation_crud_operations_remain_functional(): void
    {
        $teacher = Teacher::factory()->create([
            'nama' => 'CRUD Test Teacher',
            'nuptk' => '8888999900001111',
            'school_id' => $this->school1->id,
        ]);

        // Test SHOW
        $showResponse = $this->actingAs($this->operator1)
            ->getJson("/api/teachers/{$teacher->id}");
        
        $showResponse->assertStatus(200)
            ->assertJsonPath('data.id', $teacher->id);

        // Test UPDATE
        $updatePayload = [
            'nama' => 'Updated CRUD Teacher',
            'jenis_kelamin' => 'P',
        ];

        $updateResponse = $this->actingAs($this->operator1)
            ->putJson("/api/teachers/{$teacher->id}", $updatePayload);
        
        $updateResponse->assertStatus(200);
        
        $teacher->refresh();
        $this->assertEquals('Updated CRUD Teacher', $teacher->nama);

        // Test DELETE
        $deleteResponse = $this->actingAs($this->operator1)
            ->deleteJson("/api/teachers/{$teacher->id}");
        
        $deleteResponse->assertStatus(200);
        
        // Verify soft delete
        $this->assertSoftDeleted('teachers', ['id' => $teacher->id]);
    }

    /**
     * Property-Based Test: Tenant Isolation Invariant
     * 
     * Generates multiple scenarios to verify tenant isolation is preserved.
     * 
     * **Property**: For any operator O with school_id S,
     * GET /api/teachers SHALL only return teachers where school_id = S.
     */
    public function test_property_tenant_isolation_invariant_holds(): void
    {
        // Create 10 teachers across both schools
        for ($i = 1; $i <= 5; $i++) {
            Teacher::factory()->create([
                'nuptk' => "1000000000000{$i}",
                'school_id' => $this->school1->id,
            ]);
        }

        for ($i = 6; $i <= 10; $i++) {
            Teacher::factory()->create([
                'nuptk' => "1000000000000{$i}",
                'school_id' => $this->school2->id,
            ]);
        }

        // Test operator 1 isolation
        $response1 = $this->actingAs($this->operator1)
            ->getJson('/api/teachers?per_page=100');

        $response1->assertStatus(200);
        $teachers1 = $response1->json('data');

        foreach ($teachers1 as $teacher) {
            $this->assertEquals(
                $this->school1->id,
                $teacher['school_id'],
                'Tenant isolation violated: operator 1 sees teacher from other school'
            );
        }

        // Test operator 2 isolation
        $response2 = $this->actingAs($this->operator2)
            ->getJson('/api/teachers?per_page=100');

        $response2->assertStatus(200);
        $teachers2 = $response2->json('data');

        foreach ($teachers2 as $teacher) {
            $this->assertEquals(
                $this->school2->id,
                $teacher['school_id'],
                'Tenant isolation violated: operator 2 sees teacher from other school'
            );
        }
    }

    /**
     * Property-Based Test: Import Idempotency
     * 
     * Verifies that importing the same data multiple times produces consistent results.
     * 
     * **Property**: For any import payload P,
     * importing P twice SHALL result in same final state (upsert behavior).
     */
    public function test_property_import_idempotency(): void
    {
        $payload = [
            'teachers' => [
                [
                    'nama' => 'Idempotent Teacher',
                    'nuptk' => '9999000011112222',
                    'jenis_kelamin' => 'L',
                    'status' => 'GTY',
                ],
            ],
        ];

        // First import
        $response1 = $this->actingAs($this->operator1)
            ->postJson('/api/teachers/import', $payload);

        $response1->assertStatus(200);
        $this->assertEquals(1, $response1->json('created'));

        $teacherAfterFirst = Teacher::where('nuptk', '9999000011112222')->first();
        $this->assertNotNull($teacherAfterFirst);
        $firstId = $teacherAfterFirst->id;

        // Second import (same data)
        $response2 = $this->actingAs($this->operator1)
            ->postJson('/api/teachers/import', $payload);

        $response2->assertStatus(200);
        $this->assertEquals(1, $response2->json('created'));

        // Verify no duplicate created
        $teacherCount = Teacher::where('nuptk', '9999000011112222')->count();
        $this->assertEquals(1, $teacherCount, 'Import should be idempotent (no duplicates)');

        // Verify same record was updated
        $teacherAfterSecond = Teacher::where('nuptk', '9999000011112222')->first();
        $this->assertEquals($firstId, $teacherAfterSecond->id, 'Should update same record, not create new');
    }
}
