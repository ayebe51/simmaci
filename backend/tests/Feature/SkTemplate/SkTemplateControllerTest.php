<?php

namespace Tests\Feature\SkTemplate;

use App\Models\ActivityLog;
use App\Models\SkTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Integration tests for SkTemplateController endpoints.
 *
 * Covers:
 *   GET    /api/sk-templates              — index
 *   POST   /api/sk-templates              — store
 *   POST   /api/sk-templates/{id}/activate — activate
 *   DELETE /api/sk-templates/{id}          — destroy
 *   GET    /api/sk-templates/{id}/download — download
 *   GET    /api/sk-templates/active        — active
 *
 * Requirements: 1.1, 1.2, 1.4, 1.6, 2.1, 2.2, 3.1, 3.3, 4.1, 5.1, 6.1, 8.2, 8.3, 8.4
 */
class SkTemplateControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $operator;
    private User $adminYayasan;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        $this->superAdmin = User::factory()->create([
            'role'      => 'super_admin',
            'email'     => 'admin@test.com',
            'is_active' => true,
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'operator@test.com',
            'is_active' => true,
        ]);

        $this->adminYayasan = User::factory()->create([
            'role'      => 'admin_yayasan',
            'email'     => 'yayasan@test.com',
            'is_active' => true,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/sk-templates — index
    // Requirements: 2.1, 2.2, 8.4
    // ─────────────────────────────────────────────────────────────────────────

    public function test_index_returns_ordered_list_for_super_admin(): void
    {
        // Insert in random order; expect sk_type asc, created_at desc
        SkTemplate::factory()->create(['sk_type' => 'tendik', 'created_at' => now()->subMinutes(1)]);
        SkTemplate::factory()->create(['sk_type' => 'gty',    'created_at' => now()->subMinutes(3)]);
        SkTemplate::factory()->create(['sk_type' => 'gtt',    'created_at' => now()->subMinutes(2)]);
        SkTemplate::factory()->create(['sk_type' => 'gty',    'created_at' => now()->subMinutes(1)]);

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates');

        $response->assertOk()
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [['id', 'sk_type', 'original_filename', 'is_active', 'uploaded_by', 'created_at']],
            ]);

        $items = $response->json('data');
        $this->assertCount(4, $items);

        // Verify ordering: sk_type asc, created_at desc
        for ($i = 0; $i < count($items) - 1; $i++) {
            $curr = $items[$i];
            $next = $items[$i + 1];
            $cmp  = strcmp($curr['sk_type'], $next['sk_type']);

            if ($cmp === 0) {
                $this->assertGreaterThanOrEqual(
                    $next['created_at'],
                    $curr['created_at'],
                    "Within sk_type '{$curr['sk_type']}', created_at must be descending"
                );
            } else {
                $this->assertLessThan(0, $cmp, 'sk_type must be ascending');
            }
        }
    }

    public function test_index_supports_sk_type_filter(): void
    {
        SkTemplate::factory()->count(3)->forType('gty')->create();
        SkTemplate::factory()->count(2)->forType('gtt')->create();

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates?sk_type=gty');

        $response->assertOk();

        $items = $response->json('data');
        $this->assertCount(3, $items);

        foreach ($items as $item) {
            $this->assertEquals('gty', $item['sk_type'],
                'Filtered list must only contain the requested sk_type');
        }
    }

    /** Requirement 8.4: file_path must never appear in list responses */
    public function test_index_excludes_file_path_from_response(): void
    {
        SkTemplate::factory()->count(2)->create();

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates');

        $response->assertOk();

        foreach ($response->json('data') as $item) {
            $this->assertArrayNotHasKey('file_path', $item,
                'file_path must not be exposed in list responses (Requirement 8.4)');
        }
    }

    public function test_index_returns_empty_list_when_no_templates_exist(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates');

        $response->assertOk();
        $this->assertCount(0, $response->json('data'));
    }

    public function test_index_requires_authentication(): void
    {
        $this->getJson('/api/sk-templates')->assertUnauthorized();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/sk-templates — store
    // Requirements: 1.1, 1.2, 1.4, 1.6, 8.2, 8.3
    // ─────────────────────────────────────────────────────────────────────────

    public function test_store_valid_upload_creates_record_and_returns_201(): void
    {
        $file = UploadedFile::fake()->createWithContent('sk-gty-template.docx', 'fake-docx-content');

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-templates', [
                'file'    => $file,
                'sk_type' => 'gty',
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => ['id', 'sk_type', 'original_filename', 'is_active', 'uploaded_by', 'created_at'],
            ])
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.sk_type', 'gty')
            ->assertJsonPath('data.original_filename', 'sk-gty-template.docx')
            ->assertJsonPath('data.uploaded_by', $this->superAdmin->email)
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseHas('sk_templates', [
            'sk_type'           => 'gty',
            'original_filename' => 'sk-gty-template.docx',
            'uploaded_by'       => $this->superAdmin->email,
        ]);
    }

    /** Requirement 1.6: response must not expose file_path */
    public function test_store_response_does_not_expose_file_path(): void
    {
        $file = UploadedFile::fake()->createWithContent('template.docx', 'content');

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-templates', [
                'file'    => $file,
                'sk_type' => 'gtt',
            ]);

        $response->assertStatus(201);
        $this->assertArrayNotHasKey('file_path', $response->json('data'));
    }

    /** Requirement 1.5: activity log must be created on upload */
    public function test_store_creates_activity_log_entry(): void
    {
        $file = UploadedFile::fake()->createWithContent('template.docx', 'content');

        $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-templates', [
                'file'    => $file,
                'sk_type' => 'kamad',
            ]);

        $this->assertDatabaseHas('activity_logs', [
            'event'      => 'upload_sk_template',
            'causer_id'  => $this->superAdmin->id,
            'causer_type' => User::class,
        ]);

        $log = ActivityLog::where('event', 'upload_sk_template')
            ->where('causer_id', $this->superAdmin->id)
            ->first();

        $this->assertNotNull($log);
        $this->assertEquals('kamad', $log->properties['sk_type']);
    }

    /** Requirement 1.2: non-docx file must be rejected with 422 */
    public function test_store_rejects_non_docx_file_with_422(): void
    {
        $file = UploadedFile::fake()->createWithContent('template.pdf', 'fake-pdf-content');

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-templates', [
                'file'    => $file,
                'sk_type' => 'gty',
            ]);

        $response->assertStatus(422)
            ->assertJsonStructure(['errors' => ['file']]);

        $this->assertDatabaseCount('sk_templates', 0);
    }

    /** Requirement 1.4: invalid sk_type must be rejected with 422 */
    public function test_store_rejects_invalid_sk_type_with_422(): void
    {
        $file = UploadedFile::fake()->createWithContent('template.docx', 'content');

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-templates', [
                'file'    => $file,
                'sk_type' => 'invalid_type',
            ]);

        $response->assertStatus(422)
            ->assertJsonStructure(['errors' => ['sk_type']]);

        $this->assertDatabaseCount('sk_templates', 0);
    }

    /** Requirement 8.3: non-super_admin must receive 403 on write endpoints */
    public function test_store_returns_403_for_operator(): void
    {
        $file = UploadedFile::fake()->createWithContent('template.docx', 'content');

        $this->actingAs($this->operator)
            ->postJson('/api/sk-templates', [
                'file'    => $file,
                'sk_type' => 'gty',
            ])
            ->assertForbidden();

        $this->assertDatabaseCount('sk_templates', 0);
    }

    public function test_store_returns_403_for_admin_yayasan(): void
    {
        $file = UploadedFile::fake()->createWithContent('template.docx', 'content');

        $this->actingAs($this->adminYayasan)
            ->postJson('/api/sk-templates', [
                'file'    => $file,
                'sk_type' => 'gty',
            ])
            ->assertForbidden();
    }

    public function test_store_requires_authentication(): void
    {
        $file = UploadedFile::fake()->createWithContent('template.docx', 'content');

        $this->postJson('/api/sk-templates', [
            'file'    => $file,
            'sk_type' => 'gty',
        ])->assertUnauthorized();
    }

    public function test_store_rejects_missing_file(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-templates', ['sk_type' => 'gty'])
            ->assertStatus(422);
    }

    public function test_store_rejects_missing_sk_type(): void
    {
        $file = UploadedFile::fake()->createWithContent('template.docx', 'content');

        $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-templates', ['file' => $file])
            ->assertStatus(422);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/sk-templates/{id}/activate — activate
    // Requirements: 3.1, 3.3, 8.2, 8.3
    // ─────────────────────────────────────────────────────────────────────────

    public function test_activate_sets_single_active_and_returns_200(): void
    {
        $templateA = SkTemplate::factory()->forType('gty')->active()->create();
        $templateB = SkTemplate::factory()->forType('gty')->create();

        $response = $this->actingAs($this->superAdmin)
            ->postJson("/api/sk-templates/{$templateB->id}/activate");

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $templateB->id)
            ->assertJsonPath('data.is_active', true);

        // Requirement 3.1: exactly one active per sk_type
        $this->assertDatabaseHas('sk_templates', ['id' => $templateB->id, 'is_active' => true]);
        $this->assertDatabaseHas('sk_templates', ['id' => $templateA->id, 'is_active' => false]);

        $activeCount = SkTemplate::where('sk_type', 'gty')->where('is_active', true)->count();
        $this->assertEquals(1, $activeCount, 'Exactly one template per sk_type must be active');
    }

    public function test_activate_does_not_affect_other_sk_types(): void
    {
        $gtyActive    = SkTemplate::factory()->forType('gty')->active()->create();
        $gttActive    = SkTemplate::factory()->forType('gtt')->active()->create();
        $newGty       = SkTemplate::factory()->forType('gty')->create();

        $this->actingAs($this->superAdmin)
            ->postJson("/api/sk-templates/{$newGty->id}/activate")
            ->assertOk();

        // gtt active status must be untouched
        $this->assertDatabaseHas('sk_templates', ['id' => $gttActive->id, 'is_active' => true]);
    }

    /** Requirement 3.2: activity log must be created on activation */
    public function test_activate_creates_activity_log_entry(): void
    {
        $template = SkTemplate::factory()->forType('gty')->create();

        $this->actingAs($this->superAdmin)
            ->postJson("/api/sk-templates/{$template->id}/activate");

        $log = ActivityLog::where('event', 'activate_sk_template')
            ->where('causer_id', $this->superAdmin->id)
            ->where('subject_id', $template->id)
            ->first();

        $this->assertNotNull($log);
        $this->assertEquals($template->id, $log->properties['id']);
        $this->assertEquals('gty', $log->properties['sk_type']);
    }

    public function test_activate_returns_404_for_nonexistent_template(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-templates/99999/activate')
            ->assertNotFound();
    }

    public function test_activate_returns_403_for_operator(): void
    {
        $template = SkTemplate::factory()->create();

        $this->actingAs($this->operator)
            ->postJson("/api/sk-templates/{$template->id}/activate")
            ->assertForbidden();
    }

    public function test_activate_returns_403_for_admin_yayasan(): void
    {
        $template = SkTemplate::factory()->create();

        $this->actingAs($this->adminYayasan)
            ->postJson("/api/sk-templates/{$template->id}/activate")
            ->assertForbidden();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/sk-templates/{id} — destroy
    // Requirements: 4.1, 4.2, 4.3, 8.2, 8.3
    // ─────────────────────────────────────────────────────────────────────────

    public function test_destroy_soft_deletes_record_and_returns_200(): void
    {
        $template = SkTemplate::factory()->create();

        $response = $this->actingAs($this->superAdmin)
            ->deleteJson("/api/sk-templates/{$template->id}");

        $response->assertOk()
            ->assertJsonPath('success', true);

        $this->assertSoftDeleted('sk_templates', ['id' => $template->id]);
    }

    /** Requirement 4.2: deleting an active template must clear its active status */
    public function test_destroy_clears_active_status_when_deleting_active_template(): void
    {
        $active = SkTemplate::factory()->forType('gty')->active()->create();

        $this->actingAs($this->superAdmin)
            ->deleteJson("/api/sk-templates/{$active->id}")
            ->assertOk();

        // No active template should remain for this sk_type
        $remainingActive = SkTemplate::withTrashed()
            ->where('sk_type', 'gty')
            ->where('is_active', true)
            ->count();

        $this->assertEquals(0, $remainingActive,
            'Deleting an active template must clear its active status (Requirement 4.2)');
    }

    public function test_destroy_inactive_template_does_not_affect_active_template(): void
    {
        $active   = SkTemplate::factory()->forType('gty')->active()->create();
        $inactive = SkTemplate::factory()->forType('gty')->create();

        $this->actingAs($this->superAdmin)
            ->deleteJson("/api/sk-templates/{$inactive->id}")
            ->assertOk();

        $this->assertDatabaseHas('sk_templates', ['id' => $active->id, 'is_active' => true]);
    }

    /** Requirement 4.3: activity log must be created on deletion */
    public function test_destroy_creates_activity_log_entry(): void
    {
        $template = SkTemplate::factory()->forType('kamad')->create();
        $templateId = $template->id;

        $this->actingAs($this->superAdmin)
            ->deleteJson("/api/sk-templates/{$templateId}");

        $log = ActivityLog::where('event', 'delete_sk_template')
            ->where('causer_id', $this->superAdmin->id)
            ->where('subject_id', $templateId)
            ->first();

        $this->assertNotNull($log);
        $this->assertEquals($templateId, $log->properties['id']);
        $this->assertEquals('kamad', $log->properties['sk_type']);
    }

    public function test_destroy_returns_404_for_nonexistent_template(): void
    {
        $this->actingAs($this->superAdmin)
            ->deleteJson('/api/sk-templates/99999')
            ->assertNotFound();
    }

    public function test_destroy_returns_403_for_operator(): void
    {
        $template = SkTemplate::factory()->create();

        $this->actingAs($this->operator)
            ->deleteJson("/api/sk-templates/{$template->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('sk_templates', ['id' => $template->id, 'deleted_at' => null]);
    }

    public function test_destroy_returns_403_for_admin_yayasan(): void
    {
        $template = SkTemplate::factory()->create();

        $this->actingAs($this->adminYayasan)
            ->deleteJson("/api/sk-templates/{$template->id}")
            ->assertForbidden();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/sk-templates/{id}/download — download
    // Requirements: 5.1, 5.3, 8.2, 8.3
    // ─────────────────────────────────────────────────────────────────────────

    public function test_download_returns_url_for_super_admin(): void
    {
        $path     = 'sk-templates/test-file.docx';
        Storage::disk('public')->put($path, 'fake-docx-content');

        $template = SkTemplate::factory()->create([
            'file_path' => $path,
            'disk'      => 'public',
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->getJson("/api/sk-templates/{$template->id}/download");

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['url']]);

        $this->assertNotEmpty($response->json('data.url'));
    }

    public function test_download_returns_403_for_operator(): void
    {
        $template = SkTemplate::factory()->create();

        $this->actingAs($this->operator)
            ->getJson("/api/sk-templates/{$template->id}/download")
            ->assertForbidden();
    }

    public function test_download_returns_403_for_admin_yayasan(): void
    {
        $template = SkTemplate::factory()->create();

        $this->actingAs($this->adminYayasan)
            ->getJson("/api/sk-templates/{$template->id}/download")
            ->assertForbidden();
    }

    /** Requirement 5.2: 404 when file is missing from storage */
    public function test_download_returns_404_when_file_missing_from_storage(): void
    {
        $template = SkTemplate::factory()->create([
            'file_path' => 'sk-templates/nonexistent-file.docx',
            'disk'      => 'public',
        ]);

        $this->actingAs($this->superAdmin)
            ->getJson("/api/sk-templates/{$template->id}/download")
            ->assertNotFound();
    }

    public function test_download_returns_404_for_nonexistent_template(): void
    {
        $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates/99999/download')
            ->assertNotFound();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/sk-templates/active — active
    // Requirements: 6.1
    // ─────────────────────────────────────────────────────────────────────────

    public function test_active_returns_active_template_with_file_url(): void
    {
        $path = 'sk-templates/active-gty.docx';
        Storage::disk('public')->put($path, 'fake-docx-content');

        $template = SkTemplate::factory()->forType('gty')->active()->create([
            'file_path' => $path,
            'disk'      => 'public',
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates/active?sk_type=gty');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $template->id)
            ->assertJsonPath('data.sk_type', 'gty')
            ->assertJsonPath('data.is_active', true);

        $this->assertArrayHasKey('file_url', $response->json('data'),
            'Active template response must include file_url');
        $this->assertNotEmpty($response->json('data.file_url'));
    }

    public function test_active_returns_404_when_no_active_template_exists(): void
    {
        // Create inactive templates only
        SkTemplate::factory()->forType('gty')->create(['is_active' => false]);

        $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates/active?sk_type=gty')
            ->assertNotFound()
            ->assertJsonPath('success', false);
    }

    public function test_active_returns_404_when_no_templates_exist_for_type(): void
    {
        $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates/active?sk_type=tendik')
            ->assertNotFound();
    }

    public function test_active_returns_422_when_sk_type_param_missing(): void
    {
        $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates/active')
            ->assertStatus(422);
    }

    /** Requirement 8.4: active endpoint must not expose file_path */
    public function test_active_does_not_expose_file_path(): void
    {
        $path = 'sk-templates/active-gtt.docx';
        Storage::disk('public')->put($path, 'content');

        SkTemplate::factory()->forType('gtt')->active()->create([
            'file_path' => $path,
            'disk'      => 'public',
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates/active?sk_type=gtt');

        $response->assertOk();
        $this->assertArrayNotHasKey('file_path', $response->json('data'),
            'file_path must not be exposed in active template response (Requirement 8.4)');
    }

    /** Operator and admin_yayasan can access the active endpoint (auth only, no role restriction) */
    public function test_active_is_accessible_by_operator(): void
    {
        $path = 'sk-templates/active-kamad.docx';
        Storage::disk('public')->put($path, 'content');

        SkTemplate::factory()->forType('kamad')->active()->create([
            'file_path' => $path,
            'disk'      => 'public',
        ]);

        $this->actingAs($this->operator)
            ->getJson('/api/sk-templates/active?sk_type=kamad')
            ->assertOk();
    }

    public function test_active_requires_authentication(): void
    {
        $this->getJson('/api/sk-templates/active?sk_type=gty')
            ->assertUnauthorized();
    }
}
