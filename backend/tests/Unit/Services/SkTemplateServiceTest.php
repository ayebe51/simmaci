<?php

namespace Tests\Unit\Services;

use App\Models\ActivityLog;
use App\Models\SkTemplate;
use App\Models\User;
use App\Services\SkTemplateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/**
 * Unit tests for SkTemplateService.
 *
 * Covers: store(), activate(), delete(), getDownloadUrl(), resolveActiveTemplate()
 * Requirements: 1.1, 1.5, 3.1, 3.2, 4.1, 4.2, 4.3, 5.1, 5.2, 6.1
 */
class SkTemplateServiceTest extends TestCase
{
    use RefreshDatabase;

    private SkTemplateService $service;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        $this->service = new SkTemplateService();

        $this->user = User::factory()->create([
            'role'      => 'super_admin',
            'email'     => 'admin@test.com',
            'is_active' => true,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // store()
    // ─────────────────────────────────────────────────────────────────────────

    public function test_store_creates_record_with_correct_fields(): void
    {
        $file = UploadedFile::fake()->createWithContent('sk-gty.docx', 'fake-content');

        $template = $this->service->store($file, 'gty', $this->user);

        $this->assertDatabaseHas('sk_templates', [
            'id'                => $template->id,
            'sk_type'           => 'gty',
            'original_filename' => 'sk-gty.docx',
            'uploaded_by'       => 'admin@test.com',
            'is_active'         => false,
        ]);
    }

    public function test_store_persists_file_to_storage(): void
    {
        $file = UploadedFile::fake()->createWithContent('sk-gtt.docx', 'fake-content');

        $template = $this->service->store($file, 'gtt', $this->user);

        Storage::disk('public')->assertExists($template->file_path);
    }

    public function test_store_file_path_is_under_sk_templates_folder(): void
    {
        $file = UploadedFile::fake()->createWithContent('template.docx', 'content');

        $template = $this->service->store($file, 'kamad', $this->user);

        $this->assertStringStartsWith('sk-templates/', $template->file_path);
        $this->assertStringEndsWith('.docx', $template->file_path);
    }

    public function test_store_logs_upload_activity_with_correct_event(): void
    {
        $file = UploadedFile::fake()->createWithContent('sk-tendik.docx', 'content');

        $template = $this->service->store($file, 'tendik', $this->user);

        $this->assertDatabaseHas('activity_logs', [
            'event'      => 'upload_sk_template',
            'causer_id'  => $this->user->id,
            'subject_id' => $template->id,
        ]);
    }

    public function test_store_activity_log_contains_sk_type_in_properties(): void
    {
        $file = UploadedFile::fake()->createWithContent('sk-gty.docx', 'content');

        $this->service->store($file, 'gty', $this->user);

        $log = ActivityLog::where('event', 'upload_sk_template')
            ->where('causer_id', $this->user->id)
            ->first();

        $this->assertNotNull($log);
        $this->assertEquals('gty', $log->properties['sk_type']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // activate()
    // ─────────────────────────────────────────────────────────────────────────

    public function test_activate_sets_template_as_active(): void
    {
        $template = SkTemplate::factory()->create(['sk_type' => 'gty', 'is_active' => false]);

        $result = $this->service->activate($template, $this->user);

        $this->assertTrue($result->is_active);
        $this->assertDatabaseHas('sk_templates', ['id' => $template->id, 'is_active' => true]);
    }

    public function test_activate_deactivates_other_templates_of_same_type(): void
    {
        $templateA = SkTemplate::factory()->create(['sk_type' => 'gty', 'is_active' => true]);
        $templateB = SkTemplate::factory()->create(['sk_type' => 'gty', 'is_active' => false]);

        $this->service->activate($templateB, $this->user);

        $this->assertDatabaseHas('sk_templates', ['id' => $templateA->id, 'is_active' => false]);
        $this->assertDatabaseHas('sk_templates', ['id' => $templateB->id, 'is_active' => true]);
    }

    public function test_activate_does_not_affect_templates_of_different_type(): void
    {
        $gtyTemplate    = SkTemplate::factory()->create(['sk_type' => 'gty',    'is_active' => true]);
        $tendikTemplate = SkTemplate::factory()->create(['sk_type' => 'tendik', 'is_active' => false]);

        $this->service->activate($tendikTemplate, $this->user);

        // gty template should remain active — different sk_type
        $this->assertDatabaseHas('sk_templates', ['id' => $gtyTemplate->id, 'is_active' => true]);
        $this->assertDatabaseHas('sk_templates', ['id' => $tendikTemplate->id, 'is_active' => true]);
    }

    public function test_activate_enforces_single_active_invariant_across_multiple_activations(): void
    {
        $templates = SkTemplate::factory()->count(3)->create(['sk_type' => 'gtt', 'is_active' => false]);

        foreach ($templates as $template) {
            $this->service->activate($template, $this->user);

            $activeCount = SkTemplate::where('sk_type', 'gtt')->where('is_active', true)->count();
            $this->assertEquals(1, $activeCount,
                "Single-active invariant violated after activating template {$template->id}");
        }
    }

    public function test_activate_logs_activity_with_correct_event(): void
    {
        $template = SkTemplate::factory()->create(['sk_type' => 'gty', 'is_active' => false]);

        $this->service->activate($template, $this->user);

        $this->assertDatabaseHas('activity_logs', [
            'event'      => 'activate_sk_template',
            'causer_id'  => $this->user->id,
            'subject_id' => $template->id,
        ]);
    }

    public function test_activate_activity_log_contains_template_id_and_sk_type(): void
    {
        $template = SkTemplate::factory()->create(['sk_type' => 'kamad', 'is_active' => false]);

        $this->service->activate($template, $this->user);

        $log = ActivityLog::where('event', 'activate_sk_template')
            ->where('causer_id', $this->user->id)
            ->first();

        $this->assertNotNull($log);
        $this->assertEquals($template->id, $log->properties['id']);
        $this->assertEquals('kamad', $log->properties['sk_type']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // delete()
    // ─────────────────────────────────────────────────────────────────────────

    public function test_delete_soft_deletes_the_record(): void
    {
        $template = SkTemplate::factory()->create(['sk_type' => 'gty', 'is_active' => false]);

        $this->service->delete($template, $this->user);

        $this->assertSoftDeleted('sk_templates', ['id' => $template->id]);
    }

    public function test_delete_clears_active_status_when_deleting_active_template(): void
    {
        $template = SkTemplate::factory()->create(['sk_type' => 'gty', 'is_active' => true]);

        $this->service->delete($template, $this->user);

        // After soft-delete, no active template should exist for this sk_type
        $activeCount = SkTemplate::where('sk_type', 'gty')->where('is_active', true)->count();
        $this->assertEquals(0, $activeCount);
    }

    public function test_delete_does_not_affect_other_templates_when_deleting_inactive(): void
    {
        $activeTemplate   = SkTemplate::factory()->create(['sk_type' => 'gty', 'is_active' => true]);
        $inactiveTemplate = SkTemplate::factory()->create(['sk_type' => 'gty', 'is_active' => false]);

        $this->service->delete($inactiveTemplate, $this->user);

        // Active template should remain untouched
        $this->assertDatabaseHas('sk_templates', ['id' => $activeTemplate->id, 'is_active' => true]);
    }

    public function test_delete_logs_activity_with_correct_event(): void
    {
        $template = SkTemplate::factory()->create(['sk_type' => 'tendik', 'is_active' => false]);

        $this->service->delete($template, $this->user);

        $this->assertDatabaseHas('activity_logs', [
            'event'     => 'delete_sk_template',
            'causer_id' => $this->user->id,
        ]);
    }

    public function test_delete_activity_log_contains_template_id_and_sk_type(): void
    {
        $template = SkTemplate::factory()->create(['sk_type' => 'gtt', 'is_active' => false]);
        $templateId = $template->id;

        $this->service->delete($template, $this->user);

        $log = ActivityLog::where('event', 'delete_sk_template')
            ->where('causer_id', $this->user->id)
            ->first();

        $this->assertNotNull($log);
        $this->assertEquals($templateId, $log->properties['id']);
        $this->assertEquals('gtt', $log->properties['sk_type']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // getDownloadUrl()
    // ─────────────────────────────────────────────────────────────────────────

    public function test_get_download_url_returns_url_for_public_disk(): void
    {
        $file = UploadedFile::fake()->createWithContent('template.docx', 'content');
        Storage::disk('public')->putFileAs('sk-templates', $file, 'test-uuid.docx');

        $template = SkTemplate::factory()->create([
            'file_path' => 'sk-templates/test-uuid.docx',
            'disk'      => 'public',
        ]);

        $url = $this->service->getDownloadUrl($template);

        $this->assertNotEmpty($url);
        $this->assertIsString($url);
    }

    public function test_get_download_url_throws_404_when_file_missing(): void
    {
        $template = SkTemplate::factory()->create([
            'file_path' => 'sk-templates/nonexistent-file.docx',
            'disk'      => 'public',
        ]);

        $this->expectException(HttpException::class);

        $this->service->getDownloadUrl($template);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // resolveActiveTemplate()
    // ─────────────────────────────────────────────────────────────────────────

    public function test_resolve_active_template_returns_active_template_when_exists(): void
    {
        $active = SkTemplate::factory()->create(['sk_type' => 'gty', 'is_active' => true]);
        SkTemplate::factory()->create(['sk_type' => 'gty', 'is_active' => false]);

        $result = $this->service->resolveActiveTemplate('gty');

        $this->assertNotNull($result);
        $this->assertEquals($active->id, $result->id);
    }

    public function test_resolve_active_template_returns_null_when_none_active(): void
    {
        SkTemplate::factory()->create(['sk_type' => 'gty', 'is_active' => false]);

        $result = $this->service->resolveActiveTemplate('gty');

        $this->assertNull($result);
    }

    public function test_resolve_active_template_returns_null_when_no_templates_exist(): void
    {
        $result = $this->service->resolveActiveTemplate('kamad');

        $this->assertNull($result);
    }

    public function test_resolve_active_template_only_returns_template_for_requested_type(): void
    {
        SkTemplate::factory()->create(['sk_type' => 'gtt',   'is_active' => true]);
        SkTemplate::factory()->create(['sk_type' => 'kamad', 'is_active' => false]);

        $result = $this->service->resolveActiveTemplate('kamad');

        $this->assertNull($result, 'Should not return active template from a different sk_type');
    }
}
