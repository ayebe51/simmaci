<?php

namespace Tests\Feature;

use App\Models\SkTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SkTemplateDownloadTest extends TestCase
{
    use RefreshDatabase;

    protected User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'email' => 'admin@test.com',
        ]);
    }

    /** @test */
    public function it_returns_404_when_no_active_template_exists()
    {
        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates/active?sk_type=surat_permohonan');

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Tidak ada template aktif untuk jenis SK ini.',
            ]);
    }

    /** @test */
    public function it_returns_active_template_with_file_url()
    {
        Storage::fake('public');

        $file = UploadedFile::fake()->create('template.docx', 100, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        // Upload template
        $uploadResponse = $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-templates', [
                'file' => $file,
                'sk_type' => 'surat_permohonan',
            ]);

        $uploadResponse->assertStatus(201);

        // Response structure: { success: true, data: { id, ... } }
        $templateId = $uploadResponse->json('data.id') ?? $uploadResponse->json('id');

        // Verify file was stored
        $template = SkTemplate::find($templateId);
        $this->assertNotNull($template, "Template with ID {$templateId} should exist");
        Storage::disk('public')->assertExists($template->file_path);

        // Activate template
        $this->actingAs($this->superAdmin)
            ->postJson("/api/sk-templates/{$templateId}/activate")
            ->assertStatus(200);

        // Get active template
        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates/active?sk_type=surat_permohonan');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'id',
                    'sk_type',
                    'original_filename',
                    'is_active',
                    'file_url',
                ],
            ])
            ->assertJson([
                'success' => true,
                'data' => [
                    'sk_type' => 'surat_permohonan',
                    'is_active' => true,
                ],
            ]);

        // Verify file_url is present
        $this->assertNotNull($response->json('data.file_url'));
        $this->assertStringContainsString('sk-templates/', $response->json('data.file_url'));
    }

    /** @test */
    public function it_returns_404_when_template_file_is_missing()
    {
        Storage::fake('public');

        // Create template record without actual file
        $template = SkTemplate::create([
            'sk_type' => 'surat_permohonan',
            'original_filename' => 'missing.docx',
            'file_path' => 'sk-templates/missing.docx',
            'disk' => 'public',
            'is_active' => true,
            'uploaded_by' => $this->superAdmin->email,
        ]);

        // Try to get active template
        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates/active?sk_type=surat_permohonan');

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'File template tidak ditemukan di storage.',
            ]);
    }

    /** @test */
    public function it_requires_sk_type_parameter()
    {
        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates/active');

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Parameter sk_type wajib diisi.',
            ]);
    }

    /** @test */
    public function it_only_returns_active_template()
    {
        Storage::fake('public');

        // Create two templates
        $file1 = UploadedFile::fake()->create('template1.docx', 100);
        $file2 = UploadedFile::fake()->create('template2.docx', 100);

        // Upload first template
        $response1 = $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-templates', [
                'file' => $file1,
                'sk_type' => 'surat_permohonan',
            ]);

        $template1Id = $response1->json('data.id') ?? $response1->json('id');

        // Upload second template
        $response2 = $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-templates', [
                'file' => $file2,
                'sk_type' => 'surat_permohonan',
            ]);

        $template2Id = $response2->json('data.id') ?? $response2->json('id');

        // Verify both files exist
        $template1 = SkTemplate::find($template1Id);
        $template2 = SkTemplate::find($template2Id);
        $this->assertNotNull($template1);
        $this->assertNotNull($template2);
        Storage::disk('public')->assertExists($template1->file_path);
        Storage::disk('public')->assertExists($template2->file_path);

        // Activate first template
        $this->actingAs($this->superAdmin)
            ->postJson("/api/sk-templates/{$template1Id}/activate");

        // Get active template - should return template1
        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates/active?sk_type=surat_permohonan');

        $response->assertStatus(200)
            ->assertJson([
                'data' => [
                    'id' => $template1Id,
                    'original_filename' => 'template1.docx',
                ],
            ]);

        // Activate second template
        $this->actingAs($this->superAdmin)
            ->postJson("/api/sk-templates/{$template2Id}/activate");

        // Get active template - should now return template2
        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates/active?sk_type=surat_permohonan');

        $response->assertStatus(200)
            ->assertJson([
                'data' => [
                    'id' => $template2Id,
                    'original_filename' => 'template2.docx',
                ],
            ]);

        // Verify first template is no longer active
        $this->assertFalse(SkTemplate::find($template1Id)->is_active);
    }

    /** @test */
    public function frontend_can_access_file_url_directly_after_interceptor()
    {
        Storage::fake('public');

        $file = UploadedFile::fake()->create('template.docx', 100);

        // Upload and activate template
        $uploadResponse = $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-templates', [
                'file' => $file,
                'sk_type' => 'surat_permohonan',
            ]);

        $templateId = $uploadResponse->json('data.id') ?? $uploadResponse->json('id');

        // Verify file exists
        $template = SkTemplate::find($templateId);
        $this->assertNotNull($template);
        Storage::disk('public')->assertExists($template->file_path);

        $this->actingAs($this->superAdmin)
            ->postJson("/api/sk-templates/{$templateId}/activate");

        // Get active template
        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates/active?sk_type=surat_permohonan');

        $response->assertStatus(200);

        $responseData = $response->json();

        // Verify response structure
        $this->assertArrayHasKey('success', $responseData);
        $this->assertArrayHasKey('data', $responseData);
        $this->assertTrue($responseData['success']);

        // Simulate interceptor behavior
        $extractedData = $responseData['data'];

        // Frontend should access file_url directly from extractedData
        $this->assertArrayHasKey('file_url', $extractedData);
        $this->assertNotNull($extractedData['file_url']);

        // This is what frontend does:
        // const fileUrl = suratPermohonanTemplate?.file_url
        $fileUrl = $extractedData['file_url'] ?? null;
        $this->assertNotNull($fileUrl);
        $this->assertStringContainsString('sk-templates/', $fileUrl);
    }

        // This is what frontend does:
        // const fileUrl = suratPermohonanTemplate?.file_url
        $fileUrl = $extractedData['file_url'] ?? null;
        $this->assertNotNull($fileUrl);
        $this->assertStringContainsString('sk-templates/', $fileUrl);
    }
}

