<?php

namespace Tests\Feature;

use App\Models\HeadmasterTenure;
use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HeadmasterAutoSyncTest extends TestCase
{
    use RefreshDatabase;

    private School $school;
    private User $superAdmin;
    private Teacher $teacher1;
    private Teacher $teacher2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::create([
            'nama' => 'MI Bahrul Ulum Kamulyan',
            'nsm' => '111233010011',
            'jenjang' => 'MI',
            'kecamatan' => 'Bantarsari',
            'kepala_madrasah' => 'MOH.HAKIM, S.Pd.I',
            'kepala_whatsapp' => '085183709872',
            'kepala_nim' => 'NIM-OLD-123',
            'kepala_nuptk' => 'NUPTK-OLD-123',
            'kepala_jabatan_mulai' => '2020-01-01',
            'kepala_jabatan_selesai' => '2024-01-01',
        ]);

        $this->superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@simmaci.test',
            'password' => bcrypt('password'),
            'role' => 'super_admin',
        ]);

        $this->teacher1 = Teacher::create([
            'nama' => 'Ahmad Fathoni, M.Pd.',
            'school_id' => $this->school->id,
            'nomor_induk_maarif' => 'NIM-NEW-999',
            'nuptk' => 'NUPTK-NEW-999',
            'phone_number' => '081234567890',
            'is_active' => true,
        ]);

        $this->teacher2 = Teacher::create([
            'nama' => 'Siti Aminah, S.Ag.',
            'school_id' => $this->school->id,
            'nomor_induk_maarif' => 'NIM-NEW-888',
            'nuptk' => 'NUPTK-NEW-888',
            'phone_number' => '089876543210',
            'is_active' => true,
        ]);
    }

    public function test_headmaster_approval_automatically_syncs_to_school_profile(): void
    {
        $tenure = HeadmasterTenure::create([
            'teacher_id' => $this->teacher1->id,
            'teacher_name' => $this->teacher1->nama,
            'school_id' => $this->school->id,
            'school_name' => $this->school->nama,
            'periode' => '2024-2028',
            'start_date' => '2024-07-01',
            'end_date' => '2028-07-01',
            'status' => 'pending',
            'created_by' => 'operator@simmaci.test',
        ]);

        $response = $this->actingAs($this->superAdmin, 'sanctum')
            ->postJson("/api/headmasters/{$tenure->id}/approve", [
                'nomor_sk' => '045/SK/YAYASAN/2024',
                'tanggal_penetapan' => '2024-07-01',
            ]);

        $response->assertStatus(200);

        // 1. Verify tenure record updated
        $tenure->refresh();
        $this->assertEquals('active', $tenure->status);
        $this->assertEquals('045/SK/YAYASAN/2024', $tenure->nomor_sk);
        $this->assertEquals('2024-07-01', $tenure->tanggal_penetapan);

        // 2. Verify school profile automatically updated
        $this->school->refresh();
        $this->assertEquals('Ahmad Fathoni, M.Pd.', $this->school->kepala_madrasah);
        $this->assertEquals('NIM-NEW-999', $this->school->kepala_nim);
        $this->assertEquals('NUPTK-NEW-999', $this->school->kepala_nuptk);
        $this->assertEquals('081234567890', $this->school->kepala_whatsapp);
        $this->assertEquals('2024-07-01', $this->school->kepala_jabatan_mulai);
        $this->assertEquals('2028-07-01', $this->school->kepala_jabatan_selesai);
    }

    public function test_approving_new_headmaster_archives_previous_active_tenure(): void
    {
        // First active tenure
        $tenure1 = HeadmasterTenure::create([
            'teacher_id' => $this->teacher1->id,
            'teacher_name' => $this->teacher1->nama,
            'school_id' => $this->school->id,
            'school_name' => $this->school->nama,
            'periode' => '2020-2024',
            'start_date' => '2020-01-01',
            'end_date' => '2024-01-01',
            'status' => 'active',
            'created_by' => 'operator@simmaci.test',
        ]);

        // Second pending tenure
        $tenure2 = HeadmasterTenure::create([
            'teacher_id' => $this->teacher2->id,
            'teacher_name' => $this->teacher2->nama,
            'school_id' => $this->school->id,
            'school_name' => $this->school->nama,
            'periode' => '2024-2028',
            'start_date' => '2024-01-01',
            'end_date' => '2028-01-01',
            'status' => 'pending',
            'created_by' => 'operator@simmaci.test',
        ]);

        $response = $this->actingAs($this->superAdmin, 'sanctum')
            ->postJson("/api/headmasters/{$tenure2->id}/approve", [
                'nomor_sk' => '046/SK/YAYASAN/2024',
                'tanggal_penetapan' => '2024-01-01',
            ]);

        $response->assertStatus(200);

        // Previous tenure should be marked as completed
        $tenure1->refresh();
        $this->assertEquals('completed', $tenure1->status);

        // New tenure should be active
        $tenure2->refresh();
        $this->assertEquals('active', $tenure2->status);

        // School should be updated to teacher2
        $this->school->refresh();
        $this->assertEquals('Siti Aminah, S.Ag.', $this->school->kepala_madrasah);
        $this->assertEquals('089876543210', $this->school->kepala_whatsapp);
    }

    public function test_sync_command_reconciles_active_tenures_to_schools(): void
    {
        // Setup school with old headmaster
        $this->assertEquals('MOH.HAKIM, S.Pd.I', $this->school->kepala_madrasah);

        // An active tenure exists in DB (e.g. approved previously before auto-sync was implemented)
        HeadmasterTenure::create([
            'teacher_id' => $this->teacher1->id,
            'teacher_name' => $this->teacher1->nama,
            'school_id' => $this->school->id,
            'school_name' => $this->school->nama,
            'periode' => '2024-2028',
            'start_date' => '2024-07-01',
            'end_date' => '2028-07-01',
            'status' => 'active',
            'created_by' => 'operator@simmaci.test',
        ]);

        // Run artisan command
        $this->artisan('headmaster:sync-to-schools')
            ->assertExitCode(0);

        // School should now be synced
        $this->school->refresh();
        $this->assertEquals('Ahmad Fathoni, M.Pd.', $this->school->kepala_madrasah);
        $this->assertEquals('081234567890', $this->school->kepala_whatsapp);
        $this->assertEquals('NIM-NEW-999', $this->school->kepala_nim);
    }

    public function test_sk_document_kamad_approval_syncs_kepala_and_whatsapp(): void
    {
        $skDoc = SkDocument::create([
            'teacher_id' => $this->teacher1->id,
            'nama' => $this->teacher1->nama,
            'school_id' => $this->school->id,
            'unit_kerja' => $this->school->nama,
            'nomor_sk' => 'SK/KAMAD/TEST/001',
            'jenis_sk' => 'SK Kepala Madrasah',
            'tanggal_penetapan' => '2024-08-01',
            'status' => 'pending',
        ]);

        $response = $this->actingAs($this->superAdmin, 'sanctum')
            ->patchJson("/api/sk-documents/{$skDoc->id}", [
                'nomor_sk' => 'SK/KAMAD/TEST/001',
                'status' => 'approved',
                'tanggal_penetapan' => '2024-08-01',
            ]);

        $response->assertStatus(200);

        $this->school->refresh();
        $this->assertEquals('Ahmad Fathoni, M.Pd.', $this->school->kepala_madrasah);
        $this->assertEquals('081234567890', $this->school->kepala_whatsapp);
        $this->assertEquals('2024-08-01', $this->school->kepala_jabatan_mulai);
    }
}
