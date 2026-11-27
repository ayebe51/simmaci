<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeacherImportCommitP1Test extends TestCase
{
    use RefreshDatabase;

    private School $school;
    private User $operator;
    private User $otherOperator;

    public function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create([
            'nama' => 'MI Ma\'arif NU 01 P1.2 Test',
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'op-p1-2@example.com',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);

        $otherSchool = School::factory()->create([
            'nama' => 'MI Ma\'arif NU 02 Lain',
        ]);
        $this->otherOperator = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'op-other-p1-2@example.com',
            'school_id' => $otherSchool->id,
            'is_active' => true,
        ]);
    }

    public function test_preview_to_commit_succeeds_with_normalized_iso_dates_and_all_p1_formats(): void
    {
        $rawRows = [
            [
                'nama'                => 'Guru Preview Satu',
                'nomor_induk_maarif'  => '113492001',
                'tanggal_lahir'       => '03 Agustus 1992',
                'tmt'                 => '15 Juli 2013',
                'pendidikan_terakhir' => 'S1 PAI',
            ],
            [
                'nama'                => 'Guru Preview Dua',
                'nomor_induk_maarif'  => '113492002',
                'tanggal_lahir'       => '03 Aug 1992',
                'tmt'                 => '02 Dec 2018',
                'pendidikan_terakhir' => 'S1 PAI',
            ],
            [
                'nama'                => 'Guru Preview Tiga',
                'nomor_induk_maarif'  => '113492003',
                'tanggal_lahir'       => '21 Agst 1990',
                'tmt'                 => '11-Mei-2022',
                'pendidikan_terakhir' => 'S1 PAI',
            ],
            [
                'nama'                 => 'Guru Preview Empat TTL',
                'nomor_induk_maarif'   => '113492004',
                'tempat_tanggal_lahir' => 'Cilacap, 11 Nopember 1988',
                'tmt'                  => '15 Oct 2019',
                'pendidikan_terakhir'  => 'S1 PAI',
            ],
        ];

        // 1. Preview
        $previewResp = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import/preview', ['teachers' => $rawRows]);

        $previewResp->assertOk();
        $previews = $previewResp->json('previews');
        $this->assertCount(4, $previews);

        // Pastikan preview menormalisasi ke format internal ISO YYYY-MM-DD dan menyertakan tanda tangan integritas
        $this->assertSame('1992-08-03', $previews[0]['payload']['tanggal_lahir']);
        $this->assertSame('2013-07-15', $previews[0]['payload']['tmt']);
        $this->assertNotEmpty($previews[0]['preview_date_signature'] ?? null);

        // 2. Commit langsung dengan hasil preview
        $commitResp = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import/commit', ['teachers' => $previews]);

        $commitResp->assertOk()
            ->assertJson(['success' => true]);

        $this->assertDatabaseCount('teachers', 4);
        $this->assertDatabaseHas('teachers', [
            'nomor_induk_maarif' => '113492001',
            'tanggal_lahir'      => '1992-08-03',
            'tmt'                => '2013-07-15',
        ]);
        $this->assertDatabaseHas('teachers', [
            'nomor_induk_maarif' => '113492002',
            'tanggal_lahir'      => '1992-08-03',
            'tmt'                => '2018-12-02',
        ]);
        $this->assertDatabaseHas('teachers', [
            'nomor_induk_maarif' => '113492003',
            'tanggal_lahir'      => '1990-08-21',
            'tmt'                => '2022-05-11',
        ]);
        $this->assertDatabaseHas('teachers', [
            'nomor_induk_maarif' => '113492004',
            'tempat_lahir'       => 'Cilacap',
            'tanggal_lahir'      => '1988-11-11',
            'tmt'                => '2019-10-15',
        ]);
    }

    public function test_commit_rejects_tampered_iso_and_ambiguous_dates_after_preview_with_zero_partial_persistence(): void
    {
        $previewResp = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import/preview', [
                'teachers' => [
                    [
                        'nama'               => 'Guru Valid Satu',
                        'nomor_induk_maarif' => '113493001',
                        'tanggal_lahir'      => '03 Agustus 1992',
                        'tmt'                => '15 Juli 2013',
                    ],
                    [
                        'nama'               => 'Guru Akan Dimanipulasi',
                        'nomor_induk_maarif' => '113493002',
                        'tanggal_lahir'      => '20 Februari 1984',
                        'tmt'                => '02 Desember 2018',
                    ],
                ],
            ]);

        $previewResp->assertOk();
        $previews = $previewResp->json('previews');

        // Skenario Tampering A: Ubah tanggal_lahir menjadi ISO numerik lain ('2022-12-11') setelah preview
        $tamperedIso = $previews;
        $tamperedIso[1]['payload']['tanggal_lahir'] = '2022-12-11';

        $respA = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import/commit', ['teachers' => $tamperedIso]);
        $respA->assertStatus(422);
        $this->assertNotEmpty($respA->json('date_errors'));
        $this->assertDatabaseCount('teachers', 0);

        // Skenario Tampering B: Ubah tmt menjadi format numerik ambigu ('11/12/2022')
        $tamperedSlash = $previews;
        $tamperedSlash[1]['payload']['tmt'] = '11/12/2022';

        $respB = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import/commit', ['teachers' => $tamperedSlash]);
        $respB->assertStatus(422);
        $this->assertNotEmpty($respB->json('date_errors'));
        $this->assertDatabaseCount('teachers', 0);

        // Skenario Tampering C: Ubah menjadi tanggal kalender tidak valid ('31 Februari 2023')
        $tamperedCalendar = $previews;
        $tamperedCalendar[1]['payload']['tanggal_lahir'] = '31 Februari 2023';

        $respC = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import/commit', ['teachers' => $tamperedCalendar]);
        $respC->assertStatus(422);
        $this->assertNotEmpty($respC->json('date_errors'));
        $this->assertDatabaseCount('teachers', 0);

        // Skenario Tampering D: Replay signature milik user lain
        $respD = $this->actingAs($this->otherOperator)
            ->postJson('/api/teachers/import/commit', ['teachers' => $previews]);
        $respD->assertStatus(422);
        $this->assertNotEmpty($respD->json('date_errors'));
        $this->assertDatabaseCount('teachers', 0);

        // Skenario Tampering E: Injeksi field tanggal baru yang tidak ada saat preview
        $tamperedExtra = $previews;
        $tamperedExtra[0]['payload']['tanggal_sk'] = '2024-01-15';
        $respE = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import/commit', ['teachers' => $tamperedExtra]);
        $respE->assertStatus(422);
        $this->assertNotEmpty($respE->json('date_errors'));
        $this->assertDatabaseCount('teachers', 0);
    }

    public function test_preview_to_commit_update_existing_teacher_preserves_dates_and_tenant_isolation(): void
    {
        $existing = Teacher::factory()->create([
            'school_id'          => $this->school->id,
            'unit_kerja'         => $this->school->nama,
            'nama'               => 'GURU EKSISTING LAMA',
            'nomor_induk_maarif' => '113497001',
            'tanggal_lahir'      => '1990-01-01',
            'tmt'                => '2015-01-01',
        ]);

        $previewResp = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import/preview', [
                'teachers' => [
                    [
                        'nama'               => 'Guru Eksisting Lama',
                        'nomor_induk_maarif' => '113497001',
                        'tanggal_lahir'      => '03 Agst 1992',
                        'tmt'                => '11-Okt-2020',
                    ],
                ],
            ]);

        $previewResp->assertOk();
        $previews = $previewResp->json('previews');
        $this->assertCount(1, $previews);
        $this->assertSame('UPDATE', $previews[0]['action']);
        $this->assertSame($existing->id, $previews[0]['target_id']);

        $commitResp = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import/commit', ['teachers' => $previews]);
        $commitResp->assertOk()->assertJson(['success' => true]);

        $existing->refresh();
        $this->assertSame('1992-08-03', $existing->tanggal_lahir);
        $this->assertSame('2020-10-11', $existing->tmt);
        $this->assertDatabaseCount('teachers', 1);
    }

    public function test_commit_revalidates_and_normalizes_valid_manual_month_date_edit_after_preview(): void
    {
        $previewResp = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import/preview', [
                'teachers' => [
                    [
                        'nama'               => 'Guru Edit Valid',
                        'nomor_induk_maarif' => '113494001',
                        'tanggal_lahir'      => '03 Agustus 1992',
                        'tmt'                => '15 Juli 2013',
                    ],
                ],
            ]);

        $previews = $previewResp->json('previews');
        // User/client mengubah payload tanggal_lahir menjadi tanggal teks bulan valid lain
        $previews[0]['payload']['tanggal_lahir'] = '21 Agst 1995';
        $previews[0]['payload']['tmt'] = '11-Mei-2020';

        $commitResp = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import/commit', ['teachers' => $previews]);

        $commitResp->assertOk()->assertJson(['success' => true]);
        $this->assertDatabaseHas('teachers', [
            'nomor_induk_maarif' => '113494001',
            'tanggal_lahir'      => '1995-08-21',
            'tmt'                => '2020-05-11',
        ]);
    }

    public function test_commit_retry_or_resubmit_does_not_create_duplicate_teachers(): void
    {
        $previewResp = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import/preview', [
                'teachers' => [
                    [
                        'nama'               => 'Guru Idempotent Satu',
                        'nomor_induk_maarif' => '113495001',
                        'tanggal_lahir'      => '03 Agustus 1992',
                        'tmt'                => '15 Juli 2013',
                    ],
                    [
                        'nama'          => 'Guru Idempotent Tanpa NIM',
                        'tanggal_lahir' => '20 Februari 1984',
                        'tmt'           => '02 Desember 2018',
                    ],
                ],
            ]);

        $previewResp->assertOk();
        $previews = $previewResp->json('previews');

        // Commit pertama
        $first = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import/commit', ['teachers' => $previews]);
        $first->assertOk();
        $this->assertDatabaseCount('teachers', 2);

        // Retry / submit ulang payload identik (action masih 'INSERT')
        $second = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import/commit', ['teachers' => $previews]);
        $second->assertOk();

        // Jumlah guru di DB HARUS tetap 2 (0 duplikat!)
        $this->assertDatabaseCount('teachers', 2);
        $this->assertDatabaseHas('teachers', [
            'nomor_induk_maarif' => '113495001',
            'tanggal_lahir'      => '1992-08-03',
            'tmt'                => '2013-07-15',
        ]);
    }

    public function test_preview_to_commit_has_no_timezone_shift_across_timezones(): void
    {
        $originalTz = date_default_timezone_get();
        try {
            foreach (['UTC', 'Asia/Jakarta', 'America/New_York', 'Pacific/Kiritimati'] as $i => $tz) {
                date_default_timezone_set($tz);
                $nim = '11349600' . ($i + 1);

                $previewResp = $this->actingAs($this->operator)
                    ->postJson('/api/teachers/import/preview', [
                        'teachers' => [
                            [
                                'nama'               => "Guru TZ {$i}",
                                'nomor_induk_maarif' => $nim,
                                'tanggal_lahir'      => '03 Aug 1992',
                                'tmt'                => '11-Mei-2022',
                            ],
                        ],
                    ]);
                $previewResp->assertOk();

                $commitResp = $this->actingAs($this->operator)
                    ->postJson('/api/teachers/import/commit', [
                        'teachers' => $previewResp->json('previews'),
                    ]);
                $commitResp->assertOk();

                $this->assertDatabaseHas('teachers', [
                    'nomor_induk_maarif' => $nim,
                    'tanggal_lahir'      => '1992-08-03',
                    'tmt'                => '2022-05-11',
                ]);
            }
        } finally {
            date_default_timezone_set($originalTz);
        }
    }
}
