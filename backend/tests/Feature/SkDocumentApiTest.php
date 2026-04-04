<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SkDocumentApiTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $operator;
    private School $school;

    protected function setUp(): void
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

    // ── Authentication ────────────────────────────────────────

    public function test_unauthenticated_user_cannot_access_sk_documents(): void
    {
        $response = $this->getJson('/api/sk-documents');

        $response->assertStatus(401);
    }

    // ── Index / List ──────────────────────────────────────────

    public function test_super_admin_can_list_all_sk_documents(): void
    {
        SkDocument::factory()->count(3)->create(['school_id' => $this->school->id]);

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-documents');

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [['id', 'nomor_sk', 'nama', 'jenis_sk', 'status']],
                'current_page',
                'total',
            ]);

        $this->assertCount(3, $response->json('data'));
    }

    public function test_operator_can_only_see_own_school_sk_documents(): void
    {
        // SK for operator's school
        SkDocument::factory()->count(2)->create(['school_id' => $this->school->id]);

        // SK for another school
        $otherSchool = School::factory()->create();
        SkDocument::factory()->count(3)->create(['school_id' => $otherSchool->id]);

        $response = $this->actingAs($this->operator)
            ->getJson('/api/sk-documents');

        $response->assertOk();
        $this->assertCount(2, $response->json('data'));
    }

    public function test_sk_documents_can_be_filtered_by_status(): void
    {
        SkDocument::factory()->create(['status' => 'draft', 'school_id' => $this->school->id]);
        SkDocument::factory()->create(['status' => 'approved', 'school_id' => $this->school->id]);

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-documents?status=approved');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertEquals('approved', $response->json('data.0.status'));
    }

    // ── Create ────────────────────────────────────────────────

    public function test_sk_document_can_be_created(): void
    {
        $payload = [
            'nomor_sk'          => 'SK/001/2025',
            'jenis_sk'          => 'Pengangkatan',
            'nama'              => 'Ahmad Rifai',
            'jabatan'           => 'Guru Kelas',
            'unit_kerja'        => 'MI Al-Ikhlas',
            'tanggal_penetapan' => '2025-01-15',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-documents', $payload);

        $response->assertStatus(201)
            ->assertJsonFragment([
                'nomor_sk' => 'SK/001/2025',
                'nama'     => 'Ahmad Rifai',
                'status'   => 'draft',
            ]);

        $this->assertDatabaseHas('sk_documents', [
            'nomor_sk'   => 'SK/001/2025',
            'school_id'  => $this->school->id, // Auto-resolved from unit_kerja
            'created_by' => 'admin@test.com',
        ]);
    }

    public function test_sk_document_upserts_on_duplicate_nomor_sk(): void
    {
        $sk = SkDocument::factory()->create([
            'nomor_sk'   => 'SK/DUP/001',
            'nama'       => 'Old Name',
            'school_id'  => $this->school->id,
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-documents', [
                'nomor_sk'          => 'SK/DUP/001',
                'jenis_sk'          => 'Mutasi',
                'nama'              => 'Updated Name',
                'tanggal_penetapan' => '2025-06-01',
            ]);

        $response->assertOk()
            ->assertJsonFragment(['nama' => 'Updated Name']);

        // Ensure no duplicate was created
        $this->assertEquals(1, SkDocument::where('nomor_sk', 'SK/DUP/001')->count());
    }

    public function test_sk_document_creation_requires_mandatory_fields(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-documents', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['nomor_sk', 'jenis_sk', 'nama', 'tanggal_penetapan']);
    }

    // ── Update ────────────────────────────────────────────────

    public function test_sk_document_can_be_updated(): void
    {
        $sk = SkDocument::factory()->create([
            'status'    => 'draft',
            'school_id' => $this->school->id,
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/sk-documents/{$sk->id}", [
                'status' => 'approved',
            ]);

        $response->assertOk()
            ->assertJsonFragment(['status' => 'approved']);
    }

    // ── Archive (Soft Delete) ─────────────────────────────────

    public function test_sk_document_can_be_archived(): void
    {
        $sk = SkDocument::factory()->create([
            'status'    => 'active',
            'school_id' => $this->school->id,
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->deleteJson("/api/sk-documents/{$sk->id}");

        $response->assertOk()
            ->assertJsonFragment(['success' => true]);

        $sk->refresh();
        $this->assertEquals('archived', $sk->status);
        $this->assertNotNull($sk->archived_at);
    }

    // ── Activity Logging ──────────────────────────────────────

    public function test_creating_sk_document_writes_activity_log(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-documents', [
                'nomor_sk'          => 'SK/LOG/001',
                'jenis_sk'          => 'Pengangkatan',
                'nama'              => 'Test Log',
                'tanggal_penetapan' => '2025-01-01',
            ]);

        $this->assertDatabaseHas('activity_logs', [
            'event'    => 'submit_sk',
            'log_name' => 'sk',
        ]);
    }
}
