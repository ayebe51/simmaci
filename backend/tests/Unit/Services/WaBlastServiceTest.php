<?php

namespace Tests\Unit\Services;

use App\Jobs\SendBlastJob;
use App\Models\WaBlast;
use App\Models\WaBlastConfig;
use App\Repositories\Contracts\WaBlastConfigRepositoryInterface;
use App\Repositories\Contracts\WaBlastRecipientRepositoryInterface;
use App\Repositories\Contracts\WaBlastRepositoryInterface;
use App\Services\RecipientCompilerService;
use App\Services\WaBlastConfigService;
use App\Services\WaBlastService;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * WaBlastServiceTest
 *
 * Contains unit tests and property-based tests for WaBlastService.
 *
 * Property 4: For any recipient count > max_recipients_per_session,
 * createBlast() must throw ValidationException.
 *
 * **Validates: Requirements 5.1, 5.2**
 */
class WaBlastServiceTest extends TestCase
{
    /** Minimum iterations for property-based tests */
    private const PROPERTY_ITERATIONS = 100;

    // ─────────────────────────────────────────────────────────────────────────
    // Property-Based Test Helper
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Run a property-based test with randomly generated inputs.
     *
     * @param int        $iterations Number of random samples to test
     * @param callable[] $generators Zero-arg callables that each return one random value
     * @param callable   $property   Receives one argument per generator; throws on failure
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
     * Generator: random integer between $min and $max (inclusive).
     */
    private function genInt(int $min, int $max): callable
    {
        return fn (): int => random_int($min, $max);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: build a WaBlastService with mocked dependencies
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Build a WaBlastService where the compiler returns $compiledCount valid recipients
     * and the config returns $maxPerSession as the session limit.
     *
     * @param int $maxPerSession  Value for max_recipients_per_session
     * @param int $compiledCount  Number of valid (pending) recipients the compiler returns
     * @return WaBlastService
     */
    private function buildServiceWithMocks(int $maxPerSession, int $compiledCount): WaBlastService
    {
        // Build mock config object
        $config = $this->createMock(WaBlastConfig::class);
        $config->method('__get')->willReturnCallback(function (string $name) use ($maxPerSession) {
            return match ($name) {
                'max_recipients_per_session' => $maxPerSession,
                'max_daily_messages'         => 10000, // high enough to not interfere
                default                      => null,
            };
        });

        // Config repository mock
        $configRepo = $this->createMock(WaBlastConfigRepositoryInterface::class);
        $configRepo->method('get')->willReturn($config);

        // Recipient compiler mock — returns $compiledCount valid recipients
        $compiler = $this->createMock(RecipientCompilerService::class);
        $fakeRecipients = array_fill(0, $compiledCount, [
            'recipient_name'  => 'Test User',
            'school_name'     => 'Test School',
            'phone_number'    => '628123456789',
            'recipient_type'  => 'gtk',
            'delivery_status' => 'pending',
        ]);
        $compiler->method('compile')->willReturn($fakeRecipients);

        // Blast repository mock (not expected to be called when validation fails)
        $blastRepo = $this->createMock(WaBlastRepositoryInterface::class);

        // Recipient repository mock
        $recipientRepo = $this->createMock(WaBlastRecipientRepositoryInterface::class);

        // Config service mock
        $configService = $this->createMock(WaBlastConfigService::class);

        return new WaBlastService(
            $blastRepo,
            $recipientRepo,
            $configRepo,
            $compiler,
            $configService
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property-Based Tests — Property 4
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group property-4
     *
     * Feature: wa-blast, Property 4: Rate limit per sesi tidak pernah dilampaui
     *
     * **Validates: Requirements 5.1, 5.2**
     *
     * Property: For any recipient count > max_recipients_per_session,
     * createBlast() MUST throw ValidationException.
     *
     * Strategy:
     * - Randomly pick a max_per_session limit between 100 and 500.
     * - Randomly pick a recipient count that exceeds the limit (limit+1 to limit+500).
     * - Mock the config to return the chosen limit.
     * - Mock the compiler to return the chosen count of valid recipients.
     * - Assert that createBlast() throws ValidationException.
     *
     * Runs 100 iterations with randomly generated limits and counts.
     */
    public function property_4_createBlast_throws_when_recipient_count_exceeds_max_per_session(): void
    {
        // Feature: wa-blast, Property 4: Rate limit per sesi tidak pernah dilampaui
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genInt(100, 500),  // max_recipients_per_session
            ],
            function (int $maxPerSession): void {
                // Recipient count is always strictly greater than the limit
                $recipientCount = $maxPerSession + random_int(1, 500);

                $service = $this->buildServiceWithMocks($maxPerSession, $recipientCount);

                $data = [
                    'title'                   => 'Test Blast',
                    'recipient_category'      => 'gtk',
                    'school_ids'              => [],
                    'jenjang_filter'          => [],
                    'message_body'            => 'Test message',
                    'attachment'              => null,
                    'scheduled_at'            => null,
                    'excluded_phone_numbers'  => [],
                ];

                try {
                    $service->createBlast($data, userId: 1);
                    $this->fail(
                        "Expected ValidationException was not thrown for "
                        . "{$recipientCount} recipients with max {$maxPerSession} per session."
                    );
                } catch (ValidationException $e) {
                    // Expected — property holds
                    $this->assertArrayHasKey(
                        'recipients',
                        $e->errors(),
                        "ValidationException should have 'recipients' key in errors."
                    );
                }
            }
        );
    }

    /**
     * @test
     * @group property-4
     *
     * Feature: wa-blast, Property 4: Rate limit per sesi tidak pernah dilampaui
     *
     * **Validates: Requirements 5.1, 5.2**
     *
     * Boundary test: exactly at the limit (count == max) should NOT throw ValidationException
     * for the recipients limit. This verifies the boundary condition is correct (> not >=).
     */
    public function property_4_createBlast_does_not_throw_validation_for_recipients_when_count_equals_max(): void
    {
        // Feature: wa-blast, Property 4: Rate limit per sesi tidak pernah dilampaui
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genInt(1, 500),  // max_recipients_per_session
            ],
            function (int $maxPerSession): void {
                // Recipient count exactly equals the limit — should NOT throw for recipients
                $recipientCount = $maxPerSession;

                // Build a WaBlast mock to return from the repository
                $blast = $this->createMock(WaBlast::class);
                $blast->method('__get')->willReturnCallback(fn ($name) => match ($name) {
                    'id'               => 1,
                    'blast_status'     => 'sending',
                    'total_recipients' => $recipientCount,
                    default            => null,
                });

                // Config mock
                $config = $this->createMock(WaBlastConfig::class);
                $config->method('__get')->willReturnCallback(function (string $name) use ($maxPerSession) {
                    return match ($name) {
                        'max_recipients_per_session' => $maxPerSession,
                        'max_daily_messages'         => 10000,
                        default                      => null,
                    };
                });

                $configRepo = $this->createMock(WaBlastConfigRepositoryInterface::class);
                $configRepo->method('get')->willReturn($config);

                // Compiler returns exactly $recipientCount valid recipients
                $fakeRecipients = array_fill(0, $recipientCount, [
                    'recipient_name'  => 'Test User',
                    'school_name'     => 'Test School',
                    'phone_number'    => '628123456789',
                    'recipient_type'  => 'gtk',
                    'delivery_status' => 'pending',
                ]);
                $compiler = $this->createMock(RecipientCompilerService::class);
                $compiler->method('compile')->willReturn($fakeRecipients);

                // Blast repo returns a mock blast
                $blastRepo = $this->createMock(WaBlastRepositoryInterface::class);
                $blastRepo->method('create')->willReturn($blast);

                // Recipient repo — must return EloquentCollection
                $recipientRepo = $this->createMock(WaBlastRecipientRepositoryInterface::class);
                $recipientRepo->method('createMany')->willReturn(new EloquentCollection([]));

                $configService = $this->createMock(WaBlastConfigService::class);

                $service = new WaBlastService(
                    $blastRepo,
                    $recipientRepo,
                    $configRepo,
                    $compiler,
                    $configService
                );

                $data = [
                    'title'                   => 'Test Blast',
                    'recipient_category'      => 'gtk',
                    'school_ids'              => [],
                    'jenjang_filter'          => [],
                    'message_body'            => 'Test message',
                    'attachment'              => null,
                    'scheduled_at'            => null,
                    'excluded_phone_numbers'  => [],
                ];

                $recipientsValidationThrown = false;

                try {
                    $service->createBlast($data, userId: 1);
                } catch (ValidationException $e) {
                    // If it's a recipients validation error, the property fails
                    if (isset($e->errors()['recipients'])) {
                        $recipientsValidationThrown = true;
                    }
                    // Other ValidationException (e.g., daily_limit) is acceptable
                } catch (\Exception $e) {
                    // Non-ValidationException (e.g., from job dispatch) is acceptable in unit test context
                }

                $this->assertFalse(
                    $recipientsValidationThrown,
                    "ValidationException for 'recipients' should NOT be thrown when count ({$recipientCount}) "
                    . "equals max_per_session ({$maxPerSession})."
                );
            }
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unit Tests: cancelBlast
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group cancel-blast
     */
    public function it_throws_when_cancelling_a_sending_blast(): void
    {
        $blast = $this->createMock(WaBlast::class);
        $blast->method('__get')->willReturnCallback(fn ($name) => match ($name) {
            'id'           => 1,
            'blast_status' => 'sending',
            default        => null,
        });

        $blastRepo = $this->createMock(WaBlastRepositoryInterface::class);
        $blastRepo->method('findById')->willReturn($blast);

        $service = new WaBlastService(
            $blastRepo,
            $this->createMock(WaBlastRecipientRepositoryInterface::class),
            $this->createMock(WaBlastConfigRepositoryInterface::class),
            $this->createMock(RecipientCompilerService::class),
            $this->createMock(WaBlastConfigService::class)
        );

        $this->expectException(ValidationException::class);
        $service->cancelBlast(1);
    }

    /**
     * @test
     * @group cancel-blast
     */
    public function it_throws_when_cancelling_a_completed_blast(): void
    {
        $blast = $this->createMock(WaBlast::class);
        $blast->method('__get')->willReturnCallback(fn ($name) => match ($name) {
            'id'           => 1,
            'blast_status' => 'completed',
            default        => null,
        });

        $blastRepo = $this->createMock(WaBlastRepositoryInterface::class);
        $blastRepo->method('findById')->willReturn($blast);

        $service = new WaBlastService(
            $blastRepo,
            $this->createMock(WaBlastRecipientRepositoryInterface::class),
            $this->createMock(WaBlastConfigRepositoryInterface::class),
            $this->createMock(RecipientCompilerService::class),
            $this->createMock(WaBlastConfigService::class)
        );

        $this->expectException(ValidationException::class);
        $service->cancelBlast(1);
    }

    /**
     * @test
     * @group cancel-blast
     */
    public function it_throws_when_blast_not_found_for_cancel(): void
    {
        $blastRepo = $this->createMock(WaBlastRepositoryInterface::class);
        $blastRepo->method('findById')->willReturn(null);

        $service = new WaBlastService(
            $blastRepo,
            $this->createMock(WaBlastRecipientRepositoryInterface::class),
            $this->createMock(WaBlastConfigRepositoryInterface::class),
            $this->createMock(RecipientCompilerService::class),
            $this->createMock(WaBlastConfigService::class)
        );

        $this->expectException(ValidationException::class);
        $service->cancelBlast(999);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unit Tests: previewRecipients
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group preview-recipients
     */
    public function it_returns_correct_counts_for_preview_recipients(): void
    {
        $fakeRecipients = [
            ['recipient_name' => 'A', 'school_name' => 'S1', 'phone_number' => '628111', 'recipient_type' => 'gtk', 'delivery_status' => 'pending'],
            ['recipient_name' => 'B', 'school_name' => 'S2', 'phone_number' => '628222', 'recipient_type' => 'gtk', 'delivery_status' => 'pending'],
            ['recipient_name' => 'C', 'school_name' => 'S3', 'phone_number' => '123',    'recipient_type' => 'gtk', 'delivery_status' => 'invalid_number'],
        ];

        $compiler = $this->createMock(RecipientCompilerService::class);
        $compiler->method('compile')->willReturn($fakeRecipients);

        $service = new WaBlastService(
            $this->createMock(WaBlastRepositoryInterface::class),
            $this->createMock(WaBlastRecipientRepositoryInterface::class),
            $this->createMock(WaBlastConfigRepositoryInterface::class),
            $compiler,
            $this->createMock(WaBlastConfigService::class)
        );

        $result = $service->previewRecipients('gtk', []);

        $this->assertEquals(3, $result['total_count']);
        $this->assertEquals(2, $result['valid_count']);
        $this->assertEquals(1, $result['invalid_count']);
        $this->assertCount(3, $result['recipients']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unit Tests: retryBlast
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group retry-blast
     */
    public function it_throws_when_retrying_blast_with_no_failed_recipients(): void
    {
        $blast = $this->createMock(WaBlast::class);
        $blast->method('__get')->willReturnCallback(fn ($name) => match ($name) {
            'id'                 => 1,
            'blast_status'       => 'completed',
            'title'              => 'Test',
            'recipient_category' => 'gtk',
            'school_ids'         => null,
            'jenjang_filter'     => null,
            'message_body'       => 'Test',
            'attachment_path'    => null,
            'attachment_name'    => null,
            default              => null,
        });

        $blastRepo = $this->createMock(WaBlastRepositoryInterface::class);
        $blastRepo->method('findById')->willReturn($blast);

        $recipientRepo = $this->createMock(WaBlastRecipientRepositoryInterface::class);
        $recipientRepo->method('findFailedByBlast')->willReturn(new EloquentCollection([]));

        $service = new WaBlastService(
            $blastRepo,
            $recipientRepo,
            $this->createMock(WaBlastConfigRepositoryInterface::class),
            $this->createMock(RecipientCompilerService::class),
            $this->createMock(WaBlastConfigService::class)
        );

        $this->expectException(ValidationException::class);
        $service->retryBlast(1, userId: 1);
    }

    /**
     * @test
     * @group retry-blast
     */
    public function it_throws_when_retrying_nonexistent_blast(): void
    {
        $blastRepo = $this->createMock(WaBlastRepositoryInterface::class);
        $blastRepo->method('findById')->willReturn(null);

        $service = new WaBlastService(
            $blastRepo,
            $this->createMock(WaBlastRecipientRepositoryInterface::class),
            $this->createMock(WaBlastConfigRepositoryInterface::class),
            $this->createMock(RecipientCompilerService::class),
            $this->createMock(WaBlastConfigService::class)
        );

        $this->expectException(ValidationException::class);
        $service->retryBlast(999, userId: 1);
    }
}
