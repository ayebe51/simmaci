<?php

namespace Tests\Feature\SkTemplate;

use App\Models\SkTemplate;
use App\Models\User;
use App\Services\SkTemplateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SkTemplateActivationTest extends TestCase
{
    use RefreshDatabase;

    private SkTemplateService $service;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        
        Storage::fake('public');
        
        $this->service = app(SkTemplateService::class);
        $this->admin = User::factory()->create(['role' => 'super_admin']);
    }

    /** @test */
    public function it_can_activate_a_template()
    {
        $file = UploadedFile::fake()->create('template.docx', 100);
        $template = $this->service->store($file, 'surat_permohonan', $this->admin);
        
        $this->assertFalse($template->is_active);
        
        $activated = $this->service->activate($template, $this->admin);
        
        $this->assertTrue($activated->is_active);
    }

    /** @test */
    public function it_deactivates_other_templates_when_activating_one()
    {
        // Create two templates of the same type
        $file1 = UploadedFile::fake()->create('template1.docx', 100);
        $template1 = $this->service->store($file1, 'surat_permohonan', $this->admin);
        $this->service->activate($template1, $this->admin);
        
        $file2 = UploadedFile::fake()->create('template2.docx', 100);
        $template2 = $this->service->store($file2, 'surat_permohonan', $this->admin);
        
        // Activate the second template
        $this->service->activate($template2, $this->admin);
        
        // First template should be deactivated
        $this->assertFalse($template1->fresh()->is_active);
        $this->assertTrue($template2->fresh()->is_active);
    }

    /** @test */
    public function it_can_resolve_active_template()
    {
        $file = UploadedFile::fake()->create('template.docx', 100);
        $template = $this->service->store($file, 'surat_permohonan', $this->admin);
        $this->service->activate($template, $this->admin);
        
        $resolved = $this->service->resolveActiveTemplate('surat_permohonan');
        
        $this->assertNotNull($resolved);
        $this->assertEquals($template->id, $resolved->id);
    }

    /** @test */
    public function it_returns_null_when_no_active_template_exists()
    {
        $resolved = $this->service->resolveActiveTemplate('surat_permohonan');
        
        $this->assertNull($resolved);
    }

    /** @test */
    public function active_endpoint_returns_404_when_no_template_exists()
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/sk-templates/active?sk_type=surat_permohonan');
        
        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Tidak ada template aktif untuk jenis SK ini.',
            ]);
    }

    /** @test */
    public function active_endpoint_returns_template_with_file_url()
    {
        $file = UploadedFile::fake()->create('template.docx', 100);
        $template = $this->service->store($file, 'surat_permohonan', $this->admin);
        $this->service->activate($template, $this->admin);
        
        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/sk-templates/active?sk_type=surat_permohonan');
        
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'sk_type',
                    'original_filename',
                    'is_active',
                    'file_url',
                ],
            ]);
        
        $this->assertEquals('surat_permohonan', $response->json('data.sk_type'));
        $this->assertTrue($response->json('data.is_active'));
        $this->assertNotEmpty($response->json('data.file_url'));
    }

    /** @test */
    public function active_endpoint_returns_404_when_file_is_missing()
    {
        $file = UploadedFile::fake()->create('template.docx', 100);
        $template = $this->service->store($file, 'surat_permohonan', $this->admin);
        $this->service->activate($template, $this->admin);
        
        // Delete the file from storage
        Storage::disk('public')->delete($template->file_path);
        
        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/sk-templates/active?sk_type=surat_permohonan');
        
        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'File template tidak ditemukan di storage.',
            ]);
    }

    /** @test */
    public function only_one_template_can_be_active_per_type()
    {
        $file1 = UploadedFile::fake()->create('template1.docx', 100);
        $file2 = UploadedFile::fake()->create('template2.docx', 100);
        $file3 = UploadedFile::fake()->create('template3.docx', 100);
        
        $template1 = $this->service->store($file1, 'surat_permohonan', $this->admin);
        $template2 = $this->service->store($file2, 'surat_permohonan', $this->admin);
        $template3 = $this->service->store($file3, 'surat_permohonan', $this->admin);
        
        $this->service->activate($template1, $this->admin);
        $this->service->activate($template2, $this->admin);
        $this->service->activate($template3, $this->admin);
        
        // Only template3 should be active
        $activeCount = SkTemplate::where('sk_type', 'surat_permohonan')
            ->where('is_active', true)
            ->count();
        
        $this->assertEquals(1, $activeCount);
        $this->assertTrue($template3->fresh()->is_active);
        $this->assertFalse($template1->fresh()->is_active);
        $this->assertFalse($template2->fresh()->is_active);
    }
}
