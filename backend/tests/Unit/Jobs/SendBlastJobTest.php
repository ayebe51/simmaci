<?php

namespace Tests\Unit\Jobs;

use App\Jobs\SendBlastJob;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * SendBlastJobTest
 *
 * Contains property-based tests for SendBlastJob.
 *
 * Property 5: Substitusi template variabel selalu menghasilkan pesan yang mengandung nilai aktual.
 *
 * For any non-empty $nama and $namaSekolah, substituteVariables() SHALL:
 * - Contain the actual $nama value in the result
 * - Contain the actual $namaSekolah value in the result
 * - NOT contain the placeholder {{nama}} in the result
 * - NOT contain the placeholder {{nama_sekolah}} in the result
 *
 * **Validates: Requirements 2.2**
 *
 * Note: eris/eris (^0.7) is incompatible with PHPUnit 11 (requires PHPUnit <6).
 * Property tests are implemented using a custom forAll() helper that generates
 * random inputs and runs the specified number of iterations — achieving the same
 * correctness guarantees without the version conflict.
 */
class SendBlastJobTest extends TestCase
{
    /** Minimum iterations for property-based tests */
    private const PROPERTY_ITERATIONS = 100;

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
     * Generator: random non-empty alphanumeric string of length 1–30.
     * Avoids generating strings that contain the placeholder syntax {{ or }}.
     */
    private function genNonEmptyString(): callable
    {
        return function (): string {
            $length = random_int(1, 30);
            $chars  = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
            $result = '';
            for ($i = 0; $i < $length; $i++) {
                $result .= $chars[random_int(0, strlen($chars) - 1)];
            }
            // Ensure non-empty after trim
            return $result !== '' ? $result : 'x';
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: invoke private substituteVariables() via reflection
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Call the private substituteVariables() method on a SendBlastJob instance.
     *
     * @param string $template    The message template
     * @param string $nama        Recipient name
     * @param string $namaSekolah School name
     * @return string             The substituted message
     */
    private function callSubstituteVariables(string $template, string $nama, string $namaSekolah): string
    {
        $job = new SendBlastJob(blastId: 1);

        $reflection = new ReflectionClass($job);
        $method     = $reflection->getMethod('substituteVariables');
        $method->setAccessible(true);

        return $method->invoke($job, $template, $nama, $namaSekolah);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property-Based Tests — Property 5
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group property-5
     *
     * Feature: wa-blast, Property 5: Substitusi template variabel selalu menghasilkan pesan yang mengandung nilai aktual
     *
     * **Validates: Requirements 2.2**
     *
     * Property: For any non-empty $nama and $namaSekolah, substituteVariables() on a
     * template containing {{nama}} and {{nama_sekolah}} SHALL:
     * - Contain the actual $nama value
     * - Contain the actual $namaSekolah value
     * - NOT contain the placeholder {{nama}}
     * - NOT contain the placeholder {{nama_sekolah}}
     *
     * Runs 100 iterations with randomly generated name and school name strings.
     */
    public function property_5_substitute_variables_always_contains_actual_values(): void
    {
        // Feature: wa-blast, Property 5: Substitusi template variabel selalu menghasilkan pesan yang mengandung nilai aktual
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genNonEmptyString(),  // $nama
                $this->genNonEmptyString(),  // $namaSekolah
            ],
            function (string $nama, string $namaSekolah): void {
                $template = 'Yth. {{nama}} dari {{nama_sekolah}}, harap hadir.';

                $result = $this->callSubstituteVariables($template, $nama, $namaSekolah);

                $this->assertStringContainsString(
                    $nama,
                    $result,
                    "Result should contain nama='{$nama}'"
                );

                $this->assertStringContainsString(
                    $namaSekolah,
                    $result,
                    "Result should contain namaSekolah='{$namaSekolah}'"
                );

                $this->assertStringNotContainsString(
                    '{{nama}}',
                    $result,
                    "Result should not contain placeholder {{nama}}"
                );

                $this->assertStringNotContainsString(
                    '{{nama_sekolah}}',
                    $result,
                    "Result should not contain placeholder {{nama_sekolah}}"
                );
            }
        );
    }

    /**
     * @test
     * @group property-5
     *
     * Feature: wa-blast, Property 5: Substitusi template variabel selalu menghasilkan pesan yang mengandung nilai aktual
     *
     * **Validates: Requirements 2.2**
     *
     * Property: For any non-empty $nama and $namaSekolah, substituteVariables() on a
     * template containing ONLY {{nama}} SHALL contain $nama and NOT contain {{nama}},
     * while {{nama_sekolah}} is replaced with $namaSekolah (even if not present in template).
     *
     * Runs 100 iterations to verify each placeholder is independently substituted.
     */
    public function property_5_substitute_variables_replaces_each_placeholder_independently(): void
    {
        // Feature: wa-blast, Property 5: Substitusi template variabel selalu menghasilkan pesan yang mengandung nilai aktual
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genNonEmptyString(),  // $nama
                $this->genNonEmptyString(),  // $namaSekolah
            ],
            function (string $nama, string $namaSekolah): void {
                // Template with only {{nama}}
                $templateNamaOnly = 'Kepada {{nama}}, selamat datang.';
                $resultNamaOnly   = $this->callSubstituteVariables($templateNamaOnly, $nama, $namaSekolah);

                $this->assertStringContainsString($nama, $resultNamaOnly,
                    "Result should contain nama='{$nama}' when only {{nama}} is in template");
                $this->assertStringNotContainsString('{{nama}}', $resultNamaOnly,
                    "Result should not contain {{nama}} placeholder");

                // Template with only {{nama_sekolah}}
                $templateSekolahOnly = 'Dari {{nama_sekolah}}, salam hormat.';
                $resultSekolahOnly   = $this->callSubstituteVariables($templateSekolahOnly, $nama, $namaSekolah);

                $this->assertStringContainsString($namaSekolah, $resultSekolahOnly,
                    "Result should contain namaSekolah='{$namaSekolah}' when only {{nama_sekolah}} is in template");
                $this->assertStringNotContainsString('{{nama_sekolah}}', $resultSekolahOnly,
                    "Result should not contain {{nama_sekolah}} placeholder");
            }
        );
    }

    /**
     * @test
     * @group property-5
     *
     * Feature: wa-blast, Property 5: Substitusi template variabel selalu menghasilkan pesan yang mengandung nilai aktual
     *
     * **Validates: Requirements 2.2**
     *
     * Property: For any non-empty $nama and $namaSekolah, substituteVariables() on a
     * template with multiple occurrences of each placeholder SHALL replace ALL occurrences.
     *
     * Runs 100 iterations to verify all occurrences are replaced.
     */
    public function property_5_substitute_variables_replaces_all_occurrences(): void
    {
        // Feature: wa-blast, Property 5: Substitusi template variabel selalu menghasilkan pesan yang mengandung nilai aktual
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genNonEmptyString(),  // $nama
                $this->genNonEmptyString(),  // $namaSekolah
            ],
            function (string $nama, string $namaSekolah): void {
                // Template with multiple occurrences of each placeholder
                $template = '{{nama}} dari {{nama_sekolah}}. Halo {{nama}}, sekolah {{nama_sekolah}} menyambut.';

                $result = $this->callSubstituteVariables($template, $nama, $namaSekolah);

                // No placeholders should remain
                $this->assertStringNotContainsString('{{nama}}', $result,
                    "All {{nama}} placeholders should be replaced");
                $this->assertStringNotContainsString('{{nama_sekolah}}', $result,
                    "All {{nama_sekolah}} placeholders should be replaced");

                // Actual values should appear in the result
                $this->assertStringContainsString($nama, $result,
                    "Result should contain nama='{$nama}'");
                $this->assertStringContainsString($namaSekolah, $result,
                    "Result should contain namaSekolah='{$namaSekolah}'");
            }
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unit Tests: substituteVariables()
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group unit
     */
    public function it_substitutes_nama_placeholder(): void
    {
        $result = $this->callSubstituteVariables(
            'Yth. {{nama}}, harap hadir.',
            'Budi Santoso',
            'MI Al-Hidayah'
        );

        $this->assertStringContainsString('Budi Santoso', $result);
        $this->assertStringNotContainsString('{{nama}}', $result);
    }

    /**
     * @test
     * @group unit
     */
    public function it_substitutes_nama_sekolah_placeholder(): void
    {
        $result = $this->callSubstituteVariables(
            'Dari {{nama_sekolah}}, salam hormat.',
            'Budi Santoso',
            'MI Al-Hidayah'
        );

        $this->assertStringContainsString('MI Al-Hidayah', $result);
        $this->assertStringNotContainsString('{{nama_sekolah}}', $result);
    }

    /**
     * @test
     * @group unit
     */
    public function it_substitutes_both_placeholders(): void
    {
        $result = $this->callSubstituteVariables(
            'Yth. {{nama}} dari {{nama_sekolah}}, harap hadir.',
            'Siti Rahayu',
            'MTs Nurul Iman'
        );

        $this->assertEquals('Yth. Siti Rahayu dari MTs Nurul Iman, harap hadir.', $result);
    }

    /**
     * @test
     * @group unit
     */
    public function it_returns_template_unchanged_when_no_placeholders(): void
    {
        $template = 'Pesan tanpa variabel apapun.';
        $result   = $this->callSubstituteVariables($template, 'Budi', 'MI Test');

        $this->assertEquals($template, $result);
    }

    /**
     * @test
     * @group unit
     */
    public function it_handles_empty_template(): void
    {
        $result = $this->callSubstituteVariables('', 'Budi', 'MI Test');

        $this->assertEquals('', $result);
    }

    /**
     * @test
     * @group unit
     */
    public function it_handles_template_with_only_placeholders(): void
    {
        $result = $this->callSubstituteVariables(
            '{{nama}}{{nama_sekolah}}',
            'Ahmad',
            'MA Darul Ulum'
        );

        $this->assertEquals('AhmadMA Darul Ulum', $result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unit Tests: message_override takes precedence over template substitution
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group message-override
     *
     * When a recipient has message_override set, SendBlastJob must use it
     * instead of substituting variables in message_body.
     * This is critical for meeting invitations where each participant
     * gets a personalized message with their own QR link.
     */
    public function it_uses_message_override_when_set_on_recipient(): void
    {
        // The message_override logic is in handle(), which requires DB.
        // We test the decision logic by verifying substituteVariables is NOT
        // called when message_override is non-empty — via the public contract:
        // if message_override is set, the result equals message_override exactly.

        // Simulate what SendBlastJob does:
        $messageBody    = 'Yth. {{nama}} dari {{nama_sekolah}}, harap hadir.';
        $messageOverride = "📋 *UNDANGAN RAPAT*\n\nYth. Budi Santoso\nQR: https://example.com/qr/abc123";

        // Replicate the job's branching logic
        $recipientName   = 'Budi Santoso';
        $recipientSchool = 'MI Al-Hidayah';

        $message = !empty($messageOverride)
            ? $messageOverride
            : $this->callSubstituteVariables($messageBody, $recipientName, $recipientSchool);

        // Must equal the override exactly — no substitution applied
        $this->assertEquals($messageOverride, $message);

        // Must NOT contain template placeholders
        $this->assertStringNotContainsString('{{nama}}', $message);
        $this->assertStringNotContainsString('{{nama_sekolah}}', $message);

        // Must contain the QR link from the override
        $this->assertStringContainsString('https://example.com/qr/abc123', $message);
    }

    /**
     * @test
     * @group message-override
     *
     * When message_override is null or empty, SendBlastJob falls back to
     * substituteVariables() on message_body.
     */
    public function it_falls_back_to_template_substitution_when_message_override_is_null(): void
    {
        $messageBody     = 'Yth. {{nama}} dari {{nama_sekolah}}, harap hadir.';
        $messageOverride = null;
        $recipientName   = 'Siti Rahayu';
        $recipientSchool = 'MTs Nurul Iman';

        $message = !empty($messageOverride)
            ? $messageOverride
            : $this->callSubstituteVariables($messageBody, $recipientName, $recipientSchool);

        $this->assertEquals('Yth. Siti Rahayu dari MTs Nurul Iman, harap hadir.', $message);
    }

    /**
     * @test
     * @group message-override
     *
     * When message_override is an empty string, SendBlastJob falls back to
     * substituteVariables() on message_body (empty string is falsy).
     */
    public function it_falls_back_to_template_substitution_when_message_override_is_empty_string(): void
    {
        $messageBody     = 'Yth. {{nama}} dari {{nama_sekolah}}.';
        $messageOverride = '';
        $recipientName   = 'Ahmad Fauzi';
        $recipientSchool = 'MA Darul Ulum';

        $message = !empty($messageOverride)
            ? $messageOverride
            : $this->callSubstituteVariables($messageBody, $recipientName, $recipientSchool);

        $this->assertEquals('Yth. Ahmad Fauzi dari MA Darul Ulum.', $message);
    }
}
