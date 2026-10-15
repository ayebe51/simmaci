<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckDeletedTeachersWithSkTest extends TestCase
{
    use RefreshDatabase;

    public function test_check_deleted_teachers_when_none_are_deleted(): void
    {
        $school = School::create([
            'nama'            => 'MI Ma\'arif NU 01 Kalisabuk',
            'npsn'            => '20010001',
            'jenjang'         => 'MI',
            'kecamatan'       => 'Kesugihan',
            'status_jamiyyah' => 'Jam\'iyyah',
        ]);

        Teacher::create([
            'nama'       => 'Guru Aktif Kalisabuk',
            'school_id'  => $school->id,
            'unit_kerja' => 'MI Ma\'arif NU 01 Kalisabuk',
            'is_active'  => true,
        ]);

        $this->artisan('teachers:check-deleted-sk', ['--school' => 'Kalisabuk'])
            ->expectsOutputToContain('Guru Aktif di Database')
            ->expectsOutputToContain('TIDAK ADA data guru dari \'Kalisabuk\' yang berstatus dihapus')
            ->assertExitCode(0);
    }

    public function test_check_deleted_teachers_detects_deleted_teacher_with_sk(): void
    {
        $school = School::create([
            'nama'            => 'MI Ma\'arif NU 01 Kalisabuk',
            'npsn'            => '20010001',
            'jenjang'         => 'MI',
            'kecamatan'       => 'Kesugihan',
            'status_jamiyyah' => 'Jam\'iyyah',
        ]);

        // 1. Guru aktif
        Teacher::create([
            'nama'       => 'Guru Satu Aktif',
            'school_id'  => $school->id,
            'unit_kerja' => 'MI Ma\'arif NU 01 Kalisabuk',
            'is_active'  => true,
        ]);

        // 2. Guru terhapus yang punya SK
        $deletedTeacherWithSk = Teacher::create([
            'nama'       => 'Guru Dua (Terhapus Punya SK)',
            'school_id'  => $school->id,
            'unit_kerja' => 'MI Ma\'arif NU 01 Kalisabuk',
            'is_active'  => true,
        ]);

        $sk = SkDocument::create([
            'nomor_sk'   => 'SK/2026/001',
            'jenis_sk'   => 'Guru Tetap',
            'jabatan'    => 'Guru Kelas',
            'nama'              => 'Guru Dua (Terhapus Punya SK)',
            'school_id'         => $school->id,
            'teacher_id'        => $deletedTeacherWithSk->id,
            'status'            => 'approved',
            'tanggal_penetapan' => '2026-01-01',
        ]);

        $deletedTeacherWithSk->delete(); // Soft delete guru

        // 3. Guru terhapus tanpa SK
        $deletedTeacherNoSk = Teacher::create([
            'nama'       => 'Guru Tiga (Terhapus Tanpa SK)',
            'school_id'  => $school->id,
            'unit_kerja' => 'MI Ma\'arif NU 01 Kalisabuk',
            'is_active'  => true,
        ]);
        $deletedTeacherNoSk->delete();

        $this->artisan('teachers:check-deleted-sk', ['--school' => 'Kalisabuk'])
            ->expectsOutputToContain('Guru Terhapus yang MEMILIKI Dokumen SK')
            ->expectsOutputToContain('DAFTAR GURU TERHAPUS YANG MEMILIKI DOKUMEN SK')
            ->expectsOutputToContain('Guru Dua (Terhapus Punya SK)')
            ->expectsOutputToContain('SK/2026/001')
            ->assertExitCode(0);
    }

    public function test_restore_deleted_teacher(): void
    {
        $school = School::create([
            'nama'            => 'MI Ma\'arif NU 01 Kalisabuk',
            'npsn'            => '20010001',
            'jenjang'         => 'MI',
            'kecamatan'       => 'Kesugihan',
            'status_jamiyyah' => 'Jam\'iyyah',
        ]);

        $deletedTeacher = Teacher::create([
            'nama'       => 'Guru Untuk Di-restore',
            'school_id'  => $school->id,
            'unit_kerja' => 'MI Ma\'arif NU 01 Kalisabuk',
            'is_active'  => true,
        ]);
        $deletedTeacher->delete();

        $this->assertTrue($deletedTeacher->fresh()->trashed());

        // Restore dengan konfirmasi 'yes'
        $this->artisan('teachers:check-deleted-sk', ['--school' => 'Kalisabuk', '--restore' => true])
            ->expectsConfirmation('Apakah Anda yakin ingin memulihkan 1 guru yang terhapus ini?', 'yes')
            ->expectsOutputToContain('Berhasil memulihkan Guru ID')
            ->assertExitCode(0);

        $this->assertFalse($deletedTeacher->fresh()->trashed());
    }
}
