<?php

namespace Tests\Feature\WaBlast;

use App\Models\User;
use App\Models\WaBlastTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Integration tests for WaBlastTemplateController.
 *
 * Covers: CRUD operations, uniqueness constraint on template name,
 * 403 for operator role.
 *
 * Requirements: 11
 */
class WaBlastTemplateControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $adminYayasan;
    private User $operator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::factory()->create([
            'role'      => 'super_admin',
            'email'     => 'superadmin@test.com',
            'is_active' => true,
        ]);

        $this->adminYayasan = User::factory()->create([
            'role'      => 'admin_yayasan',
            'email'     => 'yayasan@test.com',
            'is_active' => true,
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'operator@test.com',
            'is_active' => true,
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function createTemplate(string $name = 'Undangan Rapat', string $body = 'Yth. {{nama}} dari {{nama_sekolah}}.'): WaBlastTemplate
    {
        return WaBlastTemplate::create([
            'name'       => $name,
            'body'       => $body,
            'created_by' => $this->superAdmin->id,
        ]);
    }

    // ── Authentication ────────────────────────────────────────────────────────

    public function test_unauthenticated_user_cannot_access_templates(): void
    {
        $this->getJson('/api/wa-blast-templates')->assertStatus(401);
    }

    // ── Role Guard (403) ──────────────────────────────────────────────────────

    public function test_operator_cannot_list_templates(): void
    {
        $this->actingAs($this->operator)
            ->getJson('/api/wa-blast-templates')
            ->assertStatus(403);
    }

    public function test_operator_cannot_create_template(): void
    {
        $this->actingAs($this->operator)
            ->postJson('/api/wa-blast-templates', [
                'name' => 'Test',
                'body' => 'Isi pesan.',
            ])
            ->assertStatus(403);
    }

    public function test_operator_cannot_update_template(): void
    {
        $template = $this->createTemplate();

        $this->actingAs($this->operator)
            ->putJson("/api/wa-blast-templates/{$template->id}", [
                'name' => 'Updated',
                'body' => 'Updated body.',
            ])
            ->assertStatus(403);
    }

    public function test_operator_cannot_delete_template(): void
    {
        $template = $this->createTemplate();

        $this->actingAs($this->operator)
            ->deleteJson("/api/wa-blast-templates/{$template->id}")
            ->assertStatus(403);
    }

    // ── Index / List ──────────────────────────────────────────────────────────

    public function test_super_admin_can_list_templates(): void
    {
        $this->createTemplate('Template A');
        $this->createTemplate('Template B');

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/wa-blast-templates');

        $response->assertOk()
            ->assertJsonPath('success', true);

        $this->assertCount(2, $response->json('data'));
    }

    public function test_admin_yayasan_can_list_templates(): void
    {
        $this->createTemplate('Template Yayasan');

        $this->actingAs($this->adminYayasan)
            ->getJson('/api/wa-blast-templates')
            ->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_list_returns_empty_array_when_no_templates(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/wa-blast-templates');

        $response->assertOk();
        $this->assertCount(0, $response->json('data'));
    }

    // ── Show ──────────────────────────────────────────────────────────────────

    public function test_super_admin_can_view_template_detail(): void
    {
        $template = $this->createTemplate('Detail Template', 'Isi pesan detail.');

        $response = $this->actingAs($this->superAdmin)
            ->getJson("/api/wa-blast-templates/{$template->id}");

        $response->assertOk()
            ->assertJsonPath('data.id', $template->id)
            ->assertJsonPath('data.name', 'Detail Template')
            ->assertJsonPath('data.body', 'Isi pesan detail.');
    }

    public function test_show_returns_404_for_nonexistent_template(): void
    {
        $this->actingAs($this->superAdmin)
            ->getJson('/api/wa-blast-templates/99999')
            ->assertStatus(404);
    }

    public function test_show_returns_404_for_soft_deleted_template(): void
    {
        $template = $this->createTemplate();
        $template->delete(); // soft delete

        $this->actingAs($this->superAdmin)
            ->getJson("/api/wa-blast-templates/{$template->id}")
            ->assertStatus(404);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public function test_super_admin_can_create_template(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-templates', [
                'name' => 'Undangan Rapat Koordinasi',
                'body' => 'Yth. {{nama}} dari {{nama_sekolah}}, harap hadir.',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'Undangan Rapat Koordinasi');

        $this->assertDatabaseHas('wa_blast_templates', [
            'name'       => 'Undangan Rapat Koordinasi',
            'created_by' => $this->superAdmin->id,
        ]);
    }

    public function test_admin_yayasan_can_create_template(): void
    {
        $response = $this->actingAs($this->adminYayasan)
            ->postJson('/api/wa-blast-templates', [
                'name' => 'Template Yayasan',
                'body' => 'Pesan dari yayasan.',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('wa_blast_templates', [
            'name'       => 'Template Yayasan',
            'created_by' => $this->adminYayasan->id,
        ]);
    }

    // ── Create — Validation (422) ─────────────────────────────────────────────

    public function test_create_template_requires_name(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-templates', [
                'body' => 'Isi pesan.',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    public function test_create_template_requires_body(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-templates', [
                'name' => 'Template Tanpa Body',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['body']);
    }

    public function test_create_template_rejects_name_exceeding_255_chars(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-templates', [
                'name' => str_repeat('a', 256),
                'body' => 'Isi pesan.',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    // ── Uniqueness Constraint ─────────────────────────────────────────────────

    public function test_create_template_rejects_duplicate_name(): void
    {
        $this->createTemplate('Nama Duplikat');

        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-templates', [
                'name' => 'Nama Duplikat',
                'body' => 'Isi pesan berbeda.',
            ])
            ->assertStatus(422);
    }

    public function test_create_template_rejects_duplicate_name_case_insensitive(): void
    {
        $this->createTemplate('Undangan Rapat');

        // Same name with different casing
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-templates', [
                'name' => 'undangan rapat',
                'body' => 'Isi pesan.',
            ])
            ->assertStatus(422);
    }

    public function test_create_template_allows_same_name_after_soft_delete(): void
    {
        $template = $this->createTemplate('Nama Yang Dihapus');
        $template->delete(); // soft delete

        // Should be allowed to create with the same name after deletion
        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-templates', [
                'name' => 'Nama Yang Dihapus',
                'body' => 'Isi pesan baru.',
            ]);

        $response->assertStatus(201);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public function test_super_admin_can_update_template(): void
    {
        $template = $this->createTemplate('Template Lama', 'Body lama.');

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/wa-blast-templates/{$template->id}", [
                'name' => 'Template Baru',
                'body' => 'Body baru yang diperbarui.',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.name', 'Template Baru')
            ->assertJsonPath('data.body', 'Body baru yang diperbarui.');

        $this->assertDatabaseHas('wa_blast_templates', [
            'id'   => $template->id,
            'name' => 'Template Baru',
            'body' => 'Body baru yang diperbarui.',
        ]);
    }

    public function test_admin_yayasan_can_update_template(): void
    {
        $template = $this->createTemplate('Template Untuk Yayasan');

        $this->actingAs($this->adminYayasan)
            ->putJson("/api/wa-blast-templates/{$template->id}", [
                'name' => 'Template Diperbarui Yayasan',
                'body' => 'Body diperbarui.',
            ])
            ->assertOk();
    }

    public function test_update_returns_404_for_nonexistent_template(): void
    {
        $this->actingAs($this->superAdmin)
            ->putJson('/api/wa-blast-templates/99999', [
                'name' => 'Test',
                'body' => 'Body.',
            ])
            ->assertStatus(404);
    }

    public function test_update_template_rejects_duplicate_name_from_another_template(): void
    {
        $this->createTemplate('Template Existing');
        $templateToUpdate = $this->createTemplate('Template To Update');

        $this->actingAs($this->superAdmin)
            ->putJson("/api/wa-blast-templates/{$templateToUpdate->id}", [
                'name' => 'Template Existing', // already taken by another template
                'body' => 'Body.',
            ])
            ->assertStatus(422);
    }

    public function test_update_template_allows_keeping_same_name(): void
    {
        $template = $this->createTemplate('Nama Sama');

        // Updating with the same name (own record) should be allowed
        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/wa-blast-templates/{$template->id}", [
                'name' => 'Nama Sama',
                'body' => 'Body yang diperbarui.',
            ]);

        $response->assertOk();
    }

    public function test_update_template_rejects_duplicate_name_case_insensitive(): void
    {
        $this->createTemplate('Template Satu');
        $templateToUpdate = $this->createTemplate('Template Dua');

        $this->actingAs($this->superAdmin)
            ->putJson("/api/wa-blast-templates/{$templateToUpdate->id}", [
                'name' => 'TEMPLATE SATU', // case-insensitive duplicate
                'body' => 'Body.',
            ])
            ->assertStatus(422);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public function test_super_admin_can_delete_template(): void
    {
        $template = $this->createTemplate('Template Untuk Dihapus');

        $this->actingAs($this->superAdmin)
            ->deleteJson("/api/wa-blast-templates/{$template->id}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertSoftDeleted('wa_blast_templates', ['id' => $template->id]);
    }

    public function test_admin_yayasan_can_delete_template(): void
    {
        $template = $this->createTemplate('Template Yayasan Hapus');

        $this->actingAs($this->adminYayasan)
            ->deleteJson("/api/wa-blast-templates/{$template->id}")
            ->assertOk();

        $this->assertSoftDeleted('wa_blast_templates', ['id' => $template->id]);
    }

    public function test_delete_returns_404_for_nonexistent_template(): void
    {
        $this->actingAs($this->superAdmin)
            ->deleteJson('/api/wa-blast-templates/99999')
            ->assertStatus(404);
    }

    public function test_deleted_template_does_not_appear_in_list(): void
    {
        $this->createTemplate('Template Aktif');
        $deleted = $this->createTemplate('Template Dihapus');
        $deleted->delete();

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/wa-blast-templates');

        $response->assertOk();
        $names = collect($response->json('data'))->pluck('name')->toArray();
        $this->assertContains('Template Aktif', $names);
        $this->assertNotContains('Template Dihapus', $names);
    }

    // ── Template Variables ────────────────────────────────────────────────────

    public function test_template_body_can_contain_template_variables(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-templates', [
                'name' => 'Template Variabel',
                'body' => 'Yth. {{nama}} dari {{nama_sekolah}}, harap hadir pada rapat.',
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('wa_blast_templates', [
            'body' => 'Yth. {{nama}} dari {{nama_sekolah}}, harap hadir pada rapat.',
        ]);
    }
}
