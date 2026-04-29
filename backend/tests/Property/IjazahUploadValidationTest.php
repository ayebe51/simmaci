<?php

namespace Tests\Property;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Property-Based Tests for Ijazah Upload Feature
 *
 * Feature: sk-ijazah-upload
 *
 * Properties tested:
 *   Property 7:  Penyimpanan ijazah_url adalah round-trip
 *   Property 8:  Update tanpa ijazah_url tidak mengubah nilai tersimpan
 *   Property 11: Validasi backend PDF bersifat universal
 *   Property 12: Validasi panjang ijazah_url di backend
 *
 * @group sk-ijazah-upload
 */
class IjazahUploadValidationTest extends TestCase
{
    use RefreshDatabase;

    private User $operator;
    private User $superAdmin;
    private School $school;
    private SkDocument $skDocument;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Storage::fake('s3');

        $this->school = School::factory()->create([
            'nama' => 'MI Nurul Huda Test',
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'operator@test.com',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);

        $this->superAdmin = User::factory()->create([
            'role'      => 'super_admin',
            'email'     => 'admin@test.com',
            'is_active' => true,
        ]);

        $this->skDocument = SkDocument::factory()->create([
            'school_id' => $this->school->id,
            'status'    => 'active',
        ]);
    }

    // ── Property 11: Validasi backend PDF bersifat universal ──────────────────

    /**
     * Property 11 — non-PDF files to ijazah folder must return 422
     *
     * FOR ALL requests to POST /api/media/upload with folder starting with "ijazah"
     * and a file with MIME type other than application/pdf, the server MUST
     * return HTTP 422.
     *
     * Validates: Requirements 6.1, 6.2, 6.3, 6.4
     */
    public function test_property_11_non_pdf_files_to_ijazah_folder_rejected(): void
    {
        $nonPdfMimes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'application/zip',
            'application/x-rar-compressed',
            'video/mp4',
            'audio/mpeg',
        ];

        $extensions = [
            'image/jpeg'    => 'jpg',
            'image/png'     => 'png',
            'image/gif'     => 'gif',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'text/plain'    => 'txt',
            'application/zip' => 'zip',
            'application/x-rar-compressed' => 'rar',
            'video/mp4'     => 'mp4',
            'audio/mpeg'    => 'mp3',
        ];

        $iterationCount = 0;

        // Run 100 iterations across non-PDF MIME types
        for ($i = 0; $i < 100; $i++) {
            $mime = $nonPdfMimes[$i % count($nonPdfMimes)];
            $ext  = $extensions[$mime];

            $file = UploadedFile::fake()->create("test.{$ext}", 100, $mime);

            $response = $this->actingAs($this->operator)
                ->postJson('/api/files/upload', [
                    'file'   => $file,
                    'folder' => 'ijazah/' . $this->school->id,
                ]);

            $response->assertStatus(422, "Iteration {$i}: MIME {$mime} should be rejected with 422");
            $iterationCount++;
        }

        $this->assertSame(100, $iterationCount, 'Property 11 must run exactly 100 iterations');
    }

    /**
     * Property 11 — valid PDF files to ijazah folder must succeed
     *
     * FOR ALL requests to POST /api/media/upload with folder starting with "ijazah"
     * and a valid PDF file (≤ 5120 KB), the server MUST return HTTP 200.
     *
     * Validates: Requirements 6.1, 6.3
     */
    public function test_property_11_valid_pdf_to_ijazah_folder_accepted(): void
    {
        $validSizes = [1, 100, 512, 1024, 2048, 4096, 5120]; // KB

        foreach ($validSizes as $sizeKb) {
            $file = UploadedFile::fake()->create('ijazah.pdf', $sizeKb, 'application/pdf');

            $response = $this->actingAs($this->operator)
                ->postJson('/api/files/upload', [
                    'file'   => $file,
                    'folder' => 'ijazah/' . $this->school->id,
                ]);

            $response->assertStatus(200, "PDF of size {$sizeKb}KB should be accepted");
            $response->assertJsonStructure(['path', 'disk', 'filename']);
        }
    }

    /**
     * Property 11 — files exceeding 5MB to ijazah folder must return 422
     *
     * Validates: Requirements 6.3, 6.4
     */
    public function test_property_11_oversized_files_to_ijazah_folder_rejected(): void
    {
        $oversizedKb = [5121, 6000, 8192, 10240];

        foreach ($oversizedKb as $sizeKb) {
            $file = UploadedFile::fake()->create('ijazah.pdf', $sizeKb, 'application/pdf');

            $response = $this->actingAs($this->operator)
                ->postJson('/api/files/upload', [
                    'file'   => $file,
                    'folder' => 'ijazah/' . $this->school->id,
                ]);

            $response->assertStatus(422, "PDF of size {$sizeKb}KB should be rejected");
        }
    }

    /**
     * Property 11 — non-ijazah folders should use default validation (max 10MB)
     *
     * FOR ALL requests to POST /api/media/upload with folder NOT starting with "ijazah",
     * non-PDF files should be accepted (up to 10MB).
     *
     * Validates: Requirements 6.1 (conditional validation)
     */
    public function test_property_11_non_ijazah_folder_uses_default_validation(): void
    {
        $nonIjazahFolders = ['uploads', 'documents', 'surat', 'templates', null];

        foreach ($nonIjazahFolders as $folder) {
            $file = UploadedFile::fake()->create('document.jpg', 100, 'image/jpeg');

            $payload = ['file' => $file];
            if ($folder !== null) {
                $payload['folder'] = $folder;
            }

            $response = $this->actingAs($this->operator)
                ->postJson('/api/files/upload', $payload);

            // Non-ijazah folders should accept non-PDF files
            $response->assertStatus(200, "Non-PDF file to folder '{$folder}' should be accepted");
        }
    }

    // ── Property 12: Validasi panjang ijazah_url di backend ───────────────────

    /**
     * Property 12 — ijazah_url longer than 500 chars must return 422
     *
     * FOR ALL strings with length > 500 characters, PATCH /api/sk-documents/{id}
     * with that ijazah_url MUST return HTTP 422.
     *
     * Validates: Requirements 6.5, 6.6
     */
    public function test_property_12_ijazah_url_exceeding_500_chars_rejected(): void
    {
        $iterationCount = 0;

        for ($i = 0; $i < 100; $i++) {
            $length = rand(501, 1000);
            $ijazahUrl = Str::random($length);

            $response = $this->actingAs($this->superAdmin)
                ->patchJson("/api/sk-documents/{$this->skDocument->id}", [
                    'ijazah_url' => $ijazahUrl,
                ]);

            $response->assertStatus(422, "ijazah_url of length {$length} should be rejected");
            $iterationCount++;
        }

        $this->assertSame(100, $iterationCount, 'Property 12 must run exactly 100 iterations');
    }

    /**
     * Property 12 — ijazah_url of 500 chars or less must be accepted
     *
     * FOR ALL strings with length ≤ 500 characters, PATCH /api/sk-documents/{id}
     * with that ijazah_url MUST succeed.
     *
     * Validates: Requirements 6.5
     */
    public function test_property_12_ijazah_url_within_500_chars_accepted(): void
    {
        $validLengths = [1, 10, 50, 100, 200, 300, 400, 499, 500];

        foreach ($validLengths as $length) {
            $ijazahUrl = 'ijazah/' . $this->school->id . '/' . Str::random(max(1, $length - 20)) . '.pdf';
            // Trim to exactly $length if needed
            $ijazahUrl = substr($ijazahUrl, 0, $length);

            $response = $this->actingAs($this->superAdmin)
                ->patchJson("/api/sk-documents/{$this->skDocument->id}", [
                    'ijazah_url' => $ijazahUrl,
                ]);

            $response->assertStatus(200, "ijazah_url of length {$length} should be accepted");
        }
    }

    // ── Property 7: Penyimpanan ijazah_url adalah round-trip ──────────────────

    /**
     * Property 7 — saving ijazah_url and reading it back returns identical value
     *
     * FOR ALL valid ijazah_url strings (length ≤ 500), after saving via
     * PATCH /api/sk-documents/{id}, the value read from the database MUST
     * be identical to the value that was saved.
     *
     * Validates: Requirements 3.2
     */
    public function test_property_7_ijazah_url_storage_is_round_trip(): void
    {
        $iterationCount = 0;

        for ($i = 0; $i < 100; $i++) {
            $length = rand(10, 500);
            $path = 'ijazah/' . $this->school->id . '/' . Str::random(min(40, $length - 20)) . '.pdf';
            $path = substr($path, 0, $length);

            $response = $this->actingAs($this->superAdmin)
                ->patchJson("/api/sk-documents/{$this->skDocument->id}", [
                    'ijazah_url' => $path,
                ]);

            $response->assertStatus(200);

            // Read back from database and verify round-trip
            $this->skDocument->refresh();
            $this->assertSame(
                $path,
                $this->skDocument->ijazah_url,
                "Round-trip failed for path of length {$length}"
            );

            $iterationCount++;
        }

        $this->assertSame(100, $iterationCount, 'Property 7 must run exactly 100 iterations');
    }

    // ── Property 8: Update tanpa ijazah_url tidak mengubah nilai tersimpan ────

    /**
     * Property 8 — updating without ijazah_url preserves existing value
     *
     * FOR ALL SkDocuments with a stored ijazah_url, when PATCH /api/sk-documents/{id}
     * is called WITHOUT the ijazah_url field, the stored value MUST remain unchanged.
     *
     * Validates: Requirements 3.4
     */
    public function test_property_8_update_without_ijazah_url_preserves_existing_value(): void
    {
        $iterationCount = 0;

        for ($i = 0; $i < 100; $i++) {
            // Set an original ijazah_url
            $originalPath = 'ijazah/' . $this->school->id . '/' . Str::random(40) . '.pdf';
            $this->skDocument->update(['ijazah_url' => $originalPath]);

            // Update without ijazah_url field
            $response = $this->actingAs($this->superAdmin)
                ->patchJson("/api/sk-documents/{$this->skDocument->id}", [
                    'revision_reason' => Str::random(20),
                ]);

            $response->assertStatus(200);

            // Verify ijazah_url was NOT changed
            $this->skDocument->refresh();
            $this->assertSame(
                $originalPath,
                $this->skDocument->ijazah_url,
                "Iteration {$i}: ijazah_url should not change when not included in payload"
            );

            $iterationCount++;
        }

        $this->assertSame(100, $iterationCount, 'Property 8 must run exactly 100 iterations');
    }

    /**
     * Property 8 — null ijazah_url is preserved when update excludes the field
     *
     * Validates: Requirements 3.4
     */
    public function test_property_8_null_ijazah_url_preserved_when_not_in_payload(): void
    {
        // Ensure ijazah_url is null
        $this->skDocument->update(['ijazah_url' => null]);

        // Update without ijazah_url field
        $response = $this->actingAs($this->superAdmin)
            ->patchJson("/api/sk-documents/{$this->skDocument->id}", [
                'revision_reason' => 'Test update without ijazah_url',
            ]);

        $response->assertStatus(200);

        // Verify ijazah_url remains null
        $this->skDocument->refresh();
        $this->assertNull(
            $this->skDocument->ijazah_url,
            'ijazah_url should remain null when not included in payload'
        );
    }
}
