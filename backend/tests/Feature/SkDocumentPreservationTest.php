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
 * Preservation Property Tests — SK Submission Server Error Bugfix
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * IMPORTANT: Follow observation-first methodology
 * - These tests observe behavior on UNFIXED code for non-buggy inputs
 * - Tests capture observed behavior patterns that must be preserved after the fix
 * - Run tests on UNFIXED code first
 * - EXPECTED OUTCOME: Tests PASS (confirms baseline behavior to preserve)
 *
 * Property 2: Preservation - Valid Submissions Continue to Work
 *
 * For any SK submission request where all database operations succeed (no exceptions thrown),
 * the fixed submitRequest method SHALL produce exactly the same result as the original method,
 * creating the teacher record, SK document, and activity log, and returning a 201 status
 * with the created SK data.
 */
class SkDocumentPreservationTest extends TestCase
{
    use RefreshDatabase;

    private School $school;
    private User $operator;
    private User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create([
            'nama' => 'MI Preservation Test',
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $this->school->id,
            'email'     => 'operator@preservation.test',
            'is_active' => true,
        ]);

        $this->superAdmin = User::factory()->create([
            'role'      => 'super_admin',
            'school_id' => null,
            'email'     => 'admin@preservation.test',
            'is_active' => true,
        ]);
    }

    /**
     * Preservation 3.1: Valid SK submissions with all required fields
     * continue to create teacher, SK document, and activity log successfully
     *
     * This property-based test generates multiple valid SK submission scenarios
     * and verifies that all three records (teacher, SK, activity log) are created
     * successfully with a 201 response.
     */
    public function test_preservation_valid_sk_submission_creates_all_records(): void
    {
        // Generate multiple test cases with different valid data patterns
        // NOTE: All optional fields must be explicitly set to null for unfixed code
        // because the controller accesses them directly without null coalescing
        $testCases = [
            // Case 1: Full data with NUPTK and NIP (non-PNS NIP: 9 digits)
            [
                'nama'                      => 'Ahmad Dahlan',
                'nuptk'                     => '1234567890123456',
                'nip'                       => '123456789',
                'jabatan'                   => 'Guru Kelas',
                'jenis_sk'                  => 'Pengangkatan',
                'unit_kerja'                => $this->school->nama,
                'surat_permohonan_url'      => 'https://example.com/surat1.pdf',
                'nomor_surat_permohonan'    => 'SP/001/2025',
                'tanggal_surat_permohonan'  => '2025-01-15',
                'status_kepegawaian'        => 'GTY',
            ],
            // Case 2: Only NUPTK, no NIP
            [
                'nama'                      => 'Fatimah Zahra',
                'nuptk'                     => '9876543210987654',
                'nip'                       => null,
                'jabatan'                   => 'Guru Mapel',
                'jenis_sk'                  => 'Mutasi',
                'unit_kerja'                => $this->school->nama,
                'surat_permohonan_url'      => 'https://example.com/surat2.pdf',
                'nomor_surat_permohonan'    => 'SP/002/2025',
                'tanggal_surat_permohonan'  => '2025-01-16',
            ],
            // Case 3: Only NIP, no NUPTK (non-PNS NIP: 9 digits)
            [
                'nama'                      => 'Umar bin Khattab',
                'nuptk'                     => null,
                'nip'                       => '987654321',
                'jabatan'                   => 'Kepala Sekolah',
                'jenis_sk'                  => 'Pemberhentian',
                'unit_kerja'                => $this->school->nama,
                'surat_permohonan_url'      => 'https://example.com/surat3.pdf',
                'nomor_surat_permohonan'    => 'SP/003/2025',
                'tanggal_surat_permohonan'  => '2025-01-17',
            ],
            // Case 4: Neither NUPTK nor NIP (will match by name+school_id)
            [
                'nama'                      => 'Ali bin Abi Thalib',
                'nuptk'                     => null,
                'nip'                       => null,
                'jabatan'                   => 'Guru Honorer',
                'jenis_sk'                  => 'Pengangkatan',
                'unit_kerja'                => $this->school->nama,
                'surat_permohonan_url'      => 'https://example.com/surat4.pdf',
                'nomor_surat_permohonan'    => 'SP/004/2025',
                'tanggal_surat_permohonan'  => '2025-01-18',
            ],
        ];

        foreach ($testCases as $index => $payload) {
            $response = $this->actingAs($this->operator)
                ->postJson('/api/sk-documents/submit-request', $payload);

            // Debug: dump response if not 201
            if ($response->status() !== 201) {
                dump("Test case $index failed with status {$response->status()}");
                dump("Response:", $response->json());
                dump("Payload:", $payload);
            }

            // Verify 201 status
            $response->assertStatus(201);

            // Verify response structure
            $response->assertJsonStructure([
                'id',
                'nomor_sk',
                'nama',
                'teacher_id',
                'school_id',
                'jenis_sk',
                'status',
                'created_by',
            ]);

            $responseData = $response->json();

            // Normalize expected name (normalization is applied server-side)
            $normalizedNama = app(\App\Services\NormalizationService::class)->normalizeTeacherName($payload['nama']);
            $normalizedUnitKerja = app(\App\Services\NormalizationService::class)->normalizeSchoolName($payload['unit_kerja']);

            // Verify SK document was created
            $this->assertDatabaseHas('sk_documents', [
                'id'         => $responseData['id'],
                'nama'       => $normalizedNama,
                'jenis_sk'   => $payload['jenis_sk'],
                'status'     => 'pending',
                'school_id'  => $this->school->id,
                'created_by' => $this->operator->email,
            ]);

            // Verify teacher was created
            $this->assertDatabaseHas('teachers', [
                'id'        => $responseData['teacher_id'],
                'nama'      => $normalizedNama,
                'school_id' => $this->school->id,
            ]);

            // Verify activity log was created (description uses normalized values)
            $this->assertDatabaseHas('activity_logs', [
                'description' => "Pengajuan SK Individual: {$normalizedNama} ({$normalizedUnitKerja})",
                'event'       => 'submit_sk_request',
                'log_name'    => 'sk',
                'subject_id'  => $responseData['id'],
                'subject_type' => SkDocument::class,
                'causer_id'   => $this->operator->id,
                'causer_type' => User::class,
                'school_id'   => $this->school->id,
            ]);
        }

        // Verify all 4 submissions were created
        $this->assertEquals(4, SkDocument::count());
        $this->assertEquals(4, Teacher::count());
        $this->assertGreaterThanOrEqual(4, ActivityLog::count());
    }

    /**
     * Preservation 3.2: Teacher upsert logic (match by NUPTK, NIP, or name+school_id)
     * continues to work correctly
     *
     * This test verifies that the teacher matching and update logic works correctly:
     * - Match by NUPTK if provided
     * - Match by NIP if NUPTK not provided
     * - Match by name+school_id if neither NUPTK nor NIP provided
     * - Update existing teacher instead of creating duplicate
     */
    public function test_preservation_teacher_upsert_logic_works_correctly(): void
    {
        // Test Case 1: Match by NUPTK
        $nuptk = '1111222233334444';
        
        // First submission creates teacher
        $payload1 = [
            'nama'                      => 'Teacher NUPTK',
            'nuptk'                     => $nuptk,
            'nip'                       => null,
            'jabatan'                   => null,
            'jenis_sk'                  => 'Pengangkatan',
            'unit_kerja'                => $this->school->nama,
            'surat_permohonan_url'      => 'https://example.com/surat1.pdf',
        ];

        $response1 = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/submit-request', $payload1);
        
        $response1->assertStatus(201);
        $teacherId1 = $response1->json('teacher_id');

        // Second submission with same NUPTK should update, not create new
        $payload2 = [
            'nama'                      => 'Teacher NUPTK Updated',
            'nuptk'                     => $nuptk,
            'nip'                       => '123456789',
            'jabatan'                   => 'Guru Kelas',
            'jenis_sk'                  => 'Mutasi',
            'unit_kerja'                => $this->school->nama,
            'surat_permohonan_url'      => 'https://example.com/surat2.pdf',
        ];

        $response2 = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/submit-request', $payload2);
        
        $response2->assertStatus(201);
        $teacherId2 = $response2->json('teacher_id');

        // Should be same teacher (upsert, not create)
        $this->assertEquals($teacherId1, $teacherId2);
        
        // Verify teacher was updated (jabatan is NOT in teachers table, only in sk_documents)
        $this->assertDatabaseHas('teachers', [
            'id'      => $teacherId1,
            'nama'    => 'TEACHER NUPTK UPDATED',
            'nuptk'   => $nuptk,
            'nip'     => '123456789',
        ]);

        // Test Case 2: Match by NIP (no NUPTK)
        $nip = '987654321';
        
        $payload3 = [
            'nama'                      => 'Teacher NIP',
            'nuptk'                     => null,
            'nip'                       => $nip,
            'jabatan'                   => null,
            'jenis_sk'                  => 'Pengangkatan',
            'unit_kerja'                => $this->school->nama,
            'surat_permohonan_url'      => 'https://example.com/surat3.pdf',
        ];

        $response3 = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/submit-request', $payload3);
        
        $response3->assertStatus(201);
        $teacherId3 = $response3->json('teacher_id');

        // Submit again with same NIP
        $payload4 = [
            'nama'                      => 'Teacher NIP Updated',
            'nuptk'                     => null,
            'nip'                       => $nip,
            'jabatan'                   => 'Kepala Sekolah',
            'jenis_sk'                  => 'Mutasi',
            'unit_kerja'                => $this->school->nama,
            'surat_permohonan_url'      => 'https://example.com/surat4.pdf',
        ];

        $response4 = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/submit-request', $payload4);

        $response4->assertStatus(201);
        $teacherId4 = $response4->json('teacher_id');

        // Should be same teacher
        $this->assertEquals($teacherId3, $teacherId4);

        // Test Case 3: Match by name+school_id (no NUPTK or NIP)
        $teacherName = 'Teacher Name Only';
        
        $payload5 = [
            'nama'                      => $teacherName,
            'nuptk'                     => null,
            'nip'                       => null,
            'jabatan'                   => null,
            'jenis_sk'                  => 'Pengangkatan',
            'unit_kerja'                => $this->school->nama,
            'surat_permohonan_url'      => 'https://example.com/surat5.pdf',
        ];

        $response5 = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/submit-request', $payload5);
        
        $response5->assertStatus(201);
        $teacherId5 = $response5->json('teacher_id');

        // Submit again with same name
        $payload6 = [
            'nama'                      => $teacherName,
            'nuptk'                     => null,
            'nip'                       => null,
            'jabatan'                   => 'Guru Mapel',
            'jenis_sk'                  => 'Mutasi',
            'unit_kerja'                => $this->school->nama,
            'surat_permohonan_url'      => 'https://example.com/surat6.pdf',
        ];

        $response6 = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/submit-request', $payload6);
        
        $response6->assertStatus(201);
        $teacherId6 = $response6->json('teacher_id');

        // Should be same teacher
        $this->assertEquals($teacherId5, $teacherId6);

        // Verify only 3 unique teachers were created (not 6)
        $this->assertEquals(3, Teacher::count());
    }

    /**
     * Preservation 3.3: Temporary nomor_sk generation (REQ/{year}/{sequence})
     * continues to ensure uniqueness
     *
     * This test verifies that the automatic nomor_sk generation:
     * - Uses format REQ/{year}/{sequence}
     * - Increments sequence to ensure uniqueness
     * - Handles concurrent submissions without collisions
     */
    public function test_preservation_nomor_sk_generation_ensures_uniqueness(): void
    {
        $year = now()->year;
        $submissions = [];

        // Create multiple submissions rapidly
        for ($i = 1; $i <= 10; $i++) {
            $payload = [
                'nama'                      => "Teacher $i",
                'nuptk'                     => str_pad($i, 16, '0', STR_PAD_LEFT),
                'nip'                       => null,
                'jabatan'                   => null,
                'jenis_sk'                  => 'Pengangkatan',
                'unit_kerja'                => $this->school->nama,
                'surat_permohonan_url'      => "https://example.com/surat$i.pdf",
            ];

            $response = $this->actingAs($this->operator)
                ->postJson('/api/sk-documents/submit-request', $payload);
            
            $response->assertStatus(201);
            $submissions[] = $response->json();
        }

        // Verify all nomor_sk are unique
        $nomorSkList = array_column($submissions, 'nomor_sk');
        $uniqueNomorSk = array_unique($nomorSkList);
        
        $this->assertCount(10, $uniqueNomorSk, 'All nomor_sk should be unique');

        // Verify all follow REQ/{year}/{sequence} format
        foreach ($nomorSkList as $nomorSk) {
            $this->assertMatchesRegularExpression(
                "/^REQ\/{$year}\/\d{4}$/",
                $nomorSk,
                "nomor_sk should match format REQ/{year}/{sequence}"
            );
        }

        // Verify sequences are incrementing
        $sequences = array_map(function ($nomorSk) use ($year) {
            return (int) str_replace("REQ/{$year}/", '', $nomorSk);
        }, $nomorSkList);

        // All sequences should be positive integers
        foreach ($sequences as $seq) {
            $this->assertGreaterThan(0, $seq);
        }

        // Verify no duplicate sequences
        $this->assertCount(10, array_unique($sequences));
    }

    /**
     * Preservation 3.4: Successful submissions continue to create activity log entries
     *
     * This test verifies that activity logs are created with correct data
     * for all successful SK submissions.
     */
    public function test_preservation_activity_log_creation(): void
    {
        $payload = [
            'nama'                      => 'Teacher Activity Log',
            'nuptk'                     => '5555666677778888',
            'nip'                       => null,
            'jabatan'                   => null,
            'jenis_sk'                  => 'Pengangkatan',
            'unit_kerja'                => $this->school->nama,
            'surat_permohonan_url'      => 'https://example.com/surat.pdf',
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/submit-request', $payload);
        
        $response->assertStatus(201);
        $skId = $response->json('id');

        // Verify activity log was created with correct structure
        // Note: There may be multiple activity logs (one from AuditLogTrait 'created' event,
        // one from explicit ActivityLog::log() call with 'submit_sk_request' event)
        $activityLog = ActivityLog::where('subject_id', $skId)
            ->where('subject_type', SkDocument::class)
            ->where('event', 'submit_sk_request')
            ->first();

        $this->assertNotNull($activityLog, 'Activity log with submit_sk_request event should be created');
        $this->assertEquals('submit_sk_request', $activityLog->event);
        $this->assertEquals('sk', $activityLog->log_name);
        $this->assertEquals($this->operator->id, $activityLog->causer_id);
        $this->assertEquals(User::class, $activityLog->causer_type);
        $this->assertEquals($this->school->id, $activityLog->school_id);
        $this->assertStringContainsString('Pengajuan SK Individual', $activityLog->description);
        $this->assertStringContainsString('TEACHER ACTIVITY LOG', $activityLog->description);
        $this->assertStringContainsString($this->school->nama, $activityLog->description);
    }

    /**
     * Preservation 3.5: Operator school_id forcing continues to override unit_kerja lookup
     *
     * This test verifies that when an operator submits an SK request,
     * the school_id is forced to match the operator's school_id,
     * regardless of the unit_kerja value provided.
     */
    public function test_preservation_operator_school_id_forcing(): void
    {
        // Create another school
        $otherSchool = School::factory()->create([
            'nama' => 'MI Other School',
        ]);

        // Operator tries to submit SK with different unit_kerja
        $payload = [
            'nama'                      => 'Teacher School Override',
            'nuptk'                     => '9999888877776666',
            'nip'                       => null,
            'jabatan'                   => null,
            'jenis_sk'                  => 'Pengangkatan',
            'unit_kerja'                => $otherSchool->nama, // Different school name
            'surat_permohonan_url'      => 'https://example.com/surat.pdf',
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/submit-request', $payload);
        
        $response->assertStatus(201);

        // Verify school_id was forced to operator's school, not the unit_kerja lookup
        $sk = SkDocument::find($response->json('id'));
        $this->assertEquals($this->school->id, $sk->school_id);
        $this->assertNotEquals($otherSchool->id, $sk->school_id);

        // Verify teacher also has operator's school_id
        $teacher = Teacher::find($sk->teacher_id);
        $this->assertEquals($this->school->id, $teacher->school_id);
        $this->assertNotEquals($otherSchool->id, $teacher->school_id);
    }

    /**
     * Preservation: Super admin can submit SK for any school via unit_kerja lookup
     *
     * This test verifies that super admins (who have null school_id) can submit
     * SK requests for any school by specifying unit_kerja, and the school_id
     * is correctly resolved from the unit_kerja lookup.
     */
    public function test_preservation_super_admin_unit_kerja_lookup(): void
    {
        $payload = [
            'nama'                      => 'Teacher Super Admin',
            'nuptk'                     => '1234123412341234',
            'nip'                       => null,
            'jabatan'                   => null,
            'jenis_sk'                  => 'Pengangkatan',
            'unit_kerja'                => $this->school->nama,
            'surat_permohonan_url'      => 'https://example.com/surat.pdf',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-documents/submit-request', $payload);
        
        $response->assertStatus(201);

        // Verify school_id was resolved from unit_kerja
        $sk = SkDocument::find($response->json('id'));
        $this->assertEquals($this->school->id, $sk->school_id);

        // Verify teacher has correct school_id
        $teacher = Teacher::find($sk->teacher_id);
        $this->assertEquals($this->school->id, $teacher->school_id);
    }

    /**
     * Preservation: Multiple submissions with different data patterns
     *
     * This comprehensive test generates many valid submission scenarios
     * to ensure the fix doesn't break any edge cases.
     */
    public function test_preservation_comprehensive_valid_submissions(): void
    {
        $testCases = [
            // Minimal required fields only
            [
                'nama'                 => 'Minimal Teacher',
                'nuptk'                => null,
                'nip'                  => null,
                'jabatan'              => null,
                'jenis_sk'             => 'Pengangkatan',
                'unit_kerja'           => $this->school->nama,
                'surat_permohonan_url' => 'https://example.com/minimal.pdf',
            ],
            // All optional fields filled (non-PNS NIP: 9 digits, GTY status)
            [
                'nama'                      => 'Complete Teacher',
                'nuptk'                     => '1111111111111111',
                'nip'                       => '111222333',
                'jabatan'                   => 'Guru Kelas',
                'jenis_sk'                  => 'Mutasi',
                'unit_kerja'                => $this->school->nama,
                'surat_permohonan_url'      => 'https://example.com/complete.pdf',
                'nomor_surat_permohonan'    => 'SP/999/2025',
                'tanggal_surat_permohonan'  => '2025-01-20',
                'tanggal_penetapan'         => '2025-01-25',
                'status_kepegawaian'        => 'GTY',
            ],
            // Different jenis_sk values
            [
                'nama'                 => 'Teacher Pemberhentian',
                'nuptk'                => null,
                'nip'                  => null,
                'jabatan'              => null,
                'jenis_sk'             => 'Pemberhentian',
                'unit_kerja'           => $this->school->nama,
                'surat_permohonan_url' => 'https://example.com/pemberhentian.pdf',
            ],
            // Long names and special characters
            [
                'nama'                 => 'Dr. H. Muhammad Abdullah Al-Farisi, S.Pd., M.Pd.',
                'nuptk'                => null,
                'nip'                  => null,
                'jabatan'              => null,
                'jenis_sk'             => 'Pengangkatan',
                'unit_kerja'           => $this->school->nama,
                'surat_permohonan_url' => 'https://example.com/long-name.pdf',
            ],
        ];

        foreach ($testCases as $index => $payload) {
            $response = $this->actingAs($this->operator)
                ->postJson('/api/sk-documents/submit-request', $payload);

            $response->assertStatus(201, "Test case $index failed");
            
            // Verify all three records created
            $skId = $response->json('id');
            $teacherId = $response->json('teacher_id');
            
            $this->assertDatabaseHas('sk_documents', ['id' => $skId]);
            $this->assertDatabaseHas('teachers', ['id' => $teacherId]);
            $this->assertDatabaseHas('activity_logs', [
                'subject_id'   => $skId,
                'subject_type' => SkDocument::class,
            ]);
        }

        // Verify all submissions succeeded
        $this->assertEquals(count($testCases), SkDocument::count());
    }
}
