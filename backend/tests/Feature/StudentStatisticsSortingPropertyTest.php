<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Student;
use App\Services\StudentStatisticsService;
use Faker\Factory as Faker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Property-based tests for sorting invariants in StudentStatisticsService.
 *
 * Property 5: Per-Madrasah Results Sorted Descending by Count
 * Property 7: Kelas Sorting with "Belum Ditentukan" Last
 *
 * Uses RefreshDatabase and Faker to generate randomized data across 50+ iterations.
 *
 * @group student-statistics
 */
class StudentStatisticsSortingPropertyTest extends TestCase
{
    use RefreshDatabase;

    private StudentStatisticsService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new StudentStatisticsService();
    }

    /**
     * Property 5: Per-Madrasah Results Sorted Descending by Count
     *
     * For any jenjang category with multiple madrasah, the madrasah list returned
     * SHALL be sorted in descending order by jumlah_siswa, such that for every
     * consecutive pair (i, i+1), jumlah_siswa[i] >= jumlah_siswa[i+1].
     *
     * **Validates: Requirements 2.2**
     *
     * @test
     * @group student-statistics
     */
    public function property_per_madrasah_results_sorted_descending_by_count(): void
    {
        $faker = Faker::create('id_ID');

        for ($iteration = 0; $iteration < 50; $iteration++) {
            // Clean up for each iteration
            Student::withoutTenantScope()->forceDelete();
            School::query()->forceDelete();

            // Create 3-8 schools all with jenjang 'MI'
            $numSchools = $faker->numberBetween(3, 8);
            $schools = [];

            for ($s = 0; $s < $numSchools; $s++) {
                $schools[] = School::factory()->create([
                    'jenjang' => 'MI',
                ]);
            }

            // Create random numbers of active students per school
            foreach ($schools as $school) {
                $numStudents = $faker->numberBetween(0, 50);
                for ($st = 0; $st < $numStudents; $st++) {
                    Student::factory()->create([
                        'school_id' => $school->id,
                        'status' => 'Aktif',
                    ]);
                }
            }

            // Call the service method
            $result = $this->service->getMadrasahByJenjang('mi');

            // Assert: results are sorted in descending order by jumlah_siswa
            $resultArray = $result->toArray();

            for ($i = 0; $i < count($resultArray) - 1; $i++) {
                $current = (int) $resultArray[$i]->jumlah_siswa;
                $next = (int) $resultArray[$i + 1]->jumlah_siswa;

                $this->assertGreaterThanOrEqual(
                    $next,
                    $current,
                    "Madrasah list must be sorted descending by jumlah_siswa. "
                    . "Position {$i} has {$current}, position " . ($i + 1) . " has {$next}. "
                    . "Iteration: {$iteration}"
                );
            }
        }
    }

    /**
     * Property 7: Kelas Sorting with "Belum Ditentukan" Last
     *
     * For any per-kelas result set, all entries SHALL be sorted in ascending
     * alphanumeric order, with the exception that "Belum Ditentukan" SHALL always
     * appear as the last entry regardless of its alphabetical position.
     *
     * **Validates: Requirements 3.4**
     *
     * @test
     * @group student-statistics
     */
    public function property_kelas_sorting_with_belum_ditentukan_last(): void
    {
        $faker = Faker::create('id_ID');

        // Possible kelas values including ones that would trigger "Belum Ditentukan"
        $validKelasValues = [
            '1A', '1B', '2A', '2B', '3A', '3B',
            '4A', '4B', '5A', '5B', '6A', '6B',
            'VII-A', 'VII-B', 'VIII-A', 'VIII-B', 'IX-A', 'IX-B',
            'X IPA 1', 'X IPA 2', 'X IPS 1', 'XI IPA 1', 'XII IPA 1',
        ];

        // Values that should map to "Belum Ditentukan"
        $undefinedKelasValues = [null, '', '   ', "\t", "\n"];

        for ($iteration = 0; $iteration < 50; $iteration++) {
            // Clean up for each iteration
            Student::withoutTenantScope()->forceDelete();
            School::query()->forceDelete();

            // Create a single school
            $school = School::factory()->create(['jenjang' => 'MI']);

            // Decide how many distinct kelas values to use (2-6)
            $numDistinctKelas = $faker->numberBetween(2, 6);
            $chosenKelas = $faker->randomElements($validKelasValues, min($numDistinctKelas, count($validKelasValues)));

            // Randomly decide whether to include "Belum Ditentukan" students
            $includeUndefined = $faker->boolean(70); // 70% chance

            // Create students with chosen kelas values
            foreach ($chosenKelas as $kelas) {
                $numStudents = $faker->numberBetween(1, 10);
                for ($st = 0; $st < $numStudents; $st++) {
                    Student::factory()->create([
                        'school_id' => $school->id,
                        'status' => 'Aktif',
                        'kelas' => $kelas,
                    ]);
                }
            }

            // Create students with undefined kelas values
            if ($includeUndefined) {
                $numUndefined = $faker->numberBetween(1, 5);
                for ($st = 0; $st < $numUndefined; $st++) {
                    $undefinedValue = $faker->randomElement($undefinedKelasValues);
                    Student::factory()->create([
                        'school_id' => $school->id,
                        'status' => 'Aktif',
                        'kelas' => $undefinedValue,
                    ]);
                }
            }

            // Call the service method
            $result = $this->service->getPerKelas($school->id);
            $resultArray = $result->toArray();

            if (empty($resultArray)) {
                continue; // Skip if no results (shouldn't happen given seeding)
            }

            // Check if "Belum Ditentukan" is present
            $lastEntry = end($resultArray);
            $hasBelumDitentukan = false;

            foreach ($resultArray as $entry) {
                if ($entry->kelas === 'Belum Ditentukan') {
                    $hasBelumDitentukan = true;
                    break;
                }
            }

            // Assert: If "Belum Ditentukan" is present, it must be the last entry
            if ($hasBelumDitentukan) {
                $this->assertEquals(
                    'Belum Ditentukan',
                    $lastEntry->kelas,
                    "\"Belum Ditentukan\" must be the last entry in the kelas list. "
                    . "Last entry is \"{$lastEntry->kelas}\". Iteration: {$iteration}"
                );
            }

            // Assert: All entries except "Belum Ditentukan" are in ascending alphanumeric order
            $nonBelumEntries = array_filter($resultArray, fn($entry) => $entry->kelas !== 'Belum Ditentukan');
            $nonBelumEntries = array_values($nonBelumEntries);

            for ($i = 0; $i < count($nonBelumEntries) - 1; $i++) {
                $current = $nonBelumEntries[$i]->kelas;
                $next = $nonBelumEntries[$i + 1]->kelas;

                $this->assertLessThanOrEqual(
                    0,
                    strcmp($current, $next),
                    "Kelas entries (excluding 'Belum Ditentukan') must be in ascending order. "
                    . "Position {$i} has \"{$current}\", position " . ($i + 1) . " has \"{$next}\". "
                    . "Iteration: {$iteration}"
                );
            }
        }
    }
}
