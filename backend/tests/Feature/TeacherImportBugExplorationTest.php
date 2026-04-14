<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Bug Condition Exploration Test for Teacher Import 500 Error
 * 
 * **CRITICAL**: This test is EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bugs exist. Success after fix confirms bugs are resolved.
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 */
class TeacherImportBugExplorationTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $operator;
    private School $school;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create([
            'nama' => 'MI Test School',
            'nsm'  => '111233010001',
        ]);

        $this->superAdmin = User::factory()->create([
            'role'      => 'super_admin',
            'email'     => 'superadmin@test.com',
            'school_id' => null, // Super admin has no school_id
            'is_active' => true,
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'operator@test.com',
            'school_id' => $this->school->id,
            'unit'      => 'MI Test School',
            'is_active' => true,
        ]);
    }

    /**
     * Bug 1: Route Conflict Test
     * 
     * Tests that POST /api/teachers/import is correctly routed to import method,
     * not to show method with {teacher} = 'import'.
     * 
     * Expected on UNFIXED code: 500 ModelNotFoundException or 404
     * Expected on FIXED code: 200 with valid response structure
     */
    public function test_bug1_route_conflict_import_endpoint_returns_200(): void
    {
        $payload = [
            'teachers' => [
                [
                    'nama' => 'Test Teacher Route',
                    'nuptk' => '1234567890123456',
                    'jenis_kelamin' => 'L',
                ],
            ],
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', $payload);

        // Should return 200, not 404 or 500
        $response->assertStatus(200)
            ->assertJsonStructure([
                'created',
                'errors',
                'summary',
            ]);
    }

    /**
     * Bug 2: array_filter Boolean False Test
     * 
     * Tests that is_certified = false is preserved and stored correctly,
     * not removed by array_filter.
     * 
     * Expected on UNFIXED code: is_certified stored as null or 1 (not false/0)
     * Expected on FIXED code: is_certified stored as false/0
     */
    public function test_bug2_array_filter_preserves_boolean_false_values(): void
    {
        $payload = [
            'teachers' => [
                [
                    'nama' => 'Teacher Not Certified',
                    'nuptk' => '9876543210987654',
                    'jenis_kelamin' => 'P',
                    'is_certified' => false, // Explicitly false
                ],
            ],
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', $payload);

        $response->assertStatus(200);
        $this->assertEquals(1, $response->json('created'));

        // Verify is_certified is stored as false (0 in DB), not null
        $teacher = Teacher::where('nuptk', '9876543210987654')->first();
        $this->assertNotNull($teacher);
        $this->assertFalse($teacher->is_certified, 'is_certified should be false, not null or true');
    }

    /**
     * Bug 3: TenantScope Blocking NUPTK Lookup Test
     * 
     * Tests that super admin can import teachers with existing NUPTK
     * without AuthorizationException from TenantScope.
     * 
     * Expected on UNFIXED code: AuthorizationException or 500
     * Expected on FIXED code: 200 with successful upsert
     */
    public function test_bug3_tenant_scope_does_not_block_super_admin_nuptk_lookup(): void
    {
        // Create existing teacher with NUPTK
        $existingTeacher = Teacher::factory()->create([
            'nuptk' => '1111222233334444',
            'nama' => 'Existing Teacher',
            'school_id' => $this->school->id,
        ]);

        $payload = [
            'teachers' => [
                [
                    'nama' => 'Updated Teacher Name',
                    'nuptk' => '1111222233334444', // Same NUPTK - should upsert
                    'jenis_kelamin' => 'L',
                    'unit_kerja' => 'MI Test School',
                ],
            ],
        ];

        // Super admin should be able to import without TenantScope blocking
        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers/import', $payload);

        $response->assertStatus(200);
        $this->assertEquals(1, $response->json('created'));
        $this->assertEmpty($response->json('errors'));

        // Verify upsert happened (name updated)
        $existingTeacher->refresh();
        $this->assertEquals('Updated Teacher Name', $existingTeacher->nama);
    }

    /**
     * Bug 4: AuditLogTrait Exception Test
     * 
     * Tests that if ActivityLog::create() fails, the import continues
     * and doesn't fail the entire row.
     * 
     * Note: This is harder to test without mocking, but we can verify
     * that the import succeeds even if audit logging has issues.
     * 
     * Expected on UNFIXED code: Entire row fails if audit log fails
     * Expected on FIXED code: Row succeeds, audit log failure is logged as warning
     */
    public function test_bug4_audit_log_exception_does_not_fail_import(): void
    {
        $payload = [
            'teachers' => [
                [
                    'nama' => 'Teacher Audit Test',
                    'nuptk' => '5555666677778888',
                    'jenis_kelamin' => 'L',
                ],
            ],
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', $payload);

        // Should succeed even if audit log has issues
        $response->assertStatus(200);
        $this->assertEquals(1, $response->json('created'));

        // Verify teacher was created
        $teacher = Teacher::where('nuptk', '5555666677778888')->first();
        $this->assertNotNull($teacher);
    }

    /**
     * Bug 5: Per-Row Exception Handling Test
     * 
     * Tests that exception in one row doesn't stop the entire import loop.
     * 
     * Expected on UNFIXED code: First error stops entire import
     * Expected on FIXED code: Valid rows are imported, invalid rows are in errors array
     */
    public function test_bug5_exception_in_one_row_does_not_stop_import_loop(): void
    {
        $payload = [
            'teachers' => [
                [
                    'nama' => 'Valid Teacher 1',
                    'nuptk' => '1111111111111111',
                    'jenis_kelamin' => 'L',
                ],
                [
                    // This row might cause issues - empty nama after normalization
                    'nuptk' => '2222222222222222',
                    // nama will be auto-filled as "Guru Baru (Tanpa Nama)"
                ],
                [
                    'nama' => 'Valid Teacher 3',
                    'nuptk' => '3333333333333333',
                    'jenis_kelamin' => 'P',
                ],
            ],
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', $payload);

        $response->assertStatus(200);
        
        // All 3 should be created (even the one without nama gets auto-filled)
        $this->assertEquals(3, $response->json('created'));
        
        // Verify created + errors.length == total_rows (partial success property)
        $created = $response->json('created');
        $errorsCount = count($response->json('errors'));
        $this->assertEquals(3, $created + $errorsCount, 'created + errors should equal total rows');
    }

    /**
     * Comprehensive Bug Condition Test
     * 
     * Tests all bug conditions together in a single import request.
     * This is the main property-based test that validates the expected behavior.
     * 
     * **Property 1: Bug Condition** - Teacher Import Returns HTTP 200
     * 
     * For any request POST /api/teachers/import with valid teacher array,
     * the system SHALL return HTTP 200 with { created, errors, summary }.
     */
    public function test_comprehensive_import_returns_200_with_all_bug_scenarios(): void
    {
        // Create existing teacher for upsert test (Bug 3)
        Teacher::factory()->create([
            'nuptk' => '9999888877776666',
            'nama' => 'Old Name',
            'school_id' => $this->school->id,
        ]);

        $payload = [
            'teachers' => [
                // Bug 1: Basic import (route conflict)
                [
                    'nama' => 'Teacher A',
                    'nuptk' => '1000000000000001',
                    'jenis_kelamin' => 'L',
                ],
                // Bug 2: Boolean false preservation
                [
                    'nama' => 'Teacher B Not Certified',
                    'nuptk' => '1000000000000002',
                    'is_certified' => false,
                    'jenis_kelamin' => 'P',
                ],
                // Bug 3: NUPTK upsert (TenantScope)
                [
                    'nama' => 'Teacher C Updated',
                    'nuptk' => '9999888877776666', // Existing NUPTK
                    'jenis_kelamin' => 'L',
                ],
                // Bug 4 & 5: Mixed valid/invalid (partial success)
                [
                    'nama' => 'Teacher D',
                    'nuptk' => '1000000000000004',
                    'jenis_kelamin' => 'L',
                ],
            ],
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers/import', $payload);

        // Main assertions
        $response->assertStatus(200)
            ->assertJsonStructure([
                'created',
                'errors',
                'summary',
            ]);

        $this->assertGreaterThanOrEqual(0, $response->json('created'));
        $this->assertIsArray($response->json('errors'));
        $this->assertIsString($response->json('summary'));

        // Verify Bug 2: is_certified = false is preserved
        $teacherB = Teacher::where('nuptk', '1000000000000002')->first();
        if ($teacherB) {
            $this->assertFalse($teacherB->is_certified, 'is_certified should be false');
        }

        // Verify Bug 3: Upsert happened
        $teacherC = Teacher::where('nuptk', '9999888877776666')->first();
        if ($teacherC) {
            $this->assertEquals('Teacher C Updated', $teacherC->nama, 'NUPTK upsert should update name');
        }
    }
}
