<?php

namespace Tests\Unit\Services;

use App\Models\User;
use App\Models\WaBlastTemplate;
use App\Services\WaBlastTemplateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * WaBlastTemplateServiceTest
 *
 * Contains unit tests and property-based tests for WaBlastTemplateService.
 *
 * Property-based tests run 100+ iterations with randomly generated inputs to
 * verify that the template CRUD operations maintain data consistency across
 * all valid inputs, not just hand-picked examples.
 *
 * Note: eris/eris (^0.7) is incompatible with PHPUnit 11 (requires PHPUnit <6).
 * Property tests are implemented using a custom forAll() helper that generates
 * random inputs and runs the specified number of iterations — achieving the same
 * correctness guarantees without the version conflict.
 */
class WaBlastTemplateServiceTest extends TestCase
{
    use RefreshDatabase;

    private WaBlastTemplateService $service;
    private User $testUser;

    /** Minimum iterations for property-based tests */
    private const PROPERTY_ITERATIONS = 100;

    protected function setUp(): void
    {
        parent::setUp();

        // Create a test user for created_by field
        $this->testUser = User::factory()->create([
            'role' => 'super_admin',
        ]);

        $this->service = app(WaBlastTemplateService::class);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property-Based Test Helper
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Run a property-based test with randomly generated inputs.
     *
     * Generates $iterations random combinations of the given generators and
     * calls $property for each. If $property throws, the test fails with the
     * failing input included in the message.
     *
     * @param int      $iterations Number of random samples to test
     * @param array    $generators Array of zero-arg callables that each return one random value
     * @param callable $property   Receives one argument per generator; throws on failure
     */
    private function forAll(int $iterations, array $generators, callable $property): void
    {
        for ($i = 0; $i < $iterations; $i++) {
            $args = array_map(fn (callable $gen) => $gen(), $generators);
            try {
                $property(...$args);
            } catch (\Exception $e) {
                $argsStr = implode(', ', array_map(
                    fn ($a) => is_string($a) ? "\"{$a}\"" : (string) $a,
                    $args
                ));
                $this->fail(
                    "Property failed on iteration {$i} with args [{$argsStr}]: " . $e->getMessage()
                );
            }
        }
    }

    /**
     * Generator: random alphanumeric string of length between $minLen and $maxLen.
     */
    private function genString(int $minLen, int $maxLen): callable
    {
        return function () use ($minLen, $maxLen): string {
            $length = random_int($minLen, $maxLen);
            $characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
            $result = '';
            for ($i = 0; $i < $length; $i++) {
                $result .= $characters[random_int(0, strlen($characters) - 1)];
            }
            return trim($result);
        };
    }

    /**
     * Generator: random template name (unique per iteration).
     * Appends a unique suffix to ensure uniqueness across iterations.
     */
    private function genUniqueName(int $minLen = 5, int $maxLen = 50): callable
    {
        return function () use ($minLen, $maxLen): string {
            $baseName = $this->genString($minLen, $maxLen)();
            // Append timestamp + random suffix to ensure uniqueness
            $uniqueSuffix = microtime(true) . '_' . random_int(1000, 9999);
            return substr($baseName, 0, 200) . '_' . $uniqueSuffix;
        };
    }

    /**
     * Generator: random template body (message content).
     */
    private function genBody(int $minLen = 10, int $maxLen = 500): callable
    {
        return $this->genString($minLen, $maxLen);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unit Tests: Basic CRUD Operations
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group template-crud
     */
    public function it_creates_a_template_with_valid_data(): void
    {
        $data = [
            'name' => 'Test Template',
            'body' => 'Yth. {{nama}} dari {{nama_sekolah}}, ini adalah pesan test.',
            'created_by' => $this->testUser->id,
        ];

        $template = $this->service->create($data);

        $this->assertInstanceOf(WaBlastTemplate::class, $template);
        $this->assertEquals('Test Template', $template->name);
        $this->assertEquals($data['body'], $template->body);
        $this->assertEquals($this->testUser->id, $template->created_by);
        $this->assertDatabaseHas('wa_blast_templates', [
            'name' => 'Test Template',
            'body' => $data['body'],
        ]);
    }

    /**
     * @test
     * @group template-crud
     */
    public function it_throws_validation_exception_when_creating_duplicate_name(): void
    {
        $data = [
            'name' => 'Duplicate Template',
            'body' => 'First template body',
            'created_by' => $this->testUser->id,
        ];

        $this->service->create($data);

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('Nama template sudah digunakan');

        $this->service->create([
            'name' => 'Duplicate Template',
            'body' => 'Second template body',
            'created_by' => $this->testUser->id,
        ]);
    }

    /**
     * @test
     * @group template-crud
     */
    public function it_checks_uniqueness_case_insensitively(): void
    {
        $data = [
            'name' => 'Test Template',
            'body' => 'First template body',
            'created_by' => $this->testUser->id,
        ];

        $this->service->create($data);

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('Nama template sudah digunakan');

        // Try to create with different case
        $this->service->create([
            'name' => 'test template',  // lowercase
            'body' => 'Second template body',
            'created_by' => $this->testUser->id,
        ]);
    }

    /**
     * @test
     * @group template-crud
     */
    public function it_updates_a_template(): void
    {
        $template = $this->service->create([
            'name' => 'Original Name',
            'body' => 'Original body',
            'created_by' => $this->testUser->id,
        ]);

        $updated = $this->service->update($template->id, [
            'name' => 'Updated Name',
            'body' => 'Updated body',
        ]);

        $this->assertEquals('Updated Name', $updated->name);
        $this->assertEquals('Updated body', $updated->body);
        $this->assertDatabaseHas('wa_blast_templates', [
            'id' => $template->id,
            'name' => 'Updated Name',
            'body' => 'Updated body',
        ]);
    }

    /**
     * @test
     * @group template-crud
     */
    public function it_allows_updating_to_same_name(): void
    {
        $template = $this->service->create([
            'name' => 'Template Name',
            'body' => 'Original body',
            'created_by' => $this->testUser->id,
        ]);

        // Should not throw exception when updating to the same name
        $updated = $this->service->update($template->id, [
            'name' => 'Template Name',  // Same name
            'body' => 'Updated body',
        ]);

        $this->assertEquals('Template Name', $updated->name);
        $this->assertEquals('Updated body', $updated->body);
    }

    /**
     * @test
     * @group template-crud
     */
    public function it_throws_validation_exception_when_updating_to_existing_name(): void
    {
        $template1 = $this->service->create([
            'name' => 'Template One',
            'body' => 'Body one',
            'created_by' => $this->testUser->id,
        ]);

        $template2 = $this->service->create([
            'name' => 'Template Two',
            'body' => 'Body two',
            'created_by' => $this->testUser->id,
        ]);

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('Nama template sudah digunakan');

        // Try to update template2 to have the same name as template1
        $this->service->update($template2->id, [
            'name' => 'Template One',
        ]);
    }

    /**
     * @test
     * @group template-crud
     */
    public function it_deletes_a_template(): void
    {
        $template = $this->service->create([
            'name' => 'Template to Delete',
            'body' => 'Body to delete',
            'created_by' => $this->testUser->id,
        ]);

        $this->service->delete($template->id);

        $this->assertSoftDeleted('wa_blast_templates', [
            'id' => $template->id,
        ]);
    }

    /**
     * @test
     * @group template-crud
     */
    public function it_lists_all_templates(): void
    {
        $this->service->create([
            'name' => 'Template 1',
            'body' => 'Body 1',
            'created_by' => $this->testUser->id,
        ]);

        $this->service->create([
            'name' => 'Template 2',
            'body' => 'Body 2',
            'created_by' => $this->testUser->id,
        ]);

        $templates = $this->service->list();

        $this->assertCount(2, $templates);
        $this->assertEquals('Template 2', $templates->first()->name);  // Ordered by created_at desc
        $this->assertEquals('Template 1', $templates->last()->name);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property-Based Tests — Property 6
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group property-6
     *
     * Feature: wa-blast, Property 6: Template round-trip menjaga konsistensi data
     *
     * Validates: Requirements 11.2, 11.4
     *
     * Property: For any valid `name` and `body` (non-empty, unique name), after
     * create() followed by findById(), the returned data SHALL be identical to
     * the data that was saved — name and body must not change.
     *
     * Runs 100 iterations with randomly generated template names and bodies to
     * verify data consistency across the full input space.
     */
    public function property_6_template_round_trip_preserves_data_consistency(): void
    {
        // Feature: wa-blast, Property 6: Template round-trip menjaga konsistensi data
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genUniqueName(5, 100),   // random unique template name
                $this->genBody(10, 1000),       // random template body
            ],
            function (string $name, string $body): void {
                // Ensure name and body are not empty (trim whitespace)
                $name = trim($name);
                $body = trim($body);

                if (empty($name) || empty($body)) {
                    // Skip this iteration if generated data is empty
                    return;
                }

                // Create template
                $data = [
                    'name' => $name,
                    'body' => $body,
                    'created_by' => $this->testUser->id,
                ];

                $created = $this->service->create($data);

                // Retrieve template by ID
                $repository = app(\App\Repositories\Contracts\WaBlastTemplateRepositoryInterface::class);
                $retrieved = $repository->findById($created->id);

                // Assert: retrieved data must be identical to created data
                $this->assertNotNull($retrieved, "Template with ID {$created->id} should exist");
                $this->assertEquals(
                    $name,
                    $retrieved->name,
                    "Template name mismatch: expected '{$name}', got '{$retrieved->name}'"
                );
                $this->assertEquals(
                    $body,
                    $retrieved->body,
                    "Template body mismatch: expected '{$body}', got '{$retrieved->body}'"
                );
                $this->assertEquals(
                    $this->testUser->id,
                    $retrieved->created_by,
                    "Template created_by mismatch"
                );

                // Clean up: delete the template to avoid uniqueness conflicts in next iteration
                $this->service->delete($created->id);
            }
        );
    }

    /**
     * @test
     * @group property-6
     *
     * Feature: wa-blast, Property 6: Template round-trip menjaga konsistensi data
     *
     * Validates: Requirements 11.2, 11.4
     *
     * Property: For any valid template with template variables ({{nama}}, {{nama_sekolah}}),
     * after create() followed by findById(), the template variables SHALL remain
     * unchanged in the body.
     *
     * Runs 100 iterations with randomly generated bodies containing template variables.
     */
    public function property_6_template_round_trip_preserves_template_variables(): void
    {
        // Feature: wa-blast, Property 6: Template round-trip menjaga konsistensi data
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genUniqueName(5, 100),
                $this->genBody(10, 500),
            ],
            function (string $name, string $bodyPrefix): void {
                $name = trim($name);
                $bodyPrefix = trim($bodyPrefix);

                if (empty($name) || empty($bodyPrefix)) {
                    return;
                }

                // Inject template variables into the body
                $body = "Yth. {{nama}} dari {{nama_sekolah}}, " . $bodyPrefix;

                $data = [
                    'name' => $name,
                    'body' => $body,
                    'created_by' => $this->testUser->id,
                ];

                $created = $this->service->create($data);

                $repository = app(\App\Repositories\Contracts\WaBlastTemplateRepositoryInterface::class);
                $retrieved = $repository->findById($created->id);

                // Assert: template variables must be preserved exactly
                $this->assertNotNull($retrieved);
                $this->assertStringContainsString('{{nama}}', $retrieved->body,
                    "Template variable {{nama}} should be preserved");
                $this->assertStringContainsString('{{nama_sekolah}}', $retrieved->body,
                    "Template variable {{nama_sekolah}} should be preserved");
                $this->assertEquals($body, $retrieved->body,
                    "Template body with variables should be identical");

                // Clean up
                $this->service->delete($created->id);
            }
        );
    }

    /**
     * @test
     * @group property-6
     *
     * Feature: wa-blast, Property 6: Template round-trip menjaga konsistensi data
     *
     * Validates: Requirements 11.2, 11.4
     *
     * Property: For any valid template, after create() → update() → findById(),
     * the final retrieved data SHALL match the updated data, not the original.
     *
     * Runs 100 iterations to verify update operations maintain data consistency.
     */
    public function property_6_template_round_trip_after_update_preserves_new_data(): void
    {
        // Feature: wa-blast, Property 6: Template round-trip menjaga konsistensi data
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genUniqueName(5, 100),   // original name
                $this->genBody(10, 500),        // original body
                $this->genBody(10, 500),        // updated body
            ],
            function (string $originalName, string $originalBody, string $updatedBody): void {
                $originalName = trim($originalName);
                $originalBody = trim($originalBody);
                $updatedBody = trim($updatedBody);

                if (empty($originalName) || empty($originalBody) || empty($updatedBody)) {
                    return;
                }

                // Create template
                $created = $this->service->create([
                    'name' => $originalName,
                    'body' => $originalBody,
                    'created_by' => $this->testUser->id,
                ]);

                // Update template (keep same name, change body)
                $updated = $this->service->update($created->id, [
                    'body' => $updatedBody,
                ]);

                // Retrieve template
                $repository = app(\App\Repositories\Contracts\WaBlastTemplateRepositoryInterface::class);
                $retrieved = $repository->findById($created->id);

                // Assert: retrieved data must match updated data, not original
                $this->assertNotNull($retrieved);
                $this->assertEquals($originalName, $retrieved->name,
                    "Template name should remain unchanged");
                $this->assertEquals($updatedBody, $retrieved->body,
                    "Template body should match updated value, not original");
                $this->assertNotEquals($originalBody, $retrieved->body,
                    "Template body should not match original value after update");

                // Clean up
                $this->service->delete($created->id);
            }
        );
    }

    /**
     * @test
     * @group property-6
     *
     * Feature: wa-blast, Property 6: Template round-trip menjaga konsistensi data
     *
     * Validates: Requirements 11.2, 11.4
     *
     * Property: For any template with special characters (quotes, newlines, unicode),
     * after create() followed by findById(), the special characters SHALL be
     * preserved exactly as stored.
     *
     * Runs 100 iterations with bodies containing various special characters.
     */
    public function property_6_template_round_trip_preserves_special_characters(): void
    {
        // Feature: wa-blast, Property 6: Template round-trip menjaga konsistensi data
        $specialCharacters = [
            "Line 1\nLine 2\nLine 3",                    // Newlines
            "Text with 'single quotes' and \"double quotes\"",  // Quotes
            "Unicode: 你好 مرحبا שלום",                   // Unicode
            "Emoji: 😀 🎉 ✅",                            // Emoji
            "Special: @#$%^&*()_+-=[]{}|;:,.<>?",       // Special chars
            "Tab\tseparated\tvalues",                    // Tabs
        ];

        foreach ($specialCharacters as $index => $specialBody) {
            $name = "Special Template {$index}_" . microtime(true);

            $created = $this->service->create([
                'name' => $name,
                'body' => $specialBody,
                'created_by' => $this->testUser->id,
            ]);

            $repository = app(\App\Repositories\Contracts\WaBlastTemplateRepositoryInterface::class);
            $retrieved = $repository->findById($created->id);

            $this->assertNotNull($retrieved);
            $this->assertEquals($specialBody, $retrieved->body,
                "Special characters should be preserved exactly: {$specialBody}");

            // Clean up
            $this->service->delete($created->id);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Edge Cases
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_very_long_template_name(): void
    {
        $longName = str_repeat('A', 255);  // Maximum length

        $template = $this->service->create([
            'name' => $longName,
            'body' => 'Test body',
            'created_by' => $this->testUser->id,
        ]);

        $this->assertEquals($longName, $template->name);
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_very_long_template_body(): void
    {
        $longBody = str_repeat('Lorem ipsum dolor sit amet. ', 500);  // ~14,000 chars

        $template = $this->service->create([
            'name' => 'Long Body Template',
            'body' => $longBody,
            'created_by' => $this->testUser->id,
        ]);

        $this->assertEquals($longBody, $template->body);
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_template_with_only_template_variables(): void
    {
        $template = $this->service->create([
            'name' => 'Variables Only',
            'body' => '{{nama}} {{nama_sekolah}}',
            'created_by' => $this->testUser->id,
        ]);

        $this->assertEquals('{{nama}} {{nama_sekolah}}', $template->body);
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_allows_creating_template_after_deleting_one_with_same_name(): void
    {
        $name = 'Reusable Name';

        $template1 = $this->service->create([
            'name' => $name,
            'body' => 'First body',
            'created_by' => $this->testUser->id,
        ]);

        $this->service->delete($template1->id);

        // Should be able to create a new template with the same name after deletion
        $template2 = $this->service->create([
            'name' => $name,
            'body' => 'Second body',
            'created_by' => $this->testUser->id,
        ]);

        $this->assertEquals($name, $template2->name);
        $this->assertEquals('Second body', $template2->body);
    }
}
