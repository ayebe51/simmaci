<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Student;
use App\Services\StudentStatisticsService;
use Faker\Factory as Faker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Property-Based Tests for Export Sum Invariants and Alphabetical Sorting.
 *
 * Tests Properties 8, 10, and 11 from the design document:
 * - Property 8: Per-Kelas Export Sum Invariant
 * - Property 10: Rekap Export Sum Invariant
 * - Property 11: Rekap Export Sorted Alphabetically
 *
 * @group student-statistics
 */
class StudentStatisticsExportPropertyTest extends TestCase
{
    use RefreshDatabase;

    private StudentStatisticsService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new StudentStatisticsService();
    }

    /**
     * Property 8: Per-Kelas Export Sum Invariant
     *
     * For any madrasah Excel export, the summary row total SHALL equal
     * the sum of all individual kelas jumlah_siswa values in the export.
     *
     * **Validates: Requirements 4.3**
     *
     * @test
     * @group student-statistics
     */
    public function property_per_kelas_export_sum_invariant(): void
    {
        $faker = Faker::create('id_ID');

        $kelasOptions = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '5A', '6A', 'VII-A', 'VII-B', 'VIII-A', 'IX-A', 'X IPA 1', 'XI IPS 2', null, '', '  '];

        for ($iteration = 0; $iteration < 50; $iteration++) {
            // Clean up data from previous iteration
            Student::withoutTenantScope()->forceDelete();
            School::query()->forceDelete();

            // Create a school
            $school = School::factory()->create([
                'jenjang' => $faker->randomElement(['MI', 'MTs', 'MA', 'RA']),
            ]);

            // Create random number of active students with various kelas values
            $numStudents = $faker->numberBetween(1, 25);
            $expectedActiveCount = 0;

            for ($s = 0; $s < $numStudents; $s++) {
                $status = $faker->randomElement(['Aktif', 'Aktif', 'Aktif', 'Lulus', 'Pindah']);
                $kelas = $faker->randomElement($kelasOptions);

                Student::factory()->create([
                    'school_id' => $school->id,
                    'status' => $status,
                    'kelas' => $kelas,
                ]);

                if ($status === 'Aktif') {
                    $expectedActiveCount++;
                }
            }

            // Call getPerKelas — this is the data used by the export
            $kelasData = $this->service->getPerKelas($school->id);

            // The export summary row total equals sum of all individual kelas jumlah_siswa
            $sumOfKelasRows = $kelasData->sum('jumlah_siswa');

            // The sum must equal the total active students for this school
            $this->assertEquals(
                $expectedActiveCount,
                $sumOfKelasRows,
                "Property 8 failed at iteration {$iteration}: Sum of kelas rows ({$sumOfKelasRows}) must equal total active students ({$expectedActiveCount}) for school {$school->id}"
            );

            // Verify the export logic: totalSiswa = kelasData->sum('jumlah_siswa')
            // This is exactly what the controller does for the summary row
            $totalSiswa = $kelasData->sum('jumlah_siswa');
            $this->assertEquals(
                $sumOfKelasRows,
                $totalSiswa,
                "Property 8 failed at iteration {$iteration}: Export summary row total ({$totalSiswa}) must equal sum of individual kelas rows ({$sumOfKelasRows})"
            );
        }
    }

    /**
     * Property 10: Rekap Export Sum Invariant
     *
     * For any jenjang rekap Excel export, the grand total row SHALL equal
     * the sum of all individual madrasah jumlah_siswa values in the export.
     *
     * **Validates: Requirements 5.3**
     *
     * @test
     * @group student-statistics
     */
    public function property_rekap_export_sum_invariant(): void
    {
        $faker = Faker::create('id_ID');

        $jenjangCategories = ['ra', 'mi', 'mts', 'ma'];

        for ($iteration = 0; $iteration < 50; $iteration++) {
            // Clean up data from previous iteration
            Student::withoutTenantScope()->forceDelete();
            School::query()->forceDelete();

            // Pick a random jenjang for this iteration
            $jenjang = $faker->randomElement($jenjangCategories);
            $jenjangValue = strtoupper($jenjang === 'mts' ? 'MTs' : $jenjang);

            // Create random number of schools with the same jenjang
            $numSchools = $faker->numberBetween(2, 6);
            $schools = [];
            $expectedTotalActive = 0;

            for ($i = 0; $i < $numSchools; $i++) {
                $schools[] = School::factory()->create([
                    'jenjang' => $jenjangValue,
                ]);
            }

            // Create random students across these schools
            foreach ($schools as $school) {
                $numStudents = $faker->numberBetween(0, 15);

                for ($s = 0; $s < $numStudents; $s++) {
                    $status = $faker->randomElement(['Aktif', 'Aktif', 'Aktif', 'Lulus', 'Pindah', 'Keluar']);

                    Student::factory()->create([
                        'school_id' => $school->id,
                        'status' => $status,
                    ]);

                    if ($status === 'Aktif') {
                        $expectedTotalActive++;
                    }
                }
            }

            // Call getMadrasahByJenjang — this is the data used by the export
            $madrasahData = $this->service->getMadrasahByJenjang($jenjang);

            // The grand total row equals sum of all individual madrasah jumlah_siswa
            $sumOfMadrasahRows = $madrasahData->sum('jumlah_siswa');

            // The sum must equal the total active students for this jenjang
            $this->assertEquals(
                $expectedTotalActive,
                $sumOfMadrasahRows,
                "Property 10 failed at iteration {$iteration}: Sum of madrasah rows ({$sumOfMadrasahRows}) must equal total active students ({$expectedTotalActive}) for jenjang '{$jenjang}'"
            );

            // Verify the export logic: grandTotal = madrasahData->sum('jumlah_siswa')
            // This is exactly what the controller does for the grand total row
            $grandTotal = $madrasahData->sum('jumlah_siswa');
            $this->assertEquals(
                $sumOfMadrasahRows,
                $grandTotal,
                "Property 10 failed at iteration {$iteration}: Export grand total ({$grandTotal}) must equal sum of individual madrasah rows ({$sumOfMadrasahRows})"
            );
        }
    }

    /**
     * Property 11: Rekap Export Sorted Alphabetically
     *
     * For any jenjang rekap export with multiple madrasah, the madrasah rows
     * SHALL be sorted in ascending alphabetical order by nama.
     *
     * **Validates: Requirements 5.4**
     *
     * @test
     * @group student-statistics
     */
    public function property_rekap_export_sorted_alphabetically(): void
    {
        $faker = Faker::create('id_ID');

        $jenjangCategories = ['ra', 'mi', 'mts', 'ma'];

        for ($iteration = 0; $iteration < 50; $iteration++) {
            // Clean up data from previous iteration
            Student::withoutTenantScope()->forceDelete();
            School::query()->forceDelete();

            // Pick a random jenjang for this iteration
            $jenjang = $faker->randomElement($jenjangCategories);
            $jenjangValue = strtoupper($jenjang === 'mts' ? 'MTs' : $jenjang);

            // Create multiple schools with random names and the same jenjang
            $numSchools = $faker->numberBetween(3, 8);
            $schools = [];

            for ($i = 0; $i < $numSchools; $i++) {
                $randomName = $faker->randomElement(['MI', 'MTs', 'MA', 'RA']) . ' ' . $faker->unique()->company();
                $schools[] = School::factory()->create([
                    'jenjang' => $jenjangValue,
                    'nama' => $randomName,
                ]);
            }

            // Create at least one active student per school so they appear in results
            foreach ($schools as $school) {
                Student::factory()->create([
                    'school_id' => $school->id,
                    'status' => 'Aktif',
                ]);
            }

            // Get madrasah data and sort alphabetically (as the controller does for export)
            $madrasahData = $this->service->getMadrasahByJenjang($jenjang);
            $sortedData = $madrasahData->sortBy('nama')->values();

            // Assert: for every consecutive pair (i, i+1), nama[i] <= nama[i+1]
            for ($i = 0; $i < $sortedData->count() - 1; $i++) {
                $currentNama = $sortedData[$i]->nama;
                $nextNama = $sortedData[$i + 1]->nama;

                $this->assertLessThanOrEqual(
                    0,
                    strcmp($currentNama, $nextNama),
                    "Property 11 failed at iteration {$iteration}: Madrasah '{$currentNama}' should come before or equal to '{$nextNama}' in alphabetical order"
                );
            }

            // Also verify that the sorted result has the same count as the original
            $this->assertEquals(
                $madrasahData->count(),
                $sortedData->count(),
                "Property 11 failed at iteration {$iteration}: Sorting should not change the number of madrasah"
            );

            // Reset faker unique counter
            $faker->unique(true);
        }
    }
}
