<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StrictDateImportIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private School $school;
    private User $operator;
    private User $admin;

    public function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create([
            'nama' => 'MI Ma\'arif NU 01 Strict Date Test',
            'sk_submission_unlocked' => true,
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'operator-strict-date@example.com',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);

        $this->admin = User::factory()->create([
            'role'      => 'super_admin',
            'email'     => 'admin-strict-date@example.com',
            'is_active' => true,
        ]);
    }

    // ══════════════════════════════════════════════════════════════════════
    // Teacher Import Tests
    // ══════════════════════════════════════════════════════════════════════

    public function test_teacher_import_accepts_valid_indonesian_month_formats(): void
    {
        $teachers = [
            [
                'nama' => 'Guru Satu',
                'nuptk' => '1111222233334441',
                'tanggal_lahir' => '11 Nov 2022',
                'tmt' => '11 November 2022',
                'pendidikan_terakhir' => 'S1',
            ],
            [
                'nama' => 'Guru Dua',
                'nuptk' => '1111222233334442',
                'tanggal_lahir' => '11 Nopember 2022', // Nopember alias
                'tmt' => '05 Januari 2023',
                'pendidikan_terakhir' => 'S1',
            ],
            [
                'nama' => 'Guru Tiga',
                'nuptk' => '1111222233334443',
                'tanggal_lahir' => '21 Agu 2024',
                'tmt' => '21 Agustus 2024',
                'pendidikan_terakhir' => 'S1',
            ],
            [
                'nama' => 'Guru Empat Kabisat',
                'nuptk' => '1111222233334444',
                'tanggal_lahir' => '29 Pebruari 2024', // Leap year + Pebruari alias
                'tmt' => '01 Maret 2024',
                'pendidikan_terakhir' => 'S1',
            ],
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', [
                'teachers' => $teachers,
            ]);

        $response->assertOk();
        $this->assertEquals(4, $response->json('created'));

        // Check normalized dates stored in database
        $this->assertDatabaseHas('teachers', [
            'nuptk' => '1111222233334441',
            'tanggal_lahir' => '2022-11-11',
            'tmt' => '2022-11-11',
        ]);

        $this->assertDatabaseHas('teachers', [
            'nuptk' => '1111222233334442',
            'tanggal_lahir' => '2022-11-11',
            'tmt' => '2023-01-05',
        ]);

        $this->assertDatabaseHas('teachers', [
            'nuptk' => '1111222233334443',
            'tanggal_lahir' => '2024-08-21',
            'tmt' => '2024-08-21',
        ]);

        $this->assertDatabaseHas('teachers', [
            'nuptk' => '1111222233334444',
            'tanggal_lahir' => '2024-02-29',
            'tmt' => '2024-03-01',
        ]);
    }

    public function test_teacher_import_rejects_numeric_slash_format_and_aborts_all_without_partial_import(): void
    {
        $teachers = [
            [
                'nama' => 'Guru Valid A',
                'nuptk' => '1111222233334451',
                'tanggal_lahir' => '11 Nov 2022',
            ],
            [
                'nama' => 'Guru Invalid Slash',
                'nuptk' => '1111222233334452',
                'tanggal_lahir' => '11/12/2022', // Ambiguous slash format
            ],
            [
                'nama' => 'Guru Valid B',
                'nuptk' => '1111222233334453',
                'tanggal_lahir' => '05 Januari 2023',
            ],
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', [
                'teachers' => $teachers,
            ]);

        $response->assertStatus(422);
        $response->assertJsonStructure([
            'success',
            'message',
            'errors' => [
                '*' => ['row', 'column', 'value', 'reason']
            ],
            'date_errors',
        ]);

        $errors = $response->json('date_errors');
        $this->assertCount(1, $errors);
        $this->assertEquals(3, $errors[0]['row']); // index 1 is row 3 (accounting for row 1 header)
        $this->assertEquals('Tanggal Lahir', $errors[0]['column']);
        $this->assertEquals('11/12/2022', $errors[0]['value']);

        // CRITICAL: Verify NO PARTIAL IMPORT occurred
        $this->assertEquals(0, Teacher::withoutTenantScope()->where('school_id', $this->school->id)->count());
    }

    public function test_teacher_import_rejects_dash_numeric_and_iso_formats(): void
    {
        $rejectedInputs = [
            '11-12-2022',
            '11.12.2022',
            '2022-12-11',
            '12/11/22',
            '11122022',
        ];

        foreach ($rejectedInputs as $rejectedDate) {
            $response = $this->actingAs($this->operator)
                ->postJson('/api/teachers/import', [
                    'teachers' => [
                        [
                            'nama' => 'Guru Test ' . $rejectedDate,
                            'nuptk' => '9999000011112222',
                            'tanggal_lahir' => $rejectedDate,
                        ],
                    ],
                ]);

            $response->assertStatus(422);
            $this->assertCount(1, $response->json('date_errors'), "Failed to reject: $rejectedDate");
        }
    }


}
