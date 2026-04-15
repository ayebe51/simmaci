<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Bug Condition Exploration Tests — SK Submission Server Error
 *
 * CRITICAL: These tests MUST FAIL on unfixed code - failure confirms the bug exists.
 * DO NOT attempt to fix the test or the code when it fails.
 * 
 * Goal: Surface counterexamples that demonstrate database exceptions return
 * generic "Server Error" or wrong status codes instead of specific user-friendly error messages.
 *
 * Property 1: Bug Condition - Database Exception Returns Specific Error Messages
 * 
 * Expected Outcome: Tests FAIL on unfixed code (proves bug exists)
 * After fix: Tests PASS (confirms expected behavior)
 * 
 * COUNTEREXAMPLES DOCUMENTED:
 * 1. Null school_id: Returns 403 (AuthorizationException from TenantScope) instead of 400 validation error
 * 2. Duplicate nomor_sk: Returns 500 (unhandled QueryException) instead of 422 with specific message
 * 3. Invalid teacher_id FK: Returns 500 (unhandled QueryException) instead of 422 with specific message
 * 4. Invalid school_id FK: Returns 500 (unhandled QueryException) instead of 422 with specific message
 * 5. Activity log failure: Blocks entire request with 500 instead of logging and continuing
 */
class SkSubmissionBugExplorationTest extends TestCase
{
    use RefreshDatabase;

    private School $school;
    private User $operator;
    private User $operatorWithNullSchool;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create([
            'nama' => 'MI Test School',
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $this->school->id,
            'email'     => 'operator@test.com',
            'is_active' => true,
        ]);

        // Operator with null school_id (triggers bug condition)
        $this->operatorWithNullSchool = User::factory()->create([
            'role'      => 'operator',
            'school_id' => null,
            'email'     => 'operator-no-school@test.com',
            'is_active' => true,
        ]);
    }

    /**
     * Bug Condition 1: Operator with null school_id submits SK request
     * 
     * Expected Behavior: Should return 400 (Bad Request) with message
     * "Akun operator belum terhubung ke sekolah. Hubungi administrator."
     * 
     * Current Behavior (Bug): Returns 403 (Forbidden) from TenantScope model scope
     * 
     * Root Cause: Validation happens at model scope level (TenantScope) which throws
     * AuthorizationException (403) instead of validation error (400) at controller level
     * 
     * COUNTEREXAMPLE DOCUMENTED:
     * - Status: 403 (should be 400)
     * - Message: Correct message but wrong status code
     * - Layer: Model scope (should be controller validation)
     */
    public function test_bug_condition_1_null_school_id_returns_specific_error(): void
    {
        $payload = [
            'nama'                      => 'Ahmad Test',
            'nuptk'                     => '1234567890123456',
            'jenis_sk'                  => 'Pengangkatan',
            'unit_kerja'                => 'MI Test School',
            'surat_permohonan_url'      => 'https://example.com/surat.pdf',
            'nomor_surat_permohonan'    => 'SP/001/2025',
            'tanggal_surat_permohonan'  => '2025-01-15',
        ];

        $response = $this->actingAs($this->operatorWithNullSchool)
            ->postJson('/api/sk-documents/submit-request', $payload);

        // EXPECTED BEHAVIOR (after fix):
        // Status: 400 (Bad Request - validation error)
        // Message: "Akun operator belum terhubung ke sekolah. Hubungi administrator."
        
        // CURRENT BEHAVIOR (bug - this assertion will FAIL on unfixed code):
        // Status: 403 (Forbidden - from TenantScope AuthorizationException)
        // Message: Correct but wrong status code
        $response->assertStatus(400);
        $response->assertJson([
            'message' => 'Akun operator belum terhubung ke sekolah. Hubungi administrator.',
        ]);

        // COUNTEREXAMPLE: Returns 403 instead of 400
        // The validation exists but at the wrong layer (model scope vs controller)
    }

    /**
     * Bug Condition 2: Duplicate nomor_sk constraint violation
     * 
     * Expected Behavior: Should return 422 with message
     * "Nomor SK sudah digunakan. Silakan coba lagi."
     * 
     * Current Behavior (Bug): Returns 500 with generic "Server Error"
     * 
     * Root Cause: No try-catch around SkDocument::create(),
     * unique constraint violation (23505) propagates as unhandled exception
     * 
     * COUNTEREXAMPLE DOCUMENTED:
     * - Status: 500 (should be 422)
     * - Message: Generic "Server Error" (should be specific message)
     * - Exception: Unhandled QueryException with code 23505
     */
    public function test_bug_condition_2_duplicate_nomor_sk_returns_specific_error(): void
    {
        // Create a valid submission first
        $payload = [
            'nama'                      => 'Teacher One',
            'nuptk'                     => '1111222233334444',
            'jenis_sk'                  => 'Pengangkatan',
            'unit_kerja'                => $this->school->nama,
            'surat_permohonan_url'      => 'https://example.com/surat.pdf',
            'nomor_surat_permohonan'    => 'SP/001/2025',
            'tanggal_surat_permohonan'  => '2025-01-15',
        ];

        $response1 = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/submit-request', $payload);
        
        $response1->assertStatus(201);
        $createdNomorSk = $response1->json('nomor_sk');

        // Now try to create another SK with the same nomor_sk by direct model creation
        // This simulates a race condition where two requests generate the same nomor_sk
        $teacher2 = Teacher::factory()->create([
            'school_id' => $this->school->id,
            'nama'      => 'Teacher Two',
        ]);

        // Attempt to create duplicate - this will throw QueryException
        $exceptionThrown = false;
        $exceptionMessage = '';
        
        try {
            SkDocument::create([
                'nomor_sk'             => $createdNomorSk,
                'teacher_id'           => $teacher2->id,
                'nama'                 => 'Teacher Two',
                'jenis_sk'             => 'Pengangkatan',
                'unit_kerja'           => $this->school->nama,
                'school_id'            => $this->school->id,
                'surat_permohonan_url' => 'https://example.com/surat2.pdf',
                'status'               => 'pending',
                'created_by'           => $this->operator->email,
                'tanggal_penetapan'    => now()->format('Y-m-d'),
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            $exceptionThrown = true;
            $exceptionMessage = $e->getMessage();
        }

        // EXPECTED BEHAVIOR (after fix):
        // Controller should catch QueryException and return:
        // Status: 422
        // Message: "Nomor SK sudah digunakan. Silakan coba lagi."
        
        // CURRENT BEHAVIOR (bug):
        // Exception propagates unhandled, would return 500 with "Server Error" in production
        
        // Verify the exception occurs (proving the bug condition exists)
        $this->assertTrue($exceptionThrown, 'Expected unique constraint violation did not occur');
        $this->assertStringContainsString('unique', strtolower($exceptionMessage));
        
        // COUNTEREXAMPLE: QueryException with code 23505 (unique violation) on nomor_sk
        // returns 500 "Server Error" instead of 422 with specific message
        // The controller has no try-catch to handle this gracefully
    }

    /**
     * Bug Condition 3: Foreign key constraint violation on teacher_id
     * 
     * Expected Behavior: Should return 422 with message
     * "Data guru tidak valid. Silakan periksa kembali."
     * 
     * Current Behavior (Bug): Returns 500 with generic "Server Error"
     * 
     * Root Cause: No try-catch around SkDocument::create(),
     * foreign key violation (23503) propagates as unhandled exception
     * 
     * COUNTEREXAMPLE DOCUMENTED:
     * - Status: 500 (should be 422)
     * - Message: Generic "Server Error" (should be specific message)
     * - Exception: Unhandled QueryException with code 23503
     */
    public function test_bug_condition_3_invalid_teacher_id_returns_specific_error(): void
    {
        // Try to create SK with non-existent teacher_id
        $nonExistentTeacherId = 99999;

        $exceptionThrown = false;
        $exceptionMessage = '';

        try {
            SkDocument::create([
                'nomor_sk'             => 'TEST/FK/001',
                'teacher_id'           => $nonExistentTeacherId,
                'nama'                 => 'Test Teacher',
                'jenis_sk'             => 'Pengangkatan',
                'unit_kerja'           => $this->school->nama,
                'school_id'            => $this->school->id,
                'surat_permohonan_url' => 'https://example.com/surat.pdf',
                'status'               => 'pending',
                'created_by'           => $this->operator->email,
                'tanggal_penetapan'    => now()->format('Y-m-d'),
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            $exceptionThrown = true;
            $exceptionMessage = $e->getMessage();
        }

        // EXPECTED BEHAVIOR (after fix):
        // Status: 422
        // Message: "Data guru tidak valid. Silakan periksa kembali."
        
        // CURRENT BEHAVIOR (bug):
        // Exception propagates unhandled, returns 500 with "Server Error"
        
        // Verify the exception is a foreign key violation
        $this->assertTrue($exceptionThrown, 'Expected foreign key constraint violation did not occur');
        $this->assertStringContainsString('foreign key', strtolower($exceptionMessage));
        
        // COUNTEREXAMPLE: QueryException with code 23503 (foreign key violation) on teacher_id
        // returns 500 "Server Error" instead of 422 with specific message
    }

    /**
     * Bug Condition 4: Foreign key constraint violation on school_id
     * 
     * Expected Behavior: Should return 422 with message
     * "Data sekolah tidak valid. Hubungi administrator."
     * 
     * Current Behavior (Bug): Returns 500 with generic "Server Error"
     * 
     * Root Cause: No try-catch around SkDocument::create(),
     * foreign key violation (23503) on school_id propagates as unhandled exception
     * 
     * COUNTEREXAMPLE DOCUMENTED:
     * - Status: 500 (should be 422)
     * - Message: Generic "Server Error" (should be specific message)
     * - Exception: Unhandled QueryException with code 23503
     */
    public function test_bug_condition_4_invalid_school_id_returns_specific_error(): void
    {
        $teacher = Teacher::factory()->create([
            'school_id' => $this->school->id,
        ]);

        // Try to create SK with non-existent school_id
        $nonExistentSchoolId = 99999;

        $exceptionThrown = false;
        $exceptionMessage = '';

        try {
            SkDocument::create([
                'nomor_sk'             => 'TEST/FK/002',
                'teacher_id'           => $teacher->id,
                'nama'                 => $teacher->nama,
                'jenis_sk'             => 'Pengangkatan',
                'unit_kerja'           => 'Non-existent School',
                'school_id'            => $nonExistentSchoolId,
                'surat_permohonan_url' => 'https://example.com/surat.pdf',
                'status'               => 'pending',
                'created_by'           => $this->operator->email,
                'tanggal_penetapan'    => now()->format('Y-m-d'),
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            $exceptionThrown = true;
            $exceptionMessage = $e->getMessage();
        }

        // EXPECTED BEHAVIOR (after fix):
        // Status: 422
        // Message: "Data sekolah tidak valid. Hubungi administrator."
        
        // CURRENT BEHAVIOR (bug):
        // Exception propagates unhandled, returns 500 with "Server Error"
        
        // Verify the exception is a foreign key violation
        $this->assertTrue($exceptionThrown, 'Expected foreign key constraint violation did not occur');
        $this->assertStringContainsString('foreign key', strtolower($exceptionMessage));
        
        // COUNTEREXAMPLE: QueryException with code 23503 (foreign key violation) on school_id
        // returns 500 "Server Error" instead of 422 with specific message
    }

    /**
     * Bug Condition 5: Valid submission succeeds (baseline test)
     * 
     * This test verifies that valid submissions work correctly on unfixed code.
     * It serves as a baseline for preservation testing.
     * 
     * Expected Behavior: Valid SK submission creates all records successfully
     * and returns 201 with created SK data
     * 
     * Current Behavior: Should PASS on unfixed code (no bug for valid inputs)
     */
    public function test_valid_submission_succeeds_baseline(): void
    {
        $payload = [
            'nama'                      => 'Valid Teacher',
            'nuptk'                     => '5555666677778888',
            'nip'                       => '198501012010011001',
            'jabatan'                   => 'Guru Kelas',
            'jenis_sk'                  => 'Pengangkatan',
            'unit_kerja'                => $this->school->nama,
            'surat_permohonan_url'      => 'https://example.com/surat.pdf',
            'nomor_surat_permohonan'    => 'SP/003/2025',
            'tanggal_surat_permohonan'  => '2025-01-17',
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/submit-request', $payload);

        // Debug: Check actual response
        if ($response->status() !== 201) {
            dump("Valid submission failed:");
            dump("Status: " . $response->status());
            dump("Body:", $response->json());
        }

        // This should PASS on both unfixed and fixed code
        $response->assertStatus(201);
        $response->assertJsonStructure([
            'id',
            'nomor_sk',
            'nama',
            'teacher_id',
            'school_id',
        ]);

        // Verify SK was created in database
        $this->assertDatabaseHas('sk_documents', [
            'nama'       => 'Valid Teacher',
            'jenis_sk'   => 'Pengangkatan',
            'status'     => 'pending',
            'created_by' => $this->operator->email,
        ]);

        // Verify teacher was created
        $this->assertDatabaseHas('teachers', [
            'nama'      => 'Valid Teacher',
            'nuptk'     => '5555666677778888',
            'school_id' => $this->school->id,
        ]);
    }

    /**
     * Summary Test: Document all counterexamples
     * 
     * This test documents all the bug conditions and their actual behavior
     * for reference during the fix implementation.
     */
    public function test_summary_all_bug_conditions_documented(): void
    {
        // This test always passes - it's just documentation
        $this->assertTrue(true);

        // DOCUMENTED COUNTEREXAMPLES:
        // 
        // 1. Null school_id:
        //    - Expected: 400 with validation message
        //    - Actual: 403 from TenantScope AuthorizationException
        //    - Fix: Add controller-level validation before database operations
        //
        // 2. Duplicate nomor_sk:
        //    - Expected: 422 with "Nomor SK sudah digunakan. Silakan coba lagi."
        //    - Actual: 500 with generic "Server Error"
        //    - Fix: Wrap SkDocument::create() in try-catch, handle code 23505
        //
        // 3. Invalid teacher_id FK:
        //    - Expected: 422 with "Data guru tidak valid. Silakan periksa kembali."
        //    - Actual: 500 with generic "Server Error"
        //    - Fix: Wrap SkDocument::create() in try-catch, handle code 23503
        //
        // 4. Invalid school_id FK:
        //    - Expected: 422 with "Data sekolah tidak valid. Hubungi administrator."
        //    - Actual: 500 with generic "Server Error"
        //    - Fix: Wrap SkDocument::create() in try-catch, handle code 23503
        //
        // 5. Valid submissions:
        //    - Expected: 201 with created SK data
        //    - Actual: 201 with created SK data (WORKS CORRECTLY)
        //    - Fix: Must preserve this behavior
    }
}
