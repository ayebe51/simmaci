<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\User;
use Faker\Factory as Faker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Property 10: Pagination metadata invariant
 *
 * For any paginated SK list response, the response SHALL include `total` (integer ≥ 0),
 * `per_page` (integer between 1 and 100, default 25), and `current_page` (integer ≥ 1)
 * fields, and the data array length SHALL be ≤ per_page.
 *
 * **Validates: Requirements 7.4**
 *
 * @group performance-optimization
 */
class SkListPaginationPropertyTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private School $school;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create();

        $this->user = User::factory()->create([
            'role' => 'operator',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);
    }

    /**
     * Create SK documents directly via insert to avoid factory unique constraints.
     */
    private function createSkDocuments(int $count): void
    {
        $faker = Faker::create('id_ID');
        $records = [];
        $now = now();

        for ($i = 0; $i < $count; $i++) {
            $records[] = [
                'nomor_sk' => 'SK/' . str_pad($i, 6, '0', STR_PAD_LEFT) . '/' . uniqid(),
                'jenis_sk' => $faker->randomElement(['Pengangkatan', 'Mutasi', 'Pemberhentian', 'Kenaikan Pangkat']),
                'nama' => $faker->name(),
                'jabatan' => $faker->randomElement(['Guru Kelas', 'Guru Mapel', 'Kepala Sekolah']),
                'unit_kerja' => $faker->company(),
                'tanggal_penetapan' => $faker->date(),
                'status' => $faker->randomElement(['draft', 'pending', 'approved', 'rejected']),
                'created_by' => $faker->safeEmail(),
                'school_id' => $this->school->id,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        // Insert in chunks to avoid memory issues
        foreach (array_chunk($records, 100) as $chunk) {
            SkDocument::insert($chunk);
        }
    }

    /**
     * Property 10: Pagination metadata invariant with randomized page sizes and data volumes.
     *
     * Assert response includes total (≥0), per_page (1-100, default 25), current_page (≥1).
     * Assert data array length ≤ per_page.
     * Run 100 iterations with randomized page sizes and data volumes.
     *
     * **Validates: Requirements 7.4**
     *
     * @test
     * @group performance-optimization
     */
    public function property_pagination_metadata_invariant_with_randomized_inputs(): void
    {
        $faker = Faker::create('id_ID');

        for ($iteration = 0; $iteration < 100; $iteration++) {
            // Randomize data volume (0-60 documents) and per_page (1-100)
            $dataVolume = $faker->numberBetween(0, 60);
            $perPage = $faker->numberBetween(1, 100);
            $currentPage = $faker->numberBetween(1, max(1, (int) ceil($dataVolume / $perPage) + 1));

            // Clean up previous iteration's SK documents
            SkDocument::where('school_id', $this->school->id)->forceDelete();

            // Create randomized number of SK documents
            if ($dataVolume > 0) {
                $this->createSkDocuments($dataVolume);
            }

            // Make request with randomized per_page and page
            $response = $this->actingAs($this->user)
                ->getJson("/api/sk-documents?per_page={$perPage}&page={$currentPage}");

            $response->assertOk();

            $json = $response->json();

            // Assert pagination metadata fields exist
            $this->assertArrayHasKey('total', $json,
                "Iteration {$iteration}: Response must include 'total' field (volume={$dataVolume}, per_page={$perPage}, page={$currentPage})");
            $this->assertArrayHasKey('per_page', $json,
                "Iteration {$iteration}: Response must include 'per_page' field");
            $this->assertArrayHasKey('current_page', $json,
                "Iteration {$iteration}: Response must include 'current_page' field");
            $this->assertArrayHasKey('data', $json,
                "Iteration {$iteration}: Response must include 'data' array");

            // Assert total is integer ≥ 0
            $total = $json['total'];
            $this->assertIsInt($total,
                "Iteration {$iteration}: 'total' must be an integer");
            $this->assertGreaterThanOrEqual(0, $total,
                "Iteration {$iteration}: 'total' must be ≥ 0, got {$total}");

            // Assert per_page is integer between 1 and 100
            $responsePerPage = $json['per_page'];
            $this->assertIsInt($responsePerPage,
                "Iteration {$iteration}: 'per_page' must be an integer");
            $this->assertGreaterThanOrEqual(1, $responsePerPage,
                "Iteration {$iteration}: 'per_page' must be ≥ 1, got {$responsePerPage}");
            $this->assertLessThanOrEqual(100, $responsePerPage,
                "Iteration {$iteration}: 'per_page' must be ≤ 100, got {$responsePerPage}");

            // Assert per_page matches the requested value
            $this->assertEquals($perPage, $responsePerPage,
                "Iteration {$iteration}: 'per_page' should match requested value {$perPage}, got {$responsePerPage}");

            // Assert current_page is integer ≥ 1
            $responseCurrentPage = $json['current_page'];
            $this->assertIsInt($responseCurrentPage,
                "Iteration {$iteration}: 'current_page' must be an integer");
            $this->assertGreaterThanOrEqual(1, $responseCurrentPage,
                "Iteration {$iteration}: 'current_page' must be ≥ 1, got {$responseCurrentPage}");

            // Assert data array length ≤ per_page
            $dataCount = count($json['data']);
            $this->assertLessThanOrEqual($responsePerPage, $dataCount,
                "Iteration {$iteration}: data array length ({$dataCount}) must be ≤ per_page ({$responsePerPage})");

            // Assert total matches actual data volume for this school
            $this->assertEquals($dataVolume, $total,
                "Iteration {$iteration}: 'total' ({$total}) should match actual document count ({$dataVolume})");
        }
    }

    /**
     * Property 10: Default per_page is 25 when not specified.
     *
     * Assert that when per_page is not provided, the default value of 25 is used.
     * Run 100 iterations with randomized data volumes.
     *
     * **Validates: Requirements 7.4**
     *
     * @test
     * @group performance-optimization
     */
    public function property_default_per_page_is_25_when_not_specified(): void
    {
        $faker = Faker::create('id_ID');

        for ($iteration = 0; $iteration < 100; $iteration++) {
            $dataVolume = $faker->numberBetween(0, 50);

            // Clean up previous iteration's SK documents
            SkDocument::where('school_id', $this->school->id)->forceDelete();

            if ($dataVolume > 0) {
                $this->createSkDocuments($dataVolume);
            }

            // Make request WITHOUT per_page parameter
            $response = $this->actingAs($this->user)
                ->getJson('/api/sk-documents');

            $response->assertOk();

            $json = $response->json();

            // Assert default per_page is 25
            $this->assertEquals(25, $json['per_page'],
                "Iteration {$iteration}: Default per_page should be 25, got {$json['per_page']}");

            // Assert data array length ≤ 25 (the default)
            $dataCount = count($json['data']);
            $this->assertLessThanOrEqual(25, $dataCount,
                "Iteration {$iteration}: data array length ({$dataCount}) must be ≤ default per_page (25)");

            // Assert total is correct
            $this->assertEquals($dataVolume, $json['total'],
                "Iteration {$iteration}: 'total' ({$json['total']}) should match actual document count ({$dataVolume})");

            // Assert current_page is 1 (default first page)
            $this->assertEquals(1, $json['current_page'],
                "Iteration {$iteration}: Default current_page should be 1");
        }
    }
}
