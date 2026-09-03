<?php

namespace Tests\Feature;

use App\Models\PpdbPeriod;
use App\Models\PpdbRegistration;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PpdbTest extends TestCase
{
    use RefreshDatabase;

    protected School $school;
    protected User $operator;
    protected PpdbPeriod $period;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::create([
            'nama'        => 'MTs Ma\'arif NU 01 Cilacap',
            'npsn'        => '20360001',
            'nsm'         => '121233010001',
            'jenjang'     => 'MTs',
            'kecamatan'   => 'Cilacap Tengah',
            'status'      => 'Swasta',
            'akreditasi'  => 'A',
        ]);

        $this->operator = User::create([
            'name'      => 'Operator MTs 01',
            'email'     => 'operator@mts01.sch.id',
            'password'  => bcrypt('password123'),
            'role'      => 'operator',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);

        $this->period = PpdbPeriod::create([
            'school_id'               => $this->school->id,
            'academic_year'           => '2026/2027',
            'wave_name'               => 'Gelombang 1 Reguler',
            'start_date'              => now()->subDays(2)->toDateString(),
            'end_date'                => now()->addDays(20)->toDateString(),
            'announcement_date'       => now()->addDays(22)->toDateString(),
            'reregistration_end_date' => now()->addDays(30)->toDateString(),
            'quota'                   => 120,
            'is_active'               => true,
        ]);
    }

    public function test_public_can_get_schools_with_active_ppdb(): void
    {
        $response = $this->getJson('/api/ppdb/schools');
        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonFragment(['nama' => 'MTs Ma\'arif NU 01 Cilacap']);
    }

    public function test_public_can_register_new_student(): void
    {
        $payload = [
            'school_id'     => $this->school->id,
            'period_id'     => $this->period->id,
            'track'         => 'reguler',
            'nisn'          => '0089123456',
            'nik'           => '3301011234560001',
            'nama_lengkap'  => 'Muhammad Azka Pratama',
            'jenis_kelamin' => 'L',
            'tempat_lahir'  => 'Cilacap',
            'tanggal_lahir' => '2013-05-12',
            'asal_sekolah'  => 'MI Ma\'arif NU 02 Cilacap',
            'no_whatsapp'   => '081234567890',
            'email'         => 'azka@gmail.com',
            'alamat'        => 'Jl. Kauman No. 12',
            'kecamatan'     => 'Cilacap Tengah',
            'kelurahan'     => 'Sidanegara',
            'nama_ayah'     => 'Budi Santoso',
            'nama_ibu'      => 'Siti Aminah',
        ];

        $response = $this->postJson('/api/ppdb/register', $payload);
        $response->assertStatus(201);
        $response->assertJsonPath('success', true);

        $regNumber = $response->json('data.registration_number');
        $this->assertNotEmpty($regNumber);
        $this->assertStringContainsString('PPDB-2026-MTS', $regNumber);

        $this->assertDatabaseHas('ppdb_registrations', [
            'registration_number' => $regNumber,
            'nama_lengkap'        => 'Muhammad Azka Pratama',
            'school_id'           => $this->school->id,
            'status'              => 'submitted',
        ]);
    }

    public function test_public_can_check_registration_status(): void
    {
        $reg = PpdbRegistration::create([
            'registration_number' => 'PPDB-2026-MTS0001-0001',
            'school_id'           => $this->school->id,
            'period_id'           => $this->period->id,
            'track'               => 'tahfidz',
            'nisn'                => '0089111222',
            'nik'                 => '3301019999990001',
            'nama_lengkap'        => 'Siti Fatimah Zahra',
            'jenis_kelamin'       => 'P',
            'tempat_lahir'        => 'Cilacap',
            'tanggal_lahir'       => '2013-08-20',
            'asal_sekolah'        => 'SD Negeri 01 Cilacap',
            'no_whatsapp'         => '085712345678',
            'alamat'              => 'Jl. Diponegoro No. 45',
            'kecamatan'           => 'Cilacap Tengah',
            'kelurahan'           => 'Donan',
            'status'              => 'submitted',
        ]);

        $response = $this->getJson('/api/ppdb/status?q=0089111222');
        $response->assertStatus(200);
        $response->assertJsonPath('data.registration_number', 'PPDB-2026-MTS0001-0001');
        $response->assertJsonPath('data.nama_lengkap', 'Siti Fatimah Zahra');
    }

    public function test_operator_can_verify_and_score_ppdb_applicant(): void
    {
        $reg = PpdbRegistration::create([
            'registration_number' => 'PPDB-2026-MTS0001-0002',
            'school_id'           => $this->school->id,
            'period_id'           => $this->period->id,
            'track'               => 'reguler',
            'nisn'                => '0089333444',
            'nik'                 => '3301018888880001',
            'nama_lengkap'        => 'Ahmad Rizky Fauzi',
            'jenis_kelamin'       => 'L',
            'tempat_lahir'        => 'Cilacap',
            'tanggal_lahir'       => '2013-02-10',
            'asal_sekolah'        => 'MI Ma\'arif NU 01 Cilacap',
            'no_whatsapp'         => '081399998888',
            'alamat'              => 'Jl. Kenanga No. 5',
            'kecamatan'           => 'Cilacap Tengah',
            'kelurahan'           => 'Tanjung',
            'status'              => 'submitted',
        ]);

        Sanctum::actingAs($this->operator);

        // 1. Verify document
        $verifyRes = $this->postJson("/api/ppdb/registrations/{$reg->id}/verify", [
            'status'             => 'verified',
            'verification_notes' => 'Berkas lengkap dan sesuai.',
        ]);
        $verifyRes->assertStatus(200);
        $this->assertDatabaseHas('ppdb_registrations', [
            'id'     => $reg->id,
            'status' => 'verified',
        ]);

        // 2. Score and decide acceptance
        $scoreRes = $this->postJson("/api/ppdb/registrations/{$reg->id}/score", [
            'test_score'        => 88.5,
            'interview_score'   => 90.0,
            'decision'          => 'accepted',
            'selection_notes'   => 'Lulus seleksi reguler peringkat atas.',
        ]);
        $scoreRes->assertStatus(200);
        $this->assertDatabaseHas('ppdb_registrations', [
            'id'     => $reg->id,
            'status' => 'accepted',
        ]);
    }

    public function test_reregistration_triggers_auto_sync_to_students_table(): void
    {
        $reg = PpdbRegistration::create([
            'registration_number' => 'PPDB-2026-MTS0001-0003',
            'school_id'           => $this->school->id,
            'period_id'           => $this->period->id,
            'track'               => 'prestasi',
            'nisn'                => '0089555666',
            'nik'                 => '3301017777770001',
            'nama_lengkap'        => 'Zulfa Anindya Rahma',
            'jenis_kelamin'       => 'P',
            'tempat_lahir'        => 'Cilacap',
            'tanggal_lahir'       => '2013-11-25',
            'asal_sekolah'        => 'MI Ma\'arif NU 03 Cilacap',
            'no_whatsapp'         => '082155554444',
            'alamat'              => 'Jl. Veteran No. 10',
            'kecamatan'           => 'Cilacap Tengah',
            'kelurahan'           => 'Sidanegara',
            'nama_ayah'           => 'Rahmat Hidayat',
            'nama_ibu'            => 'Nur Laila',
            'status'              => 'accepted',
        ]);

        Sanctum::actingAs($this->operator);

        // Confirm Daftar Ulang
        $response = $this->postJson("/api/ppdb/registrations/{$reg->id}/reregister");
        $response->assertStatus(200);
        $response->assertJsonPath('success', true);

        // Verify registration status updated
        $reg->refresh();
        $this->assertEquals('reregistered', $reg->status);
        $this->assertTrue($reg->is_reregistered);
        $this->assertNotNull($reg->student_id);

        // Verify AUTO-SYNC into students Master Data table!
        $this->assertDatabaseHas('students', [
            'id'            => $reg->student_id,
            'nisn'          => '0089555666',
            'nik'           => '3301017777770001',
            'nama'          => 'Zulfa Anindya Rahma',
            'school_id'     => $this->school->id,
            'nama_sekolah'  => 'MTs Ma\'arif NU 01 Cilacap',
            'kelas'         => '7', // MTs entry class level
            'status'        => 'Aktif',
            'is_verified'   => true,
        ]);

        $student = Student::find($reg->student_id);
        $this->assertNotNull($student->nomor_induk_maarif);
        $this->assertStringContainsString('NIM-', $student->nomor_induk_maarif);
    }
}
