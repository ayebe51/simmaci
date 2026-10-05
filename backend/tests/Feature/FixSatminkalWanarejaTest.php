<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FixSatminkalWanarejaTest extends TestCase
{
    use RefreshDatabase;

    public function test_dry_run_mode_does_not_modify_database(): void
    {
        $school = School::create([
            'nama' => "SMP Ma'arif NU 1 Wanareja",
            'npsn' => '20300001',
            'status' => 'swasta',
            'bentuk_pendidikan' => 'SMP',
            'alamat' => 'Wanareja',
            'kecamatan' => 'Wanareja',
            'kabupaten' => 'Cilacap',
            'provinsi' => 'Jawa Tengah',
        ]);

        $teacher = Teacher::create([
            'nama' => 'Guru Simulasi Wanareja',
            'school_id' => $school->id,
            'unit_kerja' => "SMP Ma'arif NU 1 Wanareja",
            'is_active' => true,
        ]);

        $sk = SkDocument::create([
            'nomor_sk' => 'TEST/SK/001',
            'jenis_sk' => 'Pengangkatan',
            'teacher_id' => $teacher->id,
            'nama' => $teacher->nama,
            'unit_kerja' => "SMP Ma'arif NU 1 Wanareja",
            'school_id' => $school->id,
            'tanggal_penetapan' => '2026-01-01',
            'status' => 'approved',
        ]);

        $this->artisan('teachers:fix-satminkal-wanareja')
            ->assertExitCode(0);

        $this->assertDatabaseHas('schools', [
            'id' => $school->id,
            'nama' => "SMP Ma'arif NU 1 Wanareja",
        ]);

        $this->assertDatabaseHas('teachers', [
            'id' => $teacher->id,
            'unit_kerja' => "SMP Ma'arif NU 1 Wanareja",
        ]);

        $this->assertDatabaseHas('sk_documents', [
            'id' => $sk->id,
            'unit_kerja' => "SMP Ma'arif NU 1 Wanareja",
        ]);
    }

    public function test_apply_mode_updates_school_teachers_and_sk_documents(): void
    {
        $school = School::create([
            'nama' => "SMP Ma'arif NU 1 Wanareja",
            'npsn' => '20300002',
            'status' => 'swasta',
            'bentuk_pendidikan' => 'SMP',
            'alamat' => 'Wanareja',
            'kecamatan' => 'Wanareja',
            'kabupaten' => 'Cilacap',
            'provinsi' => 'Jawa Tengah',
        ]);

        $teacher = Teacher::create([
            'nama' => 'Ahmad Wanareja',
            'school_id' => $school->id,
            'unit_kerja' => "SMP Ma'arif NU 1 Wanareja",
            'is_active' => true,
        ]);

        $sk = SkDocument::create([
            'nomor_sk' => 'TEST/SK/002',
            'jenis_sk' => 'Pengangkatan',
            'teacher_id' => $teacher->id,
            'nama' => $teacher->nama,
            'unit_kerja' => "SMP Ma'arif NU 1 Wanareja",
            'school_id' => $school->id,
            'tanggal_penetapan' => '2026-01-01',
            'status' => 'approved',
        ]);

        $this->artisan('teachers:fix-satminkal-wanareja', ['--apply' => true])
            ->assertExitCode(0);

        $this->assertDatabaseHas('schools', [
            'id' => $school->id,
            'nama' => "SMP Ma'arif NU 01 Wanareja",
        ]);

        $this->assertDatabaseHas('teachers', [
            'id' => $teacher->id,
            'unit_kerja' => "SMP Ma'arif NU 01 Wanareja",
            'school_id' => $school->id,
        ]);

        $this->assertDatabaseHas('sk_documents', [
            'id' => $sk->id,
            'unit_kerja' => "SMP Ma'arif NU 01 Wanareja",
            'school_id' => $school->id,
        ]);
    }
}
