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

    public function test_teacher_import_rejects_invalid_calendar_date(): void
    {
        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', [
                'teachers' => [
                    [
                        'nama' => 'Guru Tanggal 31 Februari',
                        'nuptk' => '9999000011113333',
                        'tanggal_lahir' => '31 Februari 2023',
                    ],
                ],
            ]);

        $response->assertStatus(422);
        $errors = $response->json('date_errors');
        $this->assertStringContainsString('tidak valid secara kalender', $errors[0]['reason']);
    }

    public function test_teacher_import_rejects_invalid_ttl_combined_column(): void
    {
        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', [
                'teachers' => [
                    [
                        'nama' => 'Guru TTL Invalid',
                        'tempat_tanggal_lahir' => 'Cilacap, 11/12/2022',
                    ],
                ],
            ]);

        $response->assertStatus(422);
        $errors = $response->json('date_errors');
        $this->assertEquals('Tempat, Tanggal Lahir', $errors[0]['column']);
        $this->assertEquals('Cilacap, 11/12/2022', $errors[0]['value']);
    }

    // ══════════════════════════════════════════════════════════════════════
    // Teacher Import Preview & Commit Tests
    // ══════════════════════════════════════════════════════════════════════

    public function test_teacher_import_preview_rejects_invalid_date(): void
    {
        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import/preview', [
                'teachers' => [
                    [
                        'nama' => 'Guru Preview Invalid',
                        'tanggal_lahir' => '11-12-2022',
                    ],
                ],
            ]);

        $response->assertStatus(422);
        $this->assertNotEmpty($response->json('date_errors'));
    }

    public function test_teacher_import_commit_rejects_invalid_date_and_rolls_back(): void
    {
        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import/commit', [
                'teachers' => [
                    [
                        'action' => 'INSERT',
                        'payload' => [
                            'nama' => 'Guru Commit Invalid',
                            'tanggal_lahir' => '2022-12-11',
                        ],
                    ],
                ],
            ]);

        $response->assertStatus(422);
        $this->assertNotEmpty($response->json('date_errors'));
        $this->assertEquals(0, Teacher::withoutTenantScope()->where('nama', 'Guru Commit Invalid')->count());
    }

    // ══════════════════════════════════════════════════════════════════════
    // Student Import Tests
    // ══════════════════════════════════════════════════════════════════════

    public function test_student_import_accepts_valid_month_dates(): void
    {
        $students = [
            [
                'nama' => 'Siswa A',
                'nisn' => '0012345678',
                'tanggal_lahir' => '11 Nopember 2022',
                'tempat_lahir' => 'Cilacap',
            ],
            [
                'nama' => 'Siswa B',
                'nisn' => '0012345679',
                'tanggal_lahir' => '21 Agu 2024',
                'tempat_lahir' => 'Banyumas',
            ],
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/students/import', [
                'students' => $students,
            ]);

        $response->assertOk();

        $this->assertDatabaseHas('students', [
            'nisn' => '0012345678',
            'tanggal_lahir' => '2022-11-11',
        ]);

        $this->assertDatabaseHas('students', [
            'nisn' => '0012345679',
            'tanggal_lahir' => '2024-08-21',
        ]);
    }

    public function test_student_import_rejects_numeric_date_and_aborts_completely(): void
    {
        $students = [
            [
                'nama' => 'Siswa Valid',
                'nisn' => '0099887711',
                'tanggal_lahir' => '11 Nov 2022',
            ],
            [
                'nama' => 'Siswa Invalid',
                'nisn' => '0099887722',
                'tanggal_lahir' => '11/12/2022',
            ],
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/students/import', [
                'students' => $students,
            ]);

        $response->assertStatus(422);
        $this->assertNotEmpty($response->json('date_errors'));

        // Ensure zero students were saved
        $this->assertEquals(0, Student::withoutTenantScope()->where('school_id', $this->school->id)->count());
    }

    // ══════════════════════════════════════════════════════════════════════
    // SK Bulk Request Tests
    // ══════════════════════════════════════════════════════════════════════

    public function test_sk_bulk_request_rejects_numeric_dates(): void
    {
        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', [
                'surat_permohonan_url' => 'https://example.com/surat.pdf',
                'documents' => [
                    [
                        'nama' => 'Guru SK Invalid Date',
                        'unit_kerja' => $this->school->nama,
                        'status' => 'GTY',
                        'nomor_induk_maarif' => '113400888',
                        'tmt' => '11/12/2022',
                    ],
                ],
            ]);

        $response->assertStatus(422);
        $this->assertNotEmpty($response->json('date_errors'));
    }

    public function test_sk_bulk_request_accepts_valid_month_name_dates(): void
    {
        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', [
                'surat_permohonan_url' => 'https://example.com/surat.pdf',
                'documents' => [
                    [
                        'nama' => 'Guru SK Valid Date',
                        'unit_kerja' => $this->school->nama,
                        'status' => 'GTY',
                        'nomor_induk_maarif' => '113400889',
                        'tmt' => '11 November 2022',
                    ],
                ],
            ]);

        $response->assertOk();
        $this->assertEquals(1, $response->json('count'));
    }
}
