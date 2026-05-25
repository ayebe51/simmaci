<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\User;
use Faker\Factory as Faker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Property 9: Response payload contains only allowed fields
 *
 * For any SK document returned by the list endpoint, the response object SHALL
 * contain exactly the fields: id, nomor_sk, nama, jenis_sk, status, unit_kerja,
 * created_at, and teacher.nomor_induk_maarif — and SHALL NOT contain any of:
 * jabatan, file_url, surat_permohonan_url, qr_code, revision_status, revision_reason,
 * revision_data, archived_at, archived_by, archive_reason, nomor_permohonan,
 * tanggal_permohonan, rejection_reason, ijazah_url.
 *
 * **Validates: Requirements 7.1, 7.2**
 *
 * @group performance-optimization
 */
class SkListPayloadPropertyTest extends TestCase
{
    use RefreshDatabase;

    private const ALLOWED_FIELDS = [
        'id',
        'nomor_sk',
        'nama',
        'jenis_sk',
        'status',
        'unit_kerja',
        'created_at',
        'teacher',
    ];

    private const EXCLUDED_FIELDS = [
        'jabatan',
        'file_url',
        'surat_permohonan_url',
        'qr_code',
        'revision_status',
        'revision_reason',
        'revision_data',
        'archived_at',
        'archived_by',
        'archive_reason',
        'nomor_permohonan',
        'tanggal_permohonan',
        'rejection_reason',
        'ijazah_url',
        'school_id',
        'teacher_id',
    ];

    /**
     * Property 9: Response payload contains only allowed fields.
     *
     * Create randomized SK documents with ALL fields populated, then verify
     * the response only contains allowed fields and none of the excluded fields.
     * Run 100 iterations with randomized SK documents.
     *
     * **Validates: Requirements 7.1, 7.2**
     *
     * @test
     * @group performance-optimization
     */
    public function property_response_payload_contains_only_allowed_fields(): void
    {
        $faker = Faker::create('id_ID');

        // Create a school and authenticated user
        $school = School::factory()->create();
        $user = User::factory()->create([
            'role' => 'operator',
            'school_id' => $school->id,
        ]);

        for ($iteration = 0; $iteration < 100; $iteration++) {
            // Create a teacher with NIM for this school
            $teacher = Teacher::factory()->create([
                'school_id' => $school->id,
                'nomor_induk_maarif' => $faker->numerify('##########'),
            ]);

            // Create an SK document with ALL fields populated (including excluded ones)
            $sk = SkDocument::create([
                'nomor_sk' => 'SK/' . $faker->unique()->numerify('####') . '/' . date('Y'),
                'jenis_sk' => $faker->randomElement(['Pengangkatan', 'Mutasi', 'Pemberhentian', 'Kenaikan Pangkat']),
                'nama' => $faker->name(),
                'jabatan' => $faker->randomElement(['Guru Kelas', 'Guru Mapel', 'Kepala Sekolah']),
                'unit_kerja' => $faker->company(),
                'tanggal_penetapan' => $faker->date(),
                'status' => $faker->randomElement(['draft', 'pending', 'approved', 'rejected']),
                'created_by' => $faker->safeEmail(),
                'school_id' => $school->id,
                'teacher_id' => $teacher->id,
                'file_url' => $faker->url(),
                'surat_permohonan_url' => $faker->url(),
                'qr_code' => $faker->sha256(),
                'revision_status' => $faker->randomElement(['pending_revision', 'revised', null]),
                'revision_reason' => $faker->sentence(),
                'revision_data' => ['field' => 'value', 'change' => $faker->word()],
                'archived_at' => $faker->optional(0.3)->dateTime(),
                'archived_by' => $faker->optional(0.3)->safeEmail(),
                'archive_reason' => $faker->optional(0.3)->sentence(),
                'nomor_permohonan' => $faker->numerify('REQ/####/2024'),
                'tanggal_permohonan' => $faker->date(),
                'rejection_reason' => $faker->optional(0.3)->sentence(),
                'ijazah_url' => $faker->optional(0.3)->url(),
            ]);

            // Make the API request as the authenticated user
            $response = $this->actingAs($user, 'sanctum')
                ->getJson('/api/sk-documents?per_page=100');

            $response->assertStatus(200);

            $data = $response->json('data');
            $this->assertNotEmpty(
                $data,
                "Iteration {$iteration}: Response data should not be empty"
            );

            // Find the SK document we just created in the response
            $found = collect($data)->firstWhere('id', $sk->id);
            $this->assertNotNull(
                $found,
                "Iteration {$iteration}: Created SK document (id={$sk->id}) should appear in response"
            );

            // Assert response contains only allowed fields
            $responseKeys = array_keys($found);
            foreach (self::ALLOWED_FIELDS as $allowedField) {
                $this->assertContains(
                    $allowedField,
                    $responseKeys,
                    "Iteration {$iteration}: Response should contain allowed field '{$allowedField}'. "
                    . "Got keys: " . implode(', ', $responseKeys)
                );
            }

            // Assert response does NOT contain any excluded fields
            foreach (self::EXCLUDED_FIELDS as $excludedField) {
                $this->assertNotContains(
                    $excludedField,
                    $responseKeys,
                    "Iteration {$iteration}: Response should NOT contain excluded field '{$excludedField}'. "
                    . "Got keys: " . implode(', ', $responseKeys)
                );
            }

            // Verify teacher relation structure when present
            if ($found['teacher'] !== null) {
                $teacherKeys = array_keys($found['teacher']);
                $this->assertContains(
                    'nomor_induk_maarif',
                    $teacherKeys,
                    "Iteration {$iteration}: Teacher relation should contain 'nomor_induk_maarif'. "
                    . "Got keys: " . implode(', ', $teacherKeys)
                );

                // Teacher should NOT expose internal fields like id, nama, school_id, etc.
                $excludedTeacherFields = ['id', 'nama', 'school_id', 'nuptk', 'nip', 'email'];
                foreach ($excludedTeacherFields as $excludedTeacherField) {
                    $this->assertNotContains(
                        $excludedTeacherField,
                        $teacherKeys,
                        "Iteration {$iteration}: Teacher relation should NOT contain '{$excludedTeacherField}'. "
                        . "Got keys: " . implode(', ', $teacherKeys)
                    );
                }
            }

            // Clean up the SK document for next iteration to keep dataset manageable
            $sk->forceDelete();
            $teacher->forceDelete();
        }
    }

    /**
     * Property 9 (supplementary): Excluded fields are never leaked even with varied data.
     *
     * Verify that even when SK documents have all optional fields populated with
     * non-null values, none of the excluded fields appear in the list response.
     *
     * **Validates: Requirements 7.1, 7.2**
     *
     * @test
     * @group performance-optimization
     */
    public function property_excluded_fields_never_leaked_with_fully_populated_documents(): void
    {
        $faker = Faker::create('id_ID');

        $school = School::factory()->create();
        $user = User::factory()->create([
            'role' => 'operator',
            'school_id' => $school->id,
        ]);

        // Create multiple SK documents with ALL fields populated (non-null)
        $skDocuments = [];
        for ($i = 0; $i < 10; $i++) {
            $teacher = Teacher::factory()->create([
                'school_id' => $school->id,
                'nomor_induk_maarif' => $faker->numerify('##########'),
            ]);

            $skDocuments[] = SkDocument::create([
                'nomor_sk' => 'SK/' . $faker->unique()->numerify('####') . '/' . date('Y'),
                'jenis_sk' => $faker->randomElement(['Pengangkatan', 'Mutasi', 'Pemberhentian']),
                'nama' => $faker->name(),
                'jabatan' => 'Guru Kelas ' . ($i + 1),
                'unit_kerja' => $faker->company(),
                'tanggal_penetapan' => $faker->date(),
                'status' => 'approved',
                'created_by' => $faker->safeEmail(),
                'school_id' => $school->id,
                'teacher_id' => $teacher->id,
                'file_url' => 'https://storage.example.com/sk/' . $faker->uuid() . '.pdf',
                'surat_permohonan_url' => 'https://storage.example.com/permohonan/' . $faker->uuid() . '.pdf',
                'qr_code' => $faker->sha256(),
                'revision_status' => 'revised',
                'revision_reason' => 'Data perlu diperbaiki: ' . $faker->sentence(),
                'revision_data' => ['nama' => $faker->name(), 'jabatan' => 'Updated'],
                'archived_at' => now()->subDays($faker->numberBetween(1, 30)),
                'archived_by' => $faker->safeEmail(),
                'archive_reason' => 'Arsip tahunan: ' . $faker->sentence(),
                'nomor_permohonan' => 'REQ/' . date('Y') . '/' . $faker->numerify('####'),
                'tanggal_permohonan' => $faker->date(),
                'rejection_reason' => 'Dokumen tidak lengkap: ' . $faker->sentence(),
                'ijazah_url' => 'https://storage.example.com/ijazah/' . $faker->uuid() . '.pdf',
            ]);
        }

        // Make the API request
        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/sk-documents?per_page=100');

        $response->assertStatus(200);

        $data = $response->json('data');
        $this->assertNotEmpty($data, 'Response data should not be empty');

        // Verify every item in the response
        foreach ($data as $index => $item) {
            $itemKeys = array_keys($item);

            // Check no excluded fields are present
            foreach (self::EXCLUDED_FIELDS as $excludedField) {
                $this->assertNotContains(
                    $excludedField,
                    $itemKeys,
                    "Item {$index} (id={$item['id']}): Response should NOT contain "
                    . "excluded field '{$excludedField}' even when fully populated. "
                    . "Got keys: " . implode(', ', $itemKeys)
                );
            }

            // Check all allowed fields are present
            foreach (self::ALLOWED_FIELDS as $allowedField) {
                $this->assertContains(
                    $allowedField,
                    $itemKeys,
                    "Item {$index} (id={$item['id']}): Response should contain "
                    . "allowed field '{$allowedField}'. Got keys: " . implode(', ', $itemKeys)
                );
            }
        }
    }
}
