<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\SkTemplate;
use App\Models\Teacher;
use App\Models\TeacherMutation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SkPerubahanStatusTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $operator;
    private School $school;

    public function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create([
            'nama' => 'MI Al-Ikhlas',
            'nsm'  => '111233010001',
        ]);

        $this->superAdmin = User::factory()->create([
            'role'      => 'super_admin',
            'email'     => 'admin@test.com',
            'is_active' => true,
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'operator@test.com',
            'school_id' => $this->school->id,
            'unit'      => 'MI Al-Ikhlas',
            'is_active' => true,
        ]);
    }

    /**
     * Test 1: Operator dapat mengajukan SK Perubahan Status.
     * Status guard memastikan master Teacher TIDAK berubah status secara prematur saat masih pending.
     */
    public function test_operator_can_submit_sk_perubahan_status_without_prematurely_changing_teacher(): void
    {
        $teacher = Teacher::factory()->create([
            'school_id'           => $this->school->id,
            'nama'                => 'Ahmad Subagyo',
            'status'              => 'Tendik',
            'pendidikan_terakhir' => 'SMA',
            'tmt'                 => Carbon::now()->subYears(3)->format('Y-m-d'),
        ]);

        $oldSk = SkDocument::factory()->create([
            'school_id'  => $this->school->id,
            'teacher_id' => $teacher->id,
            'nama'       => 'Ahmad Subagyo',
            'jenis_sk'   => 'SK Tenaga Kependidikan',
            'nomor_sk'   => '447/PC.L/A.II/H-34.B/24.29/5/7/2024',
            'status'     => 'active',
        ]);

        $payload = [
            'teacher_id'               => $teacher->id,
            'nama'                     => 'Ahmad Subagyo, S.Pd.',
            'gelar_baru'               => 'S.Pd.',
            'jenis_sk'                 => 'SK Perubahan Status',
            'jenis_pengajuan'          => 'new',
            'unit_kerja'               => 'MI Al-Ikhlas',
            'jabatan'                  => 'Guru Mapel',
            'sk_lama_id'               => $oldSk->id,
            'nomor_sk_lama'            => $oldSk->nomor_sk,
            'pendidikan_terakhir'      => 'S1',
            'surat_permohonan_url'     => 'https://example.com/surat.pdf',
            'nomor_surat_permohonan'   => '001/SP/V/2026',
            'tanggal_surat_permohonan' => now()->format('Y-m-d'),
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/submit-request', $payload);

        $response->assertStatus(201);

        // Pastikan record SK baru berstatus pending dan referensi SK lama tersimpan
        $this->assertDatabaseHas('sk_documents', [
            'jenis_sk'      => 'SK Perubahan Status',
            'status'        => 'pending',
            'sk_lama_id'    => $oldSk->id,
            'nomor_sk_lama' => $oldSk->nomor_sk,
            'gelar_baru'    => 'S.Pd.',
        ]);

        // Status Guard: Pastikan Teacher di tabel teachers TIDAK berubah secara prematur
        $teacher->refresh();
        $this->assertEquals('Tendik', $teacher->status);
        $this->assertEquals('Ahmad Subagyo', $teacher->nama);
    }

    /**
     * Test 2: Saat SK Perubahan Status disetujui yayasan:
     * - SK lama otomatis berstatus 'archived' dengan alasan pencabutan.
     * - Guru dengan TMT >= 2 tahun otomatis dipromosikan ke GTY dengan gelar baru.
     * - Riwayat mutasi tercatat di TeacherMutation.
     */
    public function test_approving_sk_perubahan_status_revokes_old_sk_and_promotes_tendik_to_gty(): void
    {
        $teacher = Teacher::factory()->create([
            'school_id'           => $this->school->id,
            'nama'                => 'Adinda Egi Dian Renjani Aulia',
            'status'              => 'Tendik',
            'pendidikan_terakhir' => 'SMA',
            'tmt'                 => Carbon::now()->subYears(4)->format('Y-m-d'), // 4 tahun >= 2 tahun -> GTY
        ]);

        $oldSk = SkDocument::factory()->create([
            'school_id'  => $this->school->id,
            'teacher_id' => $teacher->id,
            'nama'       => 'Adinda Egi Dian Renjani Aulia',
            'jenis_sk'   => 'SK Tenaga Kependidikan',
            'nomor_sk'   => '447/PC.L/A.II/H-34.B/24.29/5/7/2025',
            'status'     => 'active',
        ]);

        $newSk = SkDocument::factory()->create([
            'school_id'     => $this->school->id,
            'teacher_id'    => $teacher->id,
            'nama'          => 'Adinda Egi Dian Renjani Aulia, S.Pd.',
            'jenis_sk'      => 'SK Perubahan Status',
            'nomor_sk'      => '1702/PC.L/A.II/H-34.B/24.29/7/X/2026',
            'sk_lama_id'    => $oldSk->id,
            'nomor_sk_lama' => $oldSk->nomor_sk,
            'gelar_baru'    => 'S.Pd.',
            'status'        => 'pending',
        ]);

        // Admin Yayasan menyetujui SK
        $response = $this->actingAs($this->superAdmin)
            ->patchJson("/api/sk-documents/{$newSk->id}", [
                'status' => 'approved',
            ]);

        $response->assertStatus(200);

        // 1. SK lama dicabut / diarsipkan
        $oldSk->refresh();
        $this->assertEquals('archived', strtolower($oldSk->status));
        $this->assertNotNull($oldSk->archived_at);
        $this->assertStringContainsString('Dicabut dan digantikan', $oldSk->archive_reason);

        // 2. Master Guru diperbarui ke GTY dan memiliki gelar baru
        $teacher->refresh();
        $this->assertEquals('GTY', $teacher->status);
        $this->assertEquals('Adinda Egi Dian Renjani Aulia, S.Pd.', $teacher->nama);
        $this->assertEquals('S1', $teacher->pendidikan_terakhir);

        // 3. Mutasi karir tercatat
        $this->assertDatabaseHas('teacher_mutations', [
            'teacher_id' => $teacher->id,
            'from_unit'  => 'Tenaga Kependidikan',
            'to_unit'    => 'GTY',
            'sk_number'  => $newSk->nomor_sk,
        ]);
    }

    /**
     * Test 3: Tendik dengan masa kerja < 2 tahun dipromosikan ke GTT.
     */
    public function test_approving_sk_perubahan_status_promotes_tendik_to_gtt_if_tmt_less_than_2_years(): void
    {
        $teacher = Teacher::factory()->create([
            'school_id'           => $this->school->id,
            'nama'                => 'Budi Santoso',
            'status'              => 'Tendik',
            'pendidikan_terakhir' => 'D3',
            'tmt'                 => Carbon::now()->subMonths(8)->format('Y-m-d'), // 8 bulan < 2 tahun -> GTT
        ]);

        $oldSk = SkDocument::factory()->create([
            'school_id'  => $this->school->id,
            'teacher_id' => $teacher->id,
            'nama'       => 'Budi Santoso',
            'jenis_sk'   => 'SK Tenaga Kependidikan',
            'nomor_sk'   => '100/SK/TENDIK/2026',
            'status'     => 'active',
        ]);

        $newSk = SkDocument::factory()->create([
            'school_id'     => $this->school->id,
            'teacher_id'    => $teacher->id,
            'nama'          => 'Budi Santoso, S.Kom.',
            'jenis_sk'      => 'SK Perubahan Status',
            'nomor_sk'      => '1703/SK/PERUBAHAN/2026',
            'sk_lama_id'    => $oldSk->id,
            'nomor_sk_lama' => $oldSk->nomor_sk,
            'gelar_baru'    => 'S.Kom.',
            'status'        => 'pending',
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->patchJson("/api/sk-documents/{$newSk->id}", [
                'status' => 'approved',
            ]);

        $response->assertStatus(200);

        // Guru dengan TMT < 2 tahun menjadi GTT
        $teacher->refresh();
        $this->assertEquals('GTT', $teacher->status);
        $this->assertEquals('Budi Santoso, S.Kom.', $teacher->nama);
        $this->assertEquals('S1', $teacher->pendidikan_terakhir);
    }

    /**
     * Test 4: Verifikasi QR Code SK yang telah dicabut mengembalikan informasi pencabutan (bukan 404 generic).
     */
    public function test_verifying_revoked_sk_returns_revocation_info(): void
    {
        $revokedSk = SkDocument::factory()->create([
            'school_id'      => $this->school->id,
            'nomor_sk'       => '447/PC.L/A.II/H-34.B/24.29/5/7/2025',
            'status'         => 'archived',
            'archive_reason' => 'Dicabut dan digantikan oleh SK Perubahan Status No. 1702/2026',
            'archived_at'    => now(),
        ]);

        $response = $this->getJson("/api/verify/sk/{$revokedSk->nomor_sk}");

        $response->assertStatus(410);
        $response->assertJson([
            'success' => false,
            'data'    => [
                'status'   => 'archived',
                'is_valid' => false,
            ],
        ]);
    }

    /**
     * Test 5: Pengaturan Template SK menerima tipe 'perubahan_status'.
     */
    public function test_sk_template_accepts_perubahan_status_type(): void
    {
        Storage::fake('s3');

        $file = UploadedFile::fake()->create('template-perubahan-status.docx', 500, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-templates', [
                'file'    => $file,
                'sk_type' => 'perubahan_status',
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('sk_templates', [
            'sk_type' => 'perubahan_status',
        ]);
    }

    /**
     * Test 6: Batch approval juga mencabut SK lama dan mempromosikan Tendik.
     */
    public function test_batch_approval_revokes_old_sk_and_promotes_tendik(): void
    {
        $teacher = Teacher::factory()->create([
            'school_id'           => $this->school->id,
            'nama'                => 'Ratna Sari',
            'status'              => 'Tendik',
            'pendidikan_terakhir' => 'D3',
            'tmt'                 => Carbon::now()->subYears(3)->format('Y-m-d'),
        ]);

        $oldSk = SkDocument::factory()->create([
            'school_id'  => $this->school->id,
            'teacher_id' => $teacher->id,
            'nama'       => 'Ratna Sari',
            'jenis_sk'   => 'SK Tenaga Kependidikan',
            'nomor_sk'   => '500/SK/TENDIK/2025',
            'status'     => 'active',
        ]);

        $newSk = SkDocument::factory()->create([
            'school_id'     => $this->school->id,
            'teacher_id'    => $teacher->id,
            'nama'          => 'Ratna Sari, S.Pd.',
            'jenis_sk'      => 'SK Perubahan Status',
            'nomor_sk'      => '1704/SK/PERUBAHAN/2026',
            'sk_lama_id'    => $oldSk->id,
            'nomor_sk_lama' => $oldSk->nomor_sk,
            'gelar_baru'    => 'S.Pd.',
            'status'        => 'pending',
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->patchJson('/api/sk-documents/batch-status', [
                'ids'    => [$newSk->id],
                'status' => 'approved',
            ]);

        $response->assertStatus(200);

        $oldSk->refresh();
        $this->assertEquals('archived', strtolower($oldSk->status));

        $teacher->refresh();
        $this->assertEquals('GTY', $teacher->status);
        $this->assertEquals('Ratna Sari, S.Pd.', $teacher->nama);
    }
}
