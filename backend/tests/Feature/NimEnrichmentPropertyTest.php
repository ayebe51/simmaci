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
 * Property 4: NIM enrichment correctness via SQL
 *
 * For any SK document whose teacher record lacks a nomor_induk_maarif, if a teacher
 * with a case-insensitively matching name exists in the same school and has a non-empty
 * NIM, the SK list response SHALL include that teacher's NIM value in the
 * teacher.nomor_induk_maarif field.
 *
 * **Validates: Requirements 2.2**
 *
 * Feature: performance-optimization, Property 4: NIM enrichment correctness via SQL
 *
 * @group performance-optimization
 */
class NimEnrichmentPropertyTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Property 4: NIM enrichment correctness via SQL
     *
     * Generate random SK documents and teachers with case-variant names.
     * Assert that matching teacher NIM appears in response when conditions are met.
     * Run 100 iterations.
     *
     * **Validates: Requirements 2.2**
     *
     * @test
     * @group performance-optimization
     */
    public function property_nim_enrichment_correctness_via_sql(): void
    {
        $faker = Faker::create('id_ID');

        for ($iteration = 0; $iteration < 100; $iteration++) {
            // Clean up data from previous iteration
            SkDocument::query()->forceDelete();
            Teacher::query()->forceDelete();
            School::query()->forceDelete();
            User::query()->forceDelete();

            // Create a school
            $school = School::factory()->create();

            // Create an operator user for this school
            $user = User::factory()->create([
                'role' => 'operator',
                'school_id' => $school->id,
            ]);

            // Generate a base teacher name
            $baseName = $faker->name();

            // Generate a case-variant of the name for the SK document
            $caseVariant = $this->generateCaseVariant($baseName, $faker);

            // Generate a random NIM value
            $nim = $faker->numerify('##########');

            // Create a teacher with the base name and a valid NIM in the same school
            Teacher::factory()->create([
                'nama' => $baseName,
                'nomor_induk_maarif' => $nim,
                'school_id' => $school->id,
            ]);

            // Create an SK document with the case-variant name and NO teacher_id
            // (this triggers NIM enrichment)
            $skDocument = SkDocument::factory()->create([
                'nama' => $caseVariant,
                'teacher_id' => null,
                'school_id' => $school->id,
                'status' => $faker->randomElement(['draft', 'pending', 'approved']),
            ]);

            // Call the SK list endpoint as the operator
            $response = $this->actingAs($user, 'sanctum')
                ->getJson('/api/sk-documents');

            $response->assertStatus(200);

            $data = $response->json('data');

            // Find our SK document in the response
            $skInResponse = collect($data)->firstWhere('id', $skDocument->id);

            $this->assertNotNull(
                $skInResponse,
                "Iteration {$iteration}: SK document ID {$skDocument->id} should be in the response. "
                . "Base name: '{$baseName}', Case variant: '{$caseVariant}'"
            );

            // Assert that the NIM was enriched correctly
            $this->assertNotNull(
                $skInResponse['teacher'] ?? null,
                "Iteration {$iteration}: teacher field should not be null when NIM enrichment matches. "
                . "Base name: '{$baseName}', Case variant: '{$caseVariant}'"
            );

            $this->assertEquals(
                $nim,
                $skInResponse['teacher']['nomor_induk_maarif'] ?? null,
                "Iteration {$iteration}: teacher.nomor_induk_maarif should be '{$nim}' "
                . "for SK with name '{$caseVariant}' matching teacher '{$baseName}' "
                . "in school {$school->id}"
            );
        }
    }

    /**
     * Property 4 (supplementary): NIM enrichment does NOT occur across different schools.
     *
     * Verify that a teacher with matching name in a DIFFERENT school does not
     * enrich the SK document's NIM.
     *
     * **Validates: Requirements 2.2**
     *
     * @test
     * @group performance-optimization
     */
    public function property_nim_enrichment_is_scoped_to_same_school(): void
    {
        $faker = Faker::create('id_ID');

        for ($iteration = 0; $iteration < 100; $iteration++) {
            // Clean up data from previous iteration
            SkDocument::query()->forceDelete();
            Teacher::query()->forceDelete();
            School::query()->forceDelete();
            User::query()->forceDelete();

            // Create two different schools
            $schoolA = School::factory()->create();
            $schoolB = School::factory()->create();

            // Create an operator user for school A
            $user = User::factory()->create([
                'role' => 'operator',
                'school_id' => $schoolA->id,
            ]);

            // Generate a teacher name
            $teacherName = $faker->name();
            $nim = $faker->numerify('##########');

            // Create a teacher with NIM in school B (different school)
            Teacher::factory()->create([
                'nama' => $teacherName,
                'nomor_induk_maarif' => $nim,
                'school_id' => $schoolB->id,
            ]);

            // Create an SK document in school A with the same name but no teacher_id
            $skDocument = SkDocument::factory()->create([
                'nama' => $teacherName,
                'teacher_id' => null,
                'school_id' => $schoolA->id,
                'status' => 'pending',
            ]);

            // Call the SK list endpoint as the operator of school A
            $response = $this->actingAs($user, 'sanctum')
                ->getJson('/api/sk-documents');

            $response->assertStatus(200);

            $data = $response->json('data');

            // Find our SK document in the response
            $skInResponse = collect($data)->firstWhere('id', $skDocument->id);

            $this->assertNotNull(
                $skInResponse,
                "Iteration {$iteration}: SK document should be in the response"
            );

            // Assert that NIM was NOT enriched (teacher is in a different school)
            $teacherData = $skInResponse['teacher'] ?? null;
            $enrichedNim = $teacherData['nomor_induk_maarif'] ?? null;

            $this->assertNull(
                $enrichedNim,
                "Iteration {$iteration}: teacher.nomor_induk_maarif should be null "
                . "when matching teacher is in a different school. "
                . "Teacher in school {$schoolB->id}, SK in school {$schoolA->id}"
            );
        }
    }

    /**
     * Generate a case-variant of a name for testing case-insensitive matching.
     *
     * Randomly applies one of several transformations:
     * - All uppercase
     * - All lowercase
     * - Leading/trailing whitespace
     * - Mixed case with whitespace
     */
    private function generateCaseVariant(string $name, \Faker\Generator $faker): string
    {
        $variant = $faker->numberBetween(0, 4);

        return match ($variant) {
            0 => strtoupper($name),                    // "AHMAD FAUZI"
            1 => strtolower($name),                    // "ahmad fauzi"
            2 => "  {$name}  ",                        // "  Ahmad Fauzi  "
            3 => " " . strtoupper($name) . " ",        // " AHMAD FAUZI "
            4 => "  " . strtolower($name) . "  ",      // "  ahmad fauzi  "
        };
    }
}
