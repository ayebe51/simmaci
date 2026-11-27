<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExcelDateParserP1IntegrationTest extends TestCase
{
    use RefreshDatabase;

    private School $school;
    private User $operator;

    public function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create([
            'nama'                   => 'MI Ma\'arif NU 01 P1.1 Test',
            'sk_submission_unlocked' => true,
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'operator-p1-1@example.com',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);
    }

    public function test_bulk_sk_accepts_sheetjs_english_short_months_agst_and_hyphen_indonesian_dates(): void
    {
        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', [
                'surat_permohonan_url' => 'https://example.com/surat-p1.pdf',
                'nomor_permohonan'     => 'P1-001/SK/2026',
                'tanggal_permohonan'   => '2026-08-11',
                'documents'            => [
                    [
                        'nama'                => 'Guru SheetJS Aug Dec',
                        'tempat_lahir'        => 'Cilacap',
                        'tanggal_lahir'       => '03 Aug 1992',
                        'nomor_induk_maarif'  => '113491001',
                        'pendidikan_terakhir' => 'S1 PAI',
                        'unit_kerja'          => $this->school->nama,
                        'tmt'                 => '02 Dec 2018',
                        'status'              => 'GTY',
                        'status_kepegawaian'  => 'GTY',
                    ],
                    [
                        'nama'                => 'Guru SheetJS Oct Agst',
                        'tempat_lahir'        => 'Cilacap',
                        'tanggal_lahir'       => '15 Oct 1990',
                        'nomor_induk_maarif'  => '113491002',
                        'pendidikan_terakhir' => 'S1 PAI',
                        'unit_kerja'          => $this->school->nama,
                        'tmt'                 => '21 Agst 2024',
                        'status'              => 'GTY',
                        'status_kepegawaian'  => 'GTY',
                    ],
                    [
                        'nama'                => 'Guru Hyphen Indo',
                        'tempat_lahir'        => 'Cilacap',
                        'tanggal_lahir'       => '11-Mei-2022',
                        'nomor_induk_maarif'  => '113491003',
                        'pendidikan_terakhir' => 'S1 PAI',
                        'unit_kerja'          => $this->school->nama,
                        'tmt'                 => '11-Des-2022',
                        'status'              => 'GTY',
                        'status_kepegawaian'  => 'GTY',
                    ],
                ],
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'count'   => 3,
                'skipped' => 0,
            ]);

        $this->assertDatabaseHas('teachers', [
            'nomor_induk_maarif' => '113491001',
            'tanggal_lahir'      => '1992-08-03',
            'tmt'                => '2018-12-02',
        ]);
        $this->assertDatabaseHas('teachers', [
            'nomor_induk_maarif' => '113491002',
            'tanggal_lahir'      => '1990-10-15',
            'tmt'                => '2024-08-21',
        ]);
        $this->assertDatabaseHas('teachers', [
            'nomor_induk_maarif' => '113491003',
            'tanggal_lahir'      => '2022-05-11',
            'tmt'                => '2022-12-11',
        ]);
    }

    public function test_teacher_and_student_import_accept_p1_1_date_formats_and_still_reject_ambiguous_numeric(): void
    {
        $teacherResp = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', [
                'teachers' => [
                    [
                        'nama'          => 'Guru P1 Agu Okt',
                        'nuptk'         => '8888111122223331',
                        'tanggal_lahir' => '11-Agu-1992',
                        'tmt'           => '11-Okt-2022',
                    ],
                    [
                        'nama'          => 'Guru P1 Agst Dec',
                        'nuptk'         => '8888111122223332',
                        'tanggal_lahir' => '03 Agst 1992',
                        'tmt'           => '02 Dec 2018',
                    ],
                ],
            ]);

        $teacherResp->assertOk();
        $this->assertDatabaseHas('teachers', [
            'nuptk'         => '8888111122223331',
            'tanggal_lahir' => '1992-08-11',
            'tmt'           => '2022-10-11',
        ]);
        $this->assertDatabaseHas('teachers', [
            'nuptk'         => '8888111122223332',
            'tanggal_lahir' => '1992-08-03',
            'tmt'           => '2018-12-02',
        ]);

        $studentResp = $this->actingAs($this->operator)
            ->postJson('/api/students/import', [
                'students' => [
                    [
                        'nama'          => 'Siswa P1 Oct',
                        'nisn'          => '0077665544',
                        'tanggal_lahir' => '15 Oct 2012',
                    ],
                    [
                        'nama'          => 'Siswa P1 Hyphen Mei',
                        'nisn'          => '0077665545',
                        'tanggal_lahir' => '11-Mei-2013',
                    ],
                ],
            ]);

        $studentResp->assertOk();
        $this->assertDatabaseHas('students', [
            'nisn'          => '0077665544',
            'tanggal_lahir' => '2012-10-15',
        ]);
        $this->assertDatabaseHas('students', [
            'nisn'          => '0077665545',
            'tanggal_lahir' => '2013-05-11',
        ]);

        // Ambiguous numeric date must still be strictly rejected without partial insert
        $badResp = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', [
                'teachers' => [
                    [
                        'nama'          => 'Guru Valid Mix',
                        'nuptk'         => '8888111122229991',
                        'tanggal_lahir' => '03 Aug 1992',
                    ],
                    [
                        'nama'          => 'Guru Invalid Numeric',
                        'nuptk'         => '8888111122229992',
                        'tanggal_lahir' => '11/12/2022',
                    ],
                ],
            ]);

        $badResp->assertStatus(422);
        $this->assertDatabaseMissing('teachers', ['nuptk' => '8888111122229991']);
        $this->assertDatabaseMissing('teachers', ['nuptk' => '8888111122229992']);
    }
}
