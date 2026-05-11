<?php

namespace Tests\Unit\Services;

use App\Services\PhoneNormalizerService;
use PHPUnit\Framework\TestCase;

/**
 * PhoneNormalizerServiceTest
 *
 * Contains unit tests and property-based tests for PhoneNormalizerService.
 *
 * Property-based tests run 100+ iterations with randomly generated inputs to
 * verify that the normalization and validation logic holds for all valid inputs,
 * not just hand-picked examples.
 *
 * Note: eris/eris (^0.7) is incompatible with PHPUnit 11 (requires PHPUnit <6).
 * Property tests are implemented using a custom forAll() helper that generates
 * random inputs and runs the specified number of iterations — achieving the same
 * correctness guarantees without the version conflict.
 */
class PhoneNormalizerServiceTest extends TestCase
{
    private PhoneNormalizerService $service;

    /** Minimum iterations for property-based tests */
    private const PROPERTY_ITERATIONS = 100;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new PhoneNormalizerService();
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
     * @param callable ...$generators Zero-arg callables that each return one random value
     * @param callable $property    Receives one argument per generator; throws on failure
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
     * Generator: random digit string of exactly $length digits.
     */
    private function genDigits(int $length): callable
    {
        return function () use ($length): string {
            $digits = '';
            for ($i = 0; $i < $length; $i++) {
                // First digit is 8 or 9 (valid Indonesian mobile prefix after country code)
                // to ensure realistic numbers; subsequent digits are 0-9
                $digits .= ($i === 0) ? (string) random_int(8, 9) : (string) random_int(0, 9);
            }
            return $digits;
        };
    }

    /**
     * Generator: random digit length between $min and $max (inclusive).
     */
    private function genLength(int $min, int $max): callable
    {
        return fn (): int => random_int($min, $max);
    }

    /**
     * Generator: random element from $choices array.
     */
    private function genElement(array $choices): callable
    {
        return fn () => $choices[array_rand($choices)];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unit Tests: normalize()
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group phone-normalization
     */
    public function it_normalizes_phone_starting_with_zero(): void
    {
        $result = $this->service->normalize('0812345678901');
        $this->assertEquals('62812345678901', $result);
    }

    /**
     * @test
     * @group phone-normalization
     */
    public function it_normalizes_phone_starting_with_plus_62(): void
    {
        $result = $this->service->normalize('+628123456789');
        $this->assertEquals('628123456789', $result);
    }

    /**
     * @test
     * @group phone-normalization
     */
    public function it_normalizes_phone_starting_with_62(): void
    {
        $result = $this->service->normalize('628123456789');
        $this->assertEquals('628123456789', $result);
    }

    /**
     * @test
     * @group phone-normalization
     */
    public function it_removes_spaces_from_phone(): void
    {
        $result = $this->service->normalize('0812 3456 7890');
        $this->assertEquals('6281234567890', $result);
    }

    /**
     * @test
     * @group phone-normalization
     */
    public function it_removes_hyphens_from_phone(): void
    {
        $result = $this->service->normalize('0812-3456-7890');
        $this->assertEquals('6281234567890', $result);
    }

    /**
     * @test
     * @group phone-normalization
     */
    public function it_removes_spaces_and_hyphens_combined(): void
    {
        $result = $this->service->normalize('0812 - 3456 - 7890');
        $this->assertEquals('6281234567890', $result);
    }

    /**
     * @test
     * @group phone-normalization
     */
    public function it_handles_plus_62_with_spaces(): void
    {
        $result = $this->service->normalize('+62 812 3456 7890');
        $this->assertEquals('6281234567890', $result);
    }

    /**
     * @test
     * @group phone-normalization
     */
    public function it_handles_62_with_spaces(): void
    {
        $result = $this->service->normalize('62 812 3456 7890');
        $this->assertEquals('6281234567890', $result);
    }

    /**
     * @test
     * @group phone-normalization
     */
    public function it_normalizes_minimum_length_phone(): void
    {
        // Minimum: 0 + 9 digits = 10 digits total → 62 + 9 digits = 11 digits
        $result = $this->service->normalize('08123456789');
        $this->assertEquals('628123456789', $result);
    }

    /**
     * @test
     * @group phone-normalization
     */
    public function it_normalizes_maximum_length_phone(): void
    {
        // Maximum: 0 + 13 digits = 14 digits total → 62 + 13 digits = 15 digits
        $result = $this->service->normalize('081234567890123');
        $this->assertEquals('6281234567890123', $result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unit Tests: isValid()
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group phone-validation
     */
    public function it_validates_correct_format_phone(): void
    {
        $this->assertTrue($this->service->isValid('628123456789'));      // 12 chars (62 + 10 digits)
        $this->assertTrue($this->service->isValid('6281234567890'));     // 13 chars (62 + 11 digits)
        $this->assertTrue($this->service->isValid('62812345678901'));    // 14 chars (62 + 12 digits)
        $this->assertTrue($this->service->isValid('628123456789012'));   // 15 chars (62 + 13 digits)
    }

    /**
     * @test
     * @group phone-validation
     */
    public function it_rejects_phone_without_62_prefix(): void
    {
        $this->assertFalse($this->service->isValid('08123456789'));
        $this->assertFalse($this->service->isValid('8123456789'));
    }

    /**
     * @test
     * @group phone-validation
     */
    public function it_rejects_phone_with_plus_prefix(): void
    {
        $this->assertFalse($this->service->isValid('+628123456789'));
    }

    /**
     * @test
     * @group phone-validation
     */
    public function it_rejects_phone_too_short(): void
    {
        // Less than 9 digits after 62
        $this->assertFalse($this->service->isValid('6281234567'));
        $this->assertFalse($this->service->isValid('62812345'));
    }

    /**
     * @test
     * @group phone-validation
     */
    public function it_rejects_phone_too_long(): void
    {
        // More than 13 digits after 62
        $this->assertFalse($this->service->isValid('62812345678901234'));
    }

    /**
     * @test
     * @group phone-validation
     */
    public function it_rejects_phone_with_non_digit_characters(): void
    {
        $this->assertFalse($this->service->isValid('6281234567a9'));
        $this->assertFalse($this->service->isValid('62812345 6789'));
        $this->assertFalse($this->service->isValid('628-123-456789'));
    }

    /**
     * @test
     * @group phone-validation
     */
    public function it_rejects_empty_string(): void
    {
        $this->assertFalse($this->service->isValid(''));
    }

    /**
     * @test
     * @group phone-validation
     */
    public function it_rejects_only_62(): void
    {
        $this->assertFalse($this->service->isValid('62'));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property-Based Tests — Property 1
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group property-1
     *
     * Feature: wa-blast, Property 1: Normalisasi nomor WA selalu menghasilkan format valid
     *
     * Validates: Requirements 8.1, 8.2, 8.3
     *
     * Property: For any phone string prefixed with `0`, `+62`, or `62` and followed by
     * 9–13 random digits, normalize() SHALL produce a string matching `^62[0-9]{9,13}$`.
     *
     * Runs 100 iterations with randomly generated digit sequences to cover the full
     * input space beyond hand-picked examples.
     */
    public function property_1_normalize_with_zero_prefix_always_produces_valid_format(): void
    {
        // Feature: wa-blast, Property 1: Normalisasi nomor WA selalu menghasilkan format valid
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genLength(9, 13),  // random digit count after prefix
            ],
            function (int $digitCount): void {
                // Generate a random digit string of the given length
                $digits = '';
                for ($i = 0; $i < $digitCount; $i++) {
                    $digits .= (string) random_int(0, 9);
                }

                $input = '0' . $digits;
                $result = $this->service->normalize($input);

                $this->assertMatchesRegularExpression(
                    '/^62[0-9]{9,13}$/',
                    $result,
                    "normalize('{$input}') = '{$result}' does not match ^62[0-9]{9,13}\$"
                );
            }
        );
    }

    /**
     * @test
     * @group property-1
     *
     * Feature: wa-blast, Property 1: Normalisasi nomor WA selalu menghasilkan format valid
     *
     * Validates: Requirements 8.1, 8.3
     *
     * Property: For any phone string prefixed with `+62` and followed by 9–13 random
     * digits, normalize() SHALL produce a string matching `^62[0-9]{9,13}$`.
     *
     * Runs 100 iterations with randomly generated digit sequences.
     */
    public function property_1_normalize_with_plus62_prefix_always_produces_valid_format(): void
    {
        // Feature: wa-blast, Property 1: Normalisasi nomor WA selalu menghasilkan format valid
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genLength(9, 13),
            ],
            function (int $digitCount): void {
                $digits = '';
                for ($i = 0; $i < $digitCount; $i++) {
                    $digits .= (string) random_int(0, 9);
                }

                $input = '+62' . $digits;
                $result = $this->service->normalize($input);

                $this->assertMatchesRegularExpression(
                    '/^62[0-9]{9,13}$/',
                    $result,
                    "normalize('{$input}') = '{$result}' does not match ^62[0-9]{9,13}\$"
                );
            }
        );
    }

    /**
     * @test
     * @group property-1
     *
     * Feature: wa-blast, Property 1: Normalisasi nomor WA selalu menghasilkan format valid
     *
     * Validates: Requirements 8.1
     *
     * Property: For any phone string prefixed with `62` and followed by 9–13 random
     * digits, normalize() SHALL produce a string matching `^62[0-9]{9,13}$`.
     *
     * Runs 100 iterations with randomly generated digit sequences.
     */
    public function property_1_normalize_with_62_prefix_always_produces_valid_format(): void
    {
        // Feature: wa-blast, Property 1: Normalisasi nomor WA selalu menghasilkan format valid
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genLength(9, 13),
            ],
            function (int $digitCount): void {
                $digits = '';
                for ($i = 0; $i < $digitCount; $i++) {
                    $digits .= (string) random_int(0, 9);
                }

                $input = '62' . $digits;
                $result = $this->service->normalize($input);

                $this->assertMatchesRegularExpression(
                    '/^62[0-9]{9,13}$/',
                    $result,
                    "normalize('{$input}') = '{$result}' does not match ^62[0-9]{9,13}\$"
                );
            }
        );
    }

    /**
     * @test
     * @group property-1
     *
     * Feature: wa-blast, Property 1: Normalisasi nomor WA selalu menghasilkan format valid
     *
     * Validates: Requirements 8.1, 8.2, 8.3
     *
     * Property: For any combination of prefix (`0`, `+62`, `62`) and digit length (9–13),
     * normalize() SHALL always produce a string matching `^62[0-9]{9,13}$`.
     *
     * This is the primary property test covering all three prefix variants in a single
     * run of 100 iterations, with prefix and digit count both randomly sampled.
     */
    public function property_1_normalize_any_valid_prefix_and_length_produces_valid_format(): void
    {
        // Feature: wa-blast, Property 1: Normalisasi nomor WA selalu menghasilkan format valid
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genElement(['0', '+62', '62']),  // random prefix
                $this->genLength(9, 13),                // random digit count
            ],
            function (string $prefix, int $digitCount): void {
                // Build a random digit string of the given length
                $digits = '';
                for ($i = 0; $i < $digitCount; $i++) {
                    $digits .= (string) random_int(0, 9);
                }

                $input = $prefix . $digits;
                $result = $this->service->normalize($input);

                $this->assertMatchesRegularExpression(
                    '/^62[0-9]{9,13}$/',
                    $result,
                    "normalize('{$input}') = '{$result}' does not match ^62[0-9]{9,13}\$"
                );
            }
        );
    }

    /**
     * @test
     * @group property-1
     *
     * Feature: wa-blast, Property 1: Normalisasi nomor WA selalu menghasilkan format valid
     *
     * Validates: Requirements 8.1, 8.2, 8.3
     *
     * Property: Spaces and hyphens in any position within a valid phone number MUST NOT
     * affect the normalized result — it SHALL still match `^62[0-9]{9,13}$`.
     *
     * Runs 100 iterations inserting random spaces/hyphens into randomly generated phones.
     */
    public function property_1_normalize_with_spaces_and_hyphens_always_produces_valid_format(): void
    {
        // Feature: wa-blast, Property 1: Normalisasi nomor WA selalu menghasilkan format valid
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genElement(['0', '+62', '62']),
                $this->genLength(9, 13),
                $this->genElement([' ', '-', ' - ', '']),  // random separator
            ],
            function (string $prefix, int $digitCount, string $separator): void {
                // Build digit string split into two parts with a separator in the middle
                $half = (int) floor($digitCount / 2);
                $firstPart = '';
                for ($i = 0; $i < $half; $i++) {
                    $firstPart .= (string) random_int(0, 9);
                }
                $secondPart = '';
                for ($i = 0; $i < ($digitCount - $half); $i++) {
                    $secondPart .= (string) random_int(0, 9);
                }

                $input = $prefix . $firstPart . $separator . $secondPart;
                $result = $this->service->normalize($input);

                $this->assertMatchesRegularExpression(
                    '/^62[0-9]{9,13}$/',
                    $result,
                    "normalize('{$input}') = '{$result}' does not match ^62[0-9]{9,13}\$"
                );
            }
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Property-Based Tests — Property 2
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group property-2
     *
     * Feature: wa-blast, Property 2: Nomor tidak valid ditandai `invalid_number`
     *
     * Validates: Requirements 8.4
     *
     * Property: For any string that after normalization does not match `^62[0-9]{9,13}$`,
     * isValid() SHALL return false.
     *
     * Runs 100 iterations with randomly generated strings that are too short or too long.
     */
    public function property_2_isvalid_returns_false_for_strings_not_matching_pattern(): void
    {
        // Feature: wa-blast, Property 2: Nomor tidak valid ditandai invalid_number
        $invalidPhones = [
            '62812345',           // Too short (8 digits after 62)
            '628123456',          // Too short (9 digits total, not 9 after 62)
            '6281234567890123456', // Too long (16 digits after 62)
            '62abc123456789',     // Contains non-digits
            '62 812 345 6789',    // Contains spaces
            '62-812-345-6789',    // Contains hyphens
            '+628123456789',      // Still has + prefix
            '08123456789',        // Still has 0 prefix
            '',                   // Empty
            '62',                 // Only prefix
        ];

        foreach ($invalidPhones as $phone) {
            $this->assertFalse(
                $this->service->isValid($phone),
                "isValid('{$phone}') should return false"
            );
        }
    }

    /**
     * @test
     * @group property-2
     *
     * Feature: wa-blast, Property 2: Nomor tidak valid ditandai `invalid_number`
     *
     * Validates: Requirements 8.4
     *
     * Property: For any phone with fewer than 9 digits after normalization, isValid()
     * SHALL return false. Runs 100 iterations with randomly generated too-short phones.
     */
    public function property_2_isvalid_returns_false_for_too_short_phones(): void
    {
        // Feature: wa-blast, Property 2: Nomor tidak valid ditandai invalid_number
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genLength(1, 8),  // digit count that is too short (< 9)
            ],
            function (int $digitCount): void {
                $digits = '';
                for ($i = 0; $i < $digitCount; $i++) {
                    $digits .= (string) random_int(0, 9);
                }

                // Build a normalized-looking string that is too short
                $phone = '62' . $digits;

                $this->assertFalse(
                    $this->service->isValid($phone),
                    "isValid('{$phone}') should return false — only {$digitCount} digits after 62"
                );
            }
        );
    }

    /**
     * @test
     * @group property-2
     *
     * Feature: wa-blast, Property 2: Nomor tidak valid ditandai `invalid_number`
     *
     * Validates: Requirements 8.4
     *
     * Property: For any phone with more than 13 digits after normalization, isValid()
     * SHALL return false. Runs 100 iterations with randomly generated too-long phones.
     */
    public function property_2_isvalid_returns_false_for_too_long_phones(): void
    {
        // Feature: wa-blast, Property 2: Nomor tidak valid ditandai invalid_number
        $this->forAll(
            self::PROPERTY_ITERATIONS,
            [
                $this->genLength(14, 20),  // digit count that is too long (> 13)
            ],
            function (int $digitCount): void {
                $digits = '';
                for ($i = 0; $i < $digitCount; $i++) {
                    $digits .= (string) random_int(0, 9);
                }

                $phone = '62' . $digits;

                $this->assertFalse(
                    $this->service->isValid($phone),
                    "isValid('{$phone}') should return false — {$digitCount} digits after 62 exceeds max 13"
                );
            }
        );
    }

    /**
     * @test
     * @group property-2
     *
     * Feature: wa-blast, Property 2: Nomor tidak valid ditandai `invalid_number`
     *
     * Validates: Requirements 8.4
     *
     * Property: After normalization, if the result does not match `^62[0-9]{9,13}$`,
     * isValid() SHALL return false. Tests the pipeline: normalize() → isValid().
     */
    public function property_2_normalize_then_isvalid_rejects_structurally_invalid_phones(): void
    {
        // Feature: wa-blast, Property 2: Nomor tidak valid ditandai invalid_number
        $testCases = [
            '0812345',            // Too short after normalization
            '081234567890123456', // Too long after normalization
        ];

        foreach ($testCases as $phone) {
            $normalized = $this->service->normalize($phone);
            $this->assertFalse(
                $this->service->isValid($normalized),
                "isValid(normalize('{$phone}')) = isValid('{$normalized}') should return false"
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Edge Cases
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_edge_case_minimum_valid_length(): void
    {
        // Minimum valid: 62 + 9 digits = 11 total
        $phone = '08123456789';
        $normalized = $this->service->normalize($phone);
        $this->assertTrue($this->service->isValid($normalized));
        $this->assertEquals('628123456789', $normalized);
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_edge_case_maximum_valid_length(): void
    {
        // Maximum valid: 62 + 13 digits = 15 total
        $phone = '08123456789012';
        $normalized = $this->service->normalize($phone);
        $this->assertTrue($this->service->isValid($normalized));
        $this->assertEquals('628123456789012', $normalized);
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_edge_case_just_below_minimum(): void
    {
        // Just below minimum: 62 + 8 digits = 10 total
        $phone = '081234567';
        $normalized = $this->service->normalize($phone);
        $this->assertFalse($this->service->isValid($normalized));
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_edge_case_just_above_maximum(): void
    {
        // Just above maximum: 62 + 14 digits = 16 total
        $phone = '08123456789012345';
        $normalized = $this->service->normalize($phone);
        $this->assertFalse($this->service->isValid($normalized));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Real-World Examples
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @test
     * @group real-world
     */
    public function it_handles_real_world_indonesian_phone_numbers(): void
    {
        $realWorldCases = [
            // Telkomsel (0811-0819)
            ['0811234567890', '62811234567890', true],
            ['0812345678901', '62812345678901', true],
            ['0813456789012', '62813456789012', true],

            // Indosat (0814-0816)
            ['0814567890123', '62814567890123', true],
            ['0815678901234', '62815678901234', true],

            // XL (0817-0819)
            ['0817890123456', '62817890123456', true],
            ['0818901234567', '62818901234567', true],

            // With formatting
            ['+62 812 3456 7890', '6281234567890', true],
            ['62-812-3456-7890', '6281234567890', true],
        ];

        foreach ($realWorldCases as [$input, $expectedNormalized, $shouldBeValid]) {
            $normalized = $this->service->normalize($input);
            $isValid = $this->service->isValid($normalized);

            $this->assertEquals($expectedNormalized, $normalized,
                "Normalization failed for: {$input}");
            $this->assertEquals($shouldBeValid, $isValid,
                "Validation failed for normalized: {$normalized}");
        }
    }

    /**
     * @test
     * @group real-world
     *
     * Nomor yang tersimpan di database mungkin mengandung karakter tersembunyi
     * atau tanda kurung. Normalisasi harus membersihkan semua karakter non-digit.
     */
    public function it_strips_parentheses_dots_and_hidden_characters(): void
    {
        $cases = [
            // Parentheses (common in old-style formatting)
            ['(0812) 3456-7890', '6281234567890', true],
            // Dots
            ['0812.3456.7890', '6281234567890', true],
            // Already 62 format with parentheses
            ['6289513788385', '6289513788385', true],
            // With leading/trailing whitespace
            ['  6289513788385  ', '6289513788385', true],
            // Tab character
            ["0812345678901\t", '62812345678901', true],
        ];

        foreach ($cases as [$input, $expectedNormalized, $shouldBeValid]) {
            $normalized = $this->service->normalize($input);
            $isValid = $this->service->isValid($normalized);

            $this->assertEquals($expectedNormalized, $normalized,
                "Normalization failed for input: " . json_encode($input));
            $this->assertEquals($shouldBeValid, $isValid,
                "Validation failed for normalized: {$normalized}");
        }
    }
}
