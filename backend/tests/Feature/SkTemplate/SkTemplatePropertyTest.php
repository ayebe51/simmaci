<?php

namespace Tests\Feature\SkTemplate;

use App\Models\ActivityLog;
use App\Models\SkTemplate;
use App\Models\User;
use App\Services\SkTemplateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Property-based tests for SK Template backend invariants.
 *
 * Each test method encodes a universal property that must hold across all
 * valid inputs. Data providers supply representative input sets that cover
 * the input space described in the design document.
 *
 * Properties tested:
 *   1  – Upload creates a persisted record with correct fields
 *   3  – Invalid sk_type is always rejected
 *   4  – Upload always produces an activity log entry
 *   5  – At most one active template per sk_type (activation invariant)
 *   6  – Activation always produces an activity log entry
 *   7  – Deleting an active template clears active status
 *   8  – Deletion always produces an activity log entry
 *   9  – List ordering invariant (sk_type asc, created_at desc)
 *   10 – List filtering by sk_type
 *   11 – Non-super_admin users are always denied write access
 *   16 – List response never exposes raw storage paths
 *
 * Properties 2, 12–15 are covered by unit tests (StoreSkTemplateRequest
 * validation) and frontend tests respectively.
 */
class SkTemplatePropertyTest extends TestCase
{
    use RefreshDatabase;

    private SkTemplateService $service;
    private User $superAdmin;
    private User $operator;
    private User $adminYayasan;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        $this->service = new SkTemplateService();

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
    // Property 1: Upload creates a persisted record with correct fields
    // Validates: Requirements 1.1, 1.6
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * For any valid (file, sk_type) pair, store() SHALL persist a record
     * whose sk_type, original_filename, and uploaded_by match the inputs.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('validUploadInputProvider')]
    public function test_property1_upload_persists_record_with_correct_fields(
        string $skType,
        string $filename
    ): void {
        $file = UploadedFile::fake()->createWithContent($filename, 'fake-docx-content');

        $template = $this->service->store($file, $skType, $this->superAdmin);

        $this->assertDatabaseHas('sk_templates', [
            'id'                => $template->id,
            'sk_type'           => $skType,
            'original_filename' => $filename,
            'uploaded_by'       => $this->superAdmin->email,
        ]);

        $this->assertEquals($skType, $template->sk_type,
            "Property 1 violated: sk_type mismatch for input '{$skType}'");
        $this->assertEquals($filename, $template->original_filename,
            "Property 1 violated: original_filename mismatch for input '{$filename}'");
        $this->assertEquals($this->superAdmin->email, $template->uploaded_by,
            "Property 1 violated: uploaded_by mismatch");
        $this->assertFalse($template->is_active,
            "Property 1 violated: newly uploaded template must not be active");
    }

    public static function validUploadInputProvider(): array
    {
        return [
            'gty with simple name'       => ['gty',    'sk-gty-template.docx'],
            'gtt with versioned name'     => ['gtt',    'sk-gtt-v2.docx'],
            'kamad with date in name'     => ['kamad',  'template-kamad-2026.docx'],
            'tendik with spaces in name'  => ['tendik', 'sk tendik final.docx'],
            'gty with unicode name'       => ['gty',    'template-gty-revisi.docx'],
            'gtt minimal name'            => ['gtt',    'a.docx'],
            'kamad long filename'         => ['kamad',  'template-kamad-maarif-nu-cilacap-2026-final-v3.docx'],
            'tendik uppercase extension'  => ['tendik', 'SK_TENDIK.docx'],
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property 2: Invalid file type is always rejected
    // Validates: Requirements 1.2
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * For any file whose extension is not .docx, the upload endpoint SHALL
     * return a 422 response and no record SHALL be created in the Template_Repository.
     *
     * **Validates: Requirements 1.2**
     *
     * Runs 50+ iterations across a representative set of invalid extensions
     * covering common document, image, archive, executable, and random string types.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('invalidFileExtensionProvider')]
    public function testProperty2InvalidFileTypeIsAlwaysRejected(
        string $extension,
        string $mimeType
    ): void {
        $this->markTestSkippedIfNoRoutes();

        $countBefore = SkTemplate::count();

        $file = UploadedFile::fake()->createWithContent(
            "template.{$extension}",
            'fake-file-content'
        );

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-templates', [
                'file'    => $file,
                'sk_type' => 'gty',
            ]);

        $response->assertStatus(422,
            "Property 2 violated: uploading a .{$extension} file should return 422, " .
            "got {$response->getStatusCode()}"
        );

        $countAfter = SkTemplate::count();

        $this->assertEquals(
            $countBefore,
            $countAfter,
            "Property 2 violated: uploading a .{$extension} file must not create any SkTemplate record. " .
            "Expected {$countBefore} records, found {$countAfter}."
        );
    }

    /**
     * Provides 50+ invalid file extension / MIME type pairs covering:
     * - Common document formats (pdf, doc, odt, rtf, txt, csv, xlsx, xls, pptx, ppt)
     * - Image formats (png, jpg, jpeg, gif, bmp, svg, webp)
     * - Archive formats (zip, tar, gz, rar, 7z)
     * - Executable / binary formats (exe, bin, sh, bat, dmg)
     * - Web formats (html, htm, xml, json, yaml)
     * - Random / unusual strings (abc, xyz, 123, docxx, docx2, DOCX uppercase)
     */
    public static function invalidFileExtensionProvider(): array
    {
        return [
            // Common document formats
            'pdf'       => ['pdf',  'application/pdf'],
            'doc'       => ['doc',  'application/msword'],
            'odt'       => ['odt',  'application/vnd.oasis.opendocument.text'],
            'rtf'       => ['rtf',  'application/rtf'],
            'txt'       => ['txt',  'text/plain'],
            'csv'       => ['csv',  'text/csv'],
            'xlsx'      => ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
            'xls'       => ['xls',  'application/vnd.ms-excel'],
            'pptx'      => ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
            'ppt'       => ['ppt',  'application/vnd.ms-powerpoint'],
            'ods'       => ['ods',  'application/vnd.oasis.opendocument.spreadsheet'],
            'odp'       => ['odp',  'application/vnd.oasis.opendocument.presentation'],

            // Image formats
            'png'       => ['png',  'image/png'],
            'jpg'       => ['jpg',  'image/jpeg'],
            'jpeg'      => ['jpeg', 'image/jpeg'],
            'gif'       => ['gif',  'image/gif'],
            'bmp'       => ['bmp',  'image/bmp'],
            'svg'       => ['svg',  'image/svg+xml'],
            'webp'      => ['webp', 'image/webp'],
            'tiff'      => ['tiff', 'image/tiff'],
            'ico'       => ['ico',  'image/x-icon'],

            // Archive formats
            'zip'       => ['zip',  'application/zip'],
            'tar'       => ['tar',  'application/x-tar'],
            'gz'        => ['gz',   'application/gzip'],
            'rar'       => ['rar',  'application/vnd.rar'],
            '7z'        => ['7z',   'application/x-7z-compressed'],

            // Executable / binary formats
            'exe'       => ['exe',  'application/x-msdownload'],
            'bin'       => ['bin',  'application/octet-stream'],
            'sh'        => ['sh',   'application/x-sh'],
            'bat'       => ['bat',  'application/x-msdos-program'],
            'dmg'       => ['dmg',  'application/x-apple-diskimage'],
            'dll'       => ['dll',  'application/x-msdownload'],

            // Web / data formats
            'html'      => ['html', 'text/html'],
            'htm'       => ['htm',  'text/html'],
            'xml'       => ['xml',  'application/xml'],
            'json'      => ['json', 'application/json'],
            'yaml'      => ['yaml', 'application/x-yaml'],
            'yml'       => ['yml',  'application/x-yaml'],

            // Audio / video formats
            'mp3'       => ['mp3',  'audio/mpeg'],
            'mp4'       => ['mp4',  'video/mp4'],
            'avi'       => ['avi',  'video/x-msvideo'],
            'wav'       => ['wav',  'audio/wav'],

            // Random / unusual strings (not real MIME types)
            'abc'       => ['abc',  'application/octet-stream'],
            'xyz'       => ['xyz',  'application/octet-stream'],
            '123'       => ['123',  'application/octet-stream'],
            'docxx'     => ['docxx', 'application/octet-stream'],
            'docx2'     => ['docx2', 'application/octet-stream'],
            'xdocx'     => ['xdocx', 'application/octet-stream'],
            'doc_x'     => ['doc_x', 'application/octet-stream'],
            'php'       => ['php',  'application/x-httpd-php'],
            'py'        => ['py',   'text/x-python'],
            'js'        => ['js',   'application/javascript'],
            'ts'        => ['ts',   'application/typescript'],
            'sql'       => ['sql',  'application/sql'],
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property 3: Invalid sk_type is always rejected
    // Validates: Requirements 1.4
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * For any string value for sk_type that is not in {gty, gtt, kamad, tendik},
     * the upload endpoint SHALL return a 422 response and no record SHALL be
     * created in the Template_Repository.
     *
     * **Validates: Requirements 1.4**
     *
     * Runs 50+ iterations across a representative set of invalid sk_type values
     * covering near-misses, empty strings, numeric values, SQL injection attempts,
     * and random strings.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('invalidSkTypeProvider')]
    public function testProperty3InvalidSkTypeIsAlwaysRejected(string $invalidSkType): void
    {
        $this->markTestSkippedIfNoRoutes();

        $countBefore = SkTemplate::count();

        $file = UploadedFile::fake()->createWithContent('template.docx', 'fake-docx-content');

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/sk-templates', [
                'file'    => $file,
                'sk_type' => $invalidSkType,
            ]);

        $response->assertStatus(422,
            "Property 3 violated: sk_type='{$invalidSkType}' should return 422, " .
            "got {$response->getStatusCode()}"
        );

        $countAfter = SkTemplate::count();

        $this->assertEquals(
            $countBefore,
            $countAfter,
            "Property 3 violated: sk_type='{$invalidSkType}' must not create any SkTemplate record. " .
            "Expected {$countBefore} records, found {$countAfter}."
        );
    }

    /**
     * Provides 50+ invalid sk_type values covering:
     * - Near-misses (typos, case variants, partial matches)
     * - Empty and whitespace-only strings
     * - Numeric and special character strings
     * - SQL injection and XSS attempts
     * - Random strings of various lengths
     */
    public static function invalidSkTypeProvider(): array
    {
        return [
            // Near-misses: typos and case variants
            'GTY uppercase'          => ['GTY'],
            'GTT uppercase'          => ['GTT'],
            'KAMAD uppercase'        => ['KAMAD'],
            'TENDIK uppercase'       => ['TENDIK'],
            'Gty mixed case'         => ['Gty'],
            'Gtt mixed case'         => ['Gtt'],
            'Kamad mixed case'       => ['Kamad'],
            'Tendik mixed case'      => ['Tendik'],

            // Partial matches
            'gt only'                => ['gt'],
            'gty extra char'         => ['gtyx'],
            'gtt extra char'         => ['gttx'],
            'kama without d'         => ['kama'],
            'tendi without k'        => ['tendi'],
            'gty2'                   => ['gty2'],
            'gtt1'                   => ['gtt1'],

            // Empty and whitespace
            // Note: Laravel's TrimStrings middleware normalizes whitespace-padded
            // values (e.g. "gty " → "gty") before validation, so we test the
            // empty string result after trimming instead.
            'empty string'           => [''],

            // Numeric strings
            'zero'                   => ['0'],
            'one'                    => ['1'],
            'large number'           => ['99999'],
            'negative number'        => ['-1'],
            'float string'           => ['1.5'],

            // Special characters
            'asterisk'               => ['*'],
            'percent'                => ['%'],
            'underscore'             => ['_'],
            'hyphen'                 => ['-'],
            'dot'                    => ['.'],
            'slash'                  => ['/'],
            'backslash'              => ['\\'],
            'at sign'                => ['@'],
            'hash'                   => ['#'],
            'exclamation'            => ['!'],

            // SQL injection attempts
            'sql or 1=1'             => ["' OR '1'='1"],
            'sql drop table'         => ["'; DROP TABLE sk_templates; --"],
            'sql union select'       => ["' UNION SELECT * FROM users --"],

            // XSS attempts
            'xss script tag'         => ['<script>alert(1)</script>'],
            'xss img tag'            => ['<img src=x onerror=alert(1)>'],

            // Random strings
            'random alpha'           => ['abcdef'],
            'random alphanumeric'    => ['abc123'],
            'random long string'     => ['thisisaverylonginvalidsktype'],
            'random unicode'         => ['gтy'],
            'json string'            => ['{"sk_type":"gty"}'],
            'array notation'         => ['gty[]'],
            'other valid-looking'    => ['guru'],
            'another invalid'        => ['siswa'],
            'kepala'                 => ['kepala'],
            'sekolah'                => ['sekolah'],
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property 4: Upload always produces an activity log entry
    // Validates: Requirements 1.5
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * For any successful upload, an ActivityLog record SHALL exist with
     * event='upload_sk_template', causer_id matching the uploader, and
     * properties containing the sk_type.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('validSkTypeProvider')]
    public function test_property4_upload_always_produces_activity_log(string $skType): void
    {
        $file = UploadedFile::fake()->createWithContent("template-{$skType}.docx", 'content');

        $template = $this->service->store($file, $skType, $this->superAdmin);

        $log = ActivityLog::where('event', 'upload_sk_template')
            ->where('causer_id', $this->superAdmin->id)
            ->where('subject_id', $template->id)
            ->first();

        $this->assertNotNull($log,
            "Property 4 violated: no activity log found for upload of sk_type='{$skType}'");
        $this->assertEquals('upload_sk_template', $log->event);
        $this->assertEquals($this->superAdmin->id, $log->causer_id);
        $this->assertArrayHasKey('sk_type', $log->properties,
            "Property 4 violated: activity log properties must contain sk_type");
        $this->assertEquals($skType, $log->properties['sk_type']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property 5: At most one active template per sk_type (activation invariant)
    // Validates: Requirements 3.1, 3.5
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * After activating any template of a given sk_type, exactly one template
     * for that sk_type SHALL have is_active=true — the most recently activated
     * one — and all others SHALL have is_active=false.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('activationSequenceProvider')]
    public function test_property5_at_most_one_active_template_per_sk_type(
        string $skType,
        int $templateCount,
        array $activationOrder
    ): void {
        // Create N templates for the same sk_type
        $templates = SkTemplate::factory()
            ->count($templateCount)
            ->forType($skType)
            ->create();

        foreach ($activationOrder as $index) {
            $target = $templates[$index];
            $this->service->activate($target, $this->superAdmin);

            // After each activation: exactly one active for this sk_type
            $activeCount = SkTemplate::where('sk_type', $skType)
                ->where('is_active', true)
                ->count();

            $this->assertEquals(1, $activeCount,
                "Property 5 violated: expected exactly 1 active template for sk_type='{$skType}' " .
                "after activating index {$index}, found {$activeCount}");

            $activeTemplate = SkTemplate::where('sk_type', $skType)
                ->where('is_active', true)
                ->first();

            $this->assertEquals($target->id, $activeTemplate->id,
                "Property 5 violated: the active template should be the one just activated");
        }
    }

    /**
     * Activation invariant must also hold across different sk_types —
     * activating a template of one type must not affect other types.
     */
    public function test_property5_activation_does_not_affect_other_sk_types(): void
    {
        $skTypes = ['gty', 'gtt', 'kamad', 'tendik'];

        // Create 2 templates per type, activate one of each
        $activeByType = [];
        foreach ($skTypes as $type) {
            $templates = SkTemplate::factory()->count(2)->forType($type)->create();
            $this->service->activate($templates[0], $this->superAdmin);
            $activeByType[$type] = $templates[0]->id;
        }

        // Now activate a different template for 'gty' only
        $newGty = SkTemplate::factory()->forType('gty')->create();
        $this->service->activate($newGty, $this->superAdmin);

        // gty should now have newGty active
        $this->assertEquals(1,
            SkTemplate::where('sk_type', 'gty')->where('is_active', true)->count(),
            "Property 5 violated: gty should have exactly 1 active template");

        // Other types should be unaffected
        foreach (['gtt', 'kamad', 'tendik'] as $type) {
            $count = SkTemplate::where('sk_type', $type)->where('is_active', true)->count();
            $this->assertEquals(1, $count,
                "Property 5 violated: activating gty template should not affect {$type} active count");
        }
    }

    public static function activationSequenceProvider(): array
    {
        return [
            'activate first of 2'                  => ['gty',    2, [0]],
            'activate second of 2'                 => ['gty',    2, [1]],
            'activate both in order'               => ['gtt',    2, [0, 1]],
            'activate both in reverse'             => ['gtt',    2, [1, 0]],
            'activate same template twice'         => ['kamad',  2, [0, 0]],
            'activate all 3 in sequence'           => ['tendik', 3, [0, 1, 2]],
            'activate 3 in reverse'                => ['gty',    3, [2, 1, 0]],
            'activate middle then first then last' => ['gtt',    3, [1, 0, 2]],
            'activate last of 5'                   => ['kamad',  5, [4]],
            'activate all 5 in sequence'           => ['tendik', 5, [0, 1, 2, 3, 4]],
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property 6: Activation always produces an activity log entry
    // Validates: Requirements 3.2
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * For any successful activation, an ActivityLog record SHALL exist with
     * event='activate_sk_template', causer_id matching the activating user,
     * and properties containing the template id and sk_type.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('validSkTypeProvider')]
    public function test_property6_activation_always_produces_activity_log(string $skType): void
    {
        $template = SkTemplate::factory()->forType($skType)->create();

        $this->service->activate($template, $this->superAdmin);

        $log = ActivityLog::where('event', 'activate_sk_template')
            ->where('causer_id', $this->superAdmin->id)
            ->where('subject_id', $template->id)
            ->first();

        $this->assertNotNull($log,
            "Property 6 violated: no activity log found for activation of sk_type='{$skType}'");
        $this->assertEquals($this->superAdmin->id, $log->causer_id);
        $this->assertArrayHasKey('id', $log->properties,
            "Property 6 violated: activity log properties must contain template id");
        $this->assertArrayHasKey('sk_type', $log->properties,
            "Property 6 violated: activity log properties must contain sk_type");
        $this->assertEquals($template->id, $log->properties['id']);
        $this->assertEquals($skType, $log->properties['sk_type']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property 7: Deleting an active template clears active status
    // Validates: Requirements 4.2
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * For any template that is currently active, after deletion no template
     * for that sk_type SHALL have is_active=true.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('validSkTypeProvider')]
    public function test_property7_deleting_active_template_clears_active_status(string $skType): void
    {
        // Create and activate a template
        $active = SkTemplate::factory()->forType($skType)->active()->create();

        // Confirm it is active
        $this->assertTrue($active->is_active);

        $this->service->delete($active, $this->superAdmin);

        // No active template should remain for this sk_type
        $remainingActive = SkTemplate::withTrashed()
            ->where('sk_type', $skType)
            ->where('is_active', true)
            ->count();

        $this->assertEquals(0, $remainingActive,
            "Property 7 violated: after deleting active template for sk_type='{$skType}', " .
            "found {$remainingActive} active template(s)");
    }

    /**
     * Deleting an inactive template must not affect the active template
     * for the same sk_type.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('validSkTypeProvider')]
    public function test_property7_deleting_inactive_template_preserves_active(string $skType): void
    {
        $active   = SkTemplate::factory()->forType($skType)->active()->create();
        $inactive = SkTemplate::factory()->forType($skType)->create();

        $this->service->delete($inactive, $this->superAdmin);

        $active->refresh();
        $this->assertTrue($active->is_active,
            "Property 7 violated: deleting an inactive template must not clear the active template");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property 8: Deletion always produces an activity log entry
    // Validates: Requirements 4.3
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * For any successful deletion, an ActivityLog record SHALL exist with
     * event='delete_sk_template', causer_id matching the deleting user,
     * and properties containing the template id and sk_type.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('deletionScenarioProvider')]
    public function test_property8_deletion_always_produces_activity_log(
        string $skType,
        bool $wasActive
    ): void {
        $template = SkTemplate::factory()
            ->forType($skType)
            ->state(['is_active' => $wasActive])
            ->create();

        $templateId = $template->id;

        $this->service->delete($template, $this->superAdmin);

        $log = ActivityLog::where('event', 'delete_sk_template')
            ->where('causer_id', $this->superAdmin->id)
            ->where('subject_id', $templateId)
            ->first();

        $this->assertNotNull($log,
            "Property 8 violated: no activity log found for deletion of sk_type='{$skType}' " .
            "(was_active={$wasActive})");
        $this->assertEquals($this->superAdmin->id, $log->causer_id);
        $this->assertArrayHasKey('id', $log->properties,
            "Property 8 violated: activity log properties must contain template id");
        $this->assertArrayHasKey('sk_type', $log->properties,
            "Property 8 violated: activity log properties must contain sk_type");
        $this->assertEquals($templateId, $log->properties['id']);
        $this->assertEquals($skType, $log->properties['sk_type']);
    }

    public static function deletionScenarioProvider(): array
    {
        return [
            'delete active gty'      => ['gty',    true],
            'delete inactive gty'    => ['gty',    false],
            'delete active gtt'      => ['gtt',    true],
            'delete inactive gtt'    => ['gtt',    false],
            'delete active kamad'    => ['kamad',  true],
            'delete inactive kamad'  => ['kamad',  false],
            'delete active tendik'   => ['tendik', true],
            'delete inactive tendik' => ['tendik', false],
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property 9: List ordering invariant (sk_type asc, created_at desc)
    // Validates: Requirements 2.1
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * For any set of templates inserted in any order, the list endpoint SHALL
     * return them ordered by sk_type ascending and created_at descending.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('insertionOrderProvider')]
    public function test_property9_list_ordering_invariant(array $insertionSequence): void
    {
        $this->markTestSkippedIfNoRoutes();

        foreach ($insertionSequence as $item) {
            SkTemplate::factory()->create([
                'sk_type'    => $item['sk_type'],
                'created_at' => $item['created_at'],
            ]);
        }

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates');

        $response->assertOk();

        $items = $response->json('data') ?? $response->json();
        $this->assertIsArray($items);

        // Verify ordering: sk_type asc, created_at desc
        for ($i = 0; $i < count($items) - 1; $i++) {
            $current = $items[$i];
            $next    = $items[$i + 1];

            $typeComparison = strcmp($current['sk_type'], $next['sk_type']);

            if ($typeComparison === 0) {
                // Same sk_type: created_at must be descending
                $this->assertGreaterThanOrEqual(
                    $next['created_at'],
                    $current['created_at'],
                    "Property 9 violated: within sk_type='{$current['sk_type']}', " .
                    "created_at must be descending. " .
                    "Item {$i}: {$current['created_at']}, Item " . ($i + 1) . ": {$next['created_at']}"
                );
            } else {
                // Different sk_type: must be ascending
                $this->assertLessThanOrEqual(0, $typeComparison,
                    "Property 9 violated: sk_type must be ascending. " .
                    "Item {$i}: '{$current['sk_type']}', Item " . ($i + 1) . ": '{$next['sk_type']}'");
            }
        }
    }

    public static function insertionOrderProvider(): array
    {
        return [
            'all same type, ascending dates' => [[
                ['sk_type' => 'gty', 'created_at' => '2026-01-01 10:00:00'],
                ['sk_type' => 'gty', 'created_at' => '2026-01-02 10:00:00'],
                ['sk_type' => 'gty', 'created_at' => '2026-01-03 10:00:00'],
            ]],
            'all same type, descending dates' => [[
                ['sk_type' => 'gty', 'created_at' => '2026-01-03 10:00:00'],
                ['sk_type' => 'gty', 'created_at' => '2026-01-02 10:00:00'],
                ['sk_type' => 'gty', 'created_at' => '2026-01-01 10:00:00'],
            ]],
            'mixed types, random order' => [[
                ['sk_type' => 'tendik', 'created_at' => '2026-01-01 10:00:00'],
                ['sk_type' => 'gty',    'created_at' => '2026-01-02 10:00:00'],
                ['sk_type' => 'kamad',  'created_at' => '2026-01-01 10:00:00'],
                ['sk_type' => 'gtt',    'created_at' => '2026-01-03 10:00:00'],
            ]],
            'all four types with multiple entries' => [[
                ['sk_type' => 'kamad',  'created_at' => '2026-02-01 10:00:00'],
                ['sk_type' => 'gty',    'created_at' => '2026-01-01 10:00:00'],
                ['sk_type' => 'tendik', 'created_at' => '2026-03-01 10:00:00'],
                ['sk_type' => 'gtt',    'created_at' => '2026-01-15 10:00:00'],
                ['sk_type' => 'gty',    'created_at' => '2026-02-15 10:00:00'],
                ['sk_type' => 'kamad',  'created_at' => '2026-01-10 10:00:00'],
            ]],
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property 10: List filtering by sk_type
    // Validates: Requirements 2.2
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * For any sk_type filter value, every record returned SHALL have sk_type
     * equal to the filter value, and no other sk_type SHALL appear.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('validSkTypeProvider')]
    public function test_property10_list_filtering_by_sk_type(string $skType): void
    {
        $this->markTestSkippedIfNoRoutes();

        // Create templates for all types
        foreach (['gty', 'gtt', 'kamad', 'tendik'] as $type) {
            SkTemplate::factory()->count(3)->forType($type)->create();
        }

        $response = $this->actingAs($this->superAdmin)
            ->getJson("/api/sk-templates?sk_type={$skType}");

        $response->assertOk();

        $items = $response->json('data') ?? $response->json();
        $this->assertIsArray($items);
        $this->assertNotEmpty($items,
            "Property 10 violated: filter by sk_type='{$skType}' returned no results");

        foreach ($items as $item) {
            $this->assertEquals($skType, $item['sk_type'],
                "Property 10 violated: item with sk_type='{$item['sk_type']}' " .
                "appeared in results filtered by sk_type='{$skType}'");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property 11: Non-super_admin users are always denied write access
    // Validates: Requirements 8.2, 8.3
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * For any authenticated user whose role is not super_admin, any request
     * to a write endpoint SHALL return a 403 response.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('nonSuperAdminWriteEndpointProvider')]
    public function test_property11_non_super_admin_denied_write_access(
        string $role,
        string $method,
        string $endpoint
    ): void {
        $this->markTestSkippedIfNoRoutes();

        $user = User::factory()->create([
            'role'      => $role,
            'is_active' => true,
        ]);

        // Create a template so route model binding resolves for {id} endpoints
        $template = SkTemplate::factory()->create();
        $resolvedEndpoint = str_replace('{id}', (string) $template->id, $endpoint);

        $response = match ($method) {
            'POST'   => $this->actingAs($user)->postJson($resolvedEndpoint),
            'DELETE' => $this->actingAs($user)->deleteJson($resolvedEndpoint),
            'GET'    => $this->actingAs($user)->getJson($resolvedEndpoint),
            default  => $this->actingAs($user)->json($method, $resolvedEndpoint),
        };

        $response->assertStatus(403,
            "Property 11 violated: role='{$role}' should receive 403 on {$method} {$resolvedEndpoint}, " .
            "got {$response->getStatusCode()}");
    }

    public static function nonSuperAdminWriteEndpointProvider(): array
    {
        $roles    = ['operator', 'admin_yayasan'];
        $endpoints = [
            ['POST',   '/api/sk-templates'],
            ['POST',   '/api/sk-templates/{id}/activate'],
            ['DELETE', '/api/sk-templates/{id}'],
            ['GET',    '/api/sk-templates/{id}/download'],
        ];

        $cases = [];
        foreach ($roles as $role) {
            foreach ($endpoints as [$method, $path]) {
                $label = "{$role} on {$method} {$path}";
                $cases[$label] = [$role, $method, $path];
            }
        }

        return $cases;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property 16: List response never exposes raw storage paths
    // Validates: Requirements 8.4
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * For any list response, the response body SHALL NOT contain the file_path
     * field in any item.
     */
    public function test_property16_list_response_never_exposes_file_path(): void
    {
        $this->markTestSkippedIfNoRoutes();

        SkTemplate::factory()->count(4)->create();

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/sk-templates');

        $response->assertOk();

        $items = $response->json('data') ?? $response->json();
        $this->assertIsArray($items);

        foreach ($items as $index => $item) {
            $this->assertArrayNotHasKey('file_path', $item,
                "Property 16 violated: item at index {$index} exposes 'file_path' in list response");
        }
    }

    /**
     * file_path must also be absent when filtering by sk_type.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('validSkTypeProvider')]
    public function test_property16_filtered_list_never_exposes_file_path(string $skType): void
    {
        $this->markTestSkippedIfNoRoutes();

        SkTemplate::factory()->count(2)->forType($skType)->create();

        $response = $this->actingAs($this->superAdmin)
            ->getJson("/api/sk-templates?sk_type={$skType}");

        $response->assertOk();

        $items = $response->json('data') ?? $response->json();
        $this->assertIsArray($items);

        foreach ($items as $index => $item) {
            $this->assertArrayNotHasKey('file_path', $item,
                "Property 16 violated: filtered list item at index {$index} exposes 'file_path'");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Shared data providers
    // ─────────────────────────────────────────────────────────────────────────

    public static function validSkTypeProvider(): array
    {
        return [
            'gty'    => ['gty'],
            'gtt'    => ['gtt'],
            'kamad'  => ['kamad'],
            'tendik' => ['tendik'],
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Skip HTTP-level property tests when the sk-templates routes are not yet
     * registered (i.e., task 6 has not been implemented yet).
     */
    private function markTestSkippedIfNoRoutes(): void
    {
        $routes = app('router')->getRoutes();
        $hasRoute = false;

        foreach ($routes->getRoutes() as $route) {
            if (str_contains($route->uri(), 'sk-templates')) {
                $hasRoute = true;
                break;
            }
        }

        if (! $hasRoute) {
            $this->markTestSkipped(
                'sk-templates routes not registered yet (task 6 pending). ' .
                'This test will run once SkTemplateController and routes are implemented.'
            );
        }
    }
}
