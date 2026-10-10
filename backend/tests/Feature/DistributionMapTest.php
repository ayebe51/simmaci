<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Teacher;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DistributionMapTest extends TestCase
{
    use RefreshDatabase;

    public function test_distribution_map_returns_24_cilacap_districts_with_correct_metrics(): void
    {
        $user = User::factory()->create([
            'role' => 'super_admin',
            'school_id' => null,
        ]);

        // Create schools in specific Cilacap subdistricts
        $schoolMajenang = School::factory()->create([
            'nama' => 'MTs Ma\'arif 02 Majenang',
            'kecamatan' => 'Majenang',
            'jenjang' => 'MTs',
            'status_jamiyyah' => 'Jam\'iyyah',
        ]);

        $schoolKroya = School::factory()->create([
            'nama' => 'MI Ma\'arif Kroya',
            'kecamatan' => 'Kroya',
            'jenjang' => 'MI',
            'status_jamiyyah' => 'Jama\'ah',
        ]);

        // Create Teachers (Guru)
        Teacher::factory()->count(3)->create([
            'school_id' => $schoolMajenang->id,
            'status' => 'GTY',
            'is_active' => true,
        ]);

        // Create Tendik
        Teacher::factory()->count(2)->create([
            'school_id' => $schoolMajenang->id,
            'status' => 'Tendik',
            'is_active' => true,
        ]);

        // Create Students
        Student::factory()->count(5)->create([
            'school_id' => $schoolMajenang->id,
            'status' => 'Aktif',
        ]);

        // Act
        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/dashboard/distribution-map');

        // Assert
        $response->assertOk();
        $response->assertJsonStructure([
            'success',
            'data' => [
                'summary' => [
                    'total_schools',
                    'total_teachers',
                    'total_tendiks',
                    'total_students',
                    'total_districts_covered',
                    'total_districts',
                ],
                'districts' => [
                    '*' => [
                        'nama',
                        'kode',
                        'schools_count',
                        'teachers_count',
                        'tendiks_count',
                        'students_count',
                        'jenjang_breakdown',
                        'schools',
                    ]
                ]
            ]
        ]);

        $data = $response->json('data');
        $this->assertEquals(2, $data['summary']['total_schools']);
        $this->assertEquals(3, $data['summary']['total_teachers']);
        $this->assertEquals(2, $data['summary']['total_tendiks']);
        $this->assertEquals(5, $data['summary']['total_students']);
        $this->assertEquals(2, $data['summary']['total_districts_covered']);
        $this->assertEquals(24, count($data['districts']));

        // Check Majenang specifically
        $majenang = collect($data['districts'])->firstWhere('nama', 'Majenang');
        $this->assertNotNull($majenang);
        $this->assertEquals(1, $majenang['schools_count']);
        $this->assertEquals(3, $majenang['teachers_count']);
        $this->assertEquals(2, $majenang['tendiks_count']);
        $this->assertEquals(5, $majenang['students_count']);
        $this->assertEquals(1, $majenang['jenjang_breakdown']['MTs']);
        $this->assertCount(1, $majenang['schools']);
        $this->assertEquals('MTs Ma\'arif 02 Majenang', $majenang['schools'][0]['nama']);
    }
}
