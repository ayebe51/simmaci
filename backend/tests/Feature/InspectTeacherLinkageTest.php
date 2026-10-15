<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InspectTeacherLinkageTest extends TestCase
{
    use RefreshDatabase;

    public function test_inspect_and_relink_sk_from_deleted_teacher_to_active_teacher(): void
    {
        $school = School::create([
            'nama'            => 'MI Ma\'arif NU 01 Kalisabuk',
            'npsn'            => '20010001',
            'jenjang'         => 'MI',
            'kecamatan'       => 'Kesugihan',
            'status_jamiyyah' => 'Jam\'iyyah',
        ]);

        // 1. Record guru terhapus (memiliki SK dan NIM)
        $deletedTeacher = Teacher::create([
            'nama'                => 'SENTOT SUCIPTO, S.Pd.',
            'school_id'           => $school->id,
            'unit_kerja'          => 'MI Ma\'arif NU 01 Kalisabuk',
            'nomor_induk_maarif'  => '113401534',
            'is_active'           => true,
        ]);

        $sk = SkDocument::create([
            'nomor_sk'          => '0351/PC.L/A.II/H-34.B/24.29/14/7/2026',
            'jenis_sk'          => 'GTY',
            'jabatan'           => 'Guru Kelas',
            'nama'              => 'SENTOT SUCIPTO, S.Pd.',
            'school_id'         => $school->id,
            'teacher_id'        => $deletedTeacher->id,
            'status'            => 'active',
            'tanggal_penetapan' => '2026-07-14',
        ]);

        $deletedTeacher->delete(); // Soft-deleted

        // 2. Record guru aktif (baru diinput tapi SK-nya belum tertaut)
        $activeTeacher = Teacher::create([
            'nama'       => 'SENTOT SUCIPTO, S.Pd.',
            'school_id'  => $school->id,
            'unit_kerja' => 'MI Ma\'arif NU 01 Kalisabuk',
            'is_active'  => true,
        ]);

        // Pastikan SK awalnya mengarah ke deletedTeacher
        $this->assertEquals($deletedTeacher->id, $sk->fresh()->teacher_id);

        // 3. Jalankan inspect & relink
        $this->artisan('teachers:inspect-linkage', ['--name' => 'SENTOT', '--relink' => true])
            ->expectsConfirmation('Apakah Anda yakin ingin memindahkan 1 dokumen SK ke Guru yang AKTIF?', 'yes')
            ->expectsOutputToContain('MASALAH TERKONFIRMASI')
            ->expectsOutputToContain('berhasil dipindahkan ke guru yang aktif')
            ->assertExitCode(0);

        // 4. Verifikasi bahwa SK sekarang tertaut ke activeTeacher
        $this->assertEquals($activeTeacher->id, $sk->fresh()->teacher_id);

        // Verifikasi bahwa NIM dimigrasikan ke activeTeacher jika sebelumnya kosong
        $this->assertEquals('113401534', $activeTeacher->fresh()->nomor_induk_maarif);
    }
}
