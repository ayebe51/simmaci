<?php

namespace Tests\Unit\Services;

use App\Services\StudentStatisticsService;
use Faker\Factory as Faker;
use PHPUnit\Framework\TestCase;

/**
 * Property-based tests for StudentStatisticsService.
 *
 * Uses Faker to generate 100+ randomized inputs per property test,
 * validating universal correctness properties across all valid inputs.
 *
 * @group student-statistics
 */
class StudentStatisticsServicePropertyTest extends TestCase
{
    private StudentStatisticsService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new StudentStatisticsService();
    }

    /**
     * Property 9: Export Filename Sanitization
     *
     * For any madrasah name containing special characters (spaces, apostrophes, slashes, etc.),
     * the generateExportFilename function SHALL replace all non-alphanumeric characters
     * (except underscores) with underscores, and the resulting filename SHALL match the
     * pattern {prefix}_{sanitized_name}_{YYYYMMdd_HHmmss}.xlsx.
     *
     * **Validates: Requirements 4.4**
     *
     * @test
     * @group student-statistics
     */
    public function property_export_filename_sanitization(): void
    {
        $faker = Faker::create('id_ID');

        // Special characters commonly found in madrasah names
        $specialChars = [' ', "'", '/', '-', '.', ',', '(', ')', '&', '+', '"', '!', '@', '#', '$', '%', '^', '*', '~', '`', '?', '<', '>', '{', '}', '[', ']', '|', '\\', ';', ':'];

        $prefixes = ['Jumlah_Siswa', 'Rekap_Siswa'];

        for ($i = 0; $i < 120; $i++) {
            // Generate random madrasah names with special characters
            $name = $this->generateRandomMadrasahName($faker, $specialChars);
            $prefix = $prefixes[array_rand($prefixes)];

            $result = $this->service->generateExportFilename($prefix, $name);

            // Assert 1: Result should end with .xlsx
            $this->assertStringEndsWith(
                '.xlsx',
                $result,
                "Filename must end with .xlsx for input: '{$name}'"
            );

            // Assert 2: No special characters in result except underscores and the dot before xlsx
            // The filename (without .xlsx extension) should only contain [a-zA-Z0-9_]
            $filenameWithoutExtension = substr($result, 0, -5); // Remove .xlsx
            $this->assertMatchesRegularExpression(
                '/^[a-zA-Z0-9_]+$/',
                $filenameWithoutExtension,
                "Filename (without extension) must contain only alphanumeric chars and underscores. Got: '{$result}' for input: '{$name}'"
            );

            // Assert 3: Result matches the full expected pattern: {prefix}_{sanitized}_{YYYYMMdd_HHmmss}.xlsx
            $this->assertMatchesRegularExpression(
                '/^' . preg_quote($prefix, '/') . '_[a-zA-Z0-9_]+_\d{8}_\d{6}\.xlsx$/',
                $result,
                "Filename must match pattern {prefix}_{sanitized}_{YYYYMMdd_HHmmss}.xlsx. Got: '{$result}' for input: '{$name}'"
            );

            // Assert 4: No consecutive underscores in the result
            $this->assertDoesNotMatchRegularExpression(
                '/__/',
                $result,
                "Filename must not contain consecutive underscores. Got: '{$result}' for input: '{$name}'"
            );

            // Assert 5: The sanitized identifier part should not start or end with underscore
            $pattern = '/^' . preg_quote($prefix, '/') . '_(.+)_\d{8}_\d{6}\.xlsx$/';
            if (preg_match($pattern, $result, $matches)) {
                $sanitizedPart = $matches[1];
                $this->assertDoesNotMatchRegularExpression(
                    '/^_/',
                    $sanitizedPart,
                    "Sanitized identifier must not start with underscore. Got: '{$sanitizedPart}' for input: '{$name}'"
                );
                $this->assertDoesNotMatchRegularExpression(
                    '/_$/',
                    $sanitizedPart,
                    "Sanitized identifier must not end with underscore. Got: '{$sanitizedPart}' for input: '{$name}'"
                );
            }
        }
    }

    /**
     * Generate a random madrasah name with special characters for property testing.
     */
    private function generateRandomMadrasahName(\Faker\Generator $faker, array $specialChars): string
    {
        $strategies = [
            // Strategy 1: Typical madrasah name with spaces
            fn () => $faker->randomElement(['MI', 'MTs', 'MA', 'RA']) . ' ' . $faker->lastName() . ' ' . $faker->firstName(),
            // Strategy 2: Name with apostrophe (common in Arabic names)
            fn () => $faker->randomElement(['MI', 'MTs', 'MA']) . " Al-" . $faker->lastName() . " Nu'man",
            // Strategy 3: Name with slash (combined schools)
            fn () => $faker->randomElement(['MI', 'MTs']) . '/' . $faker->randomElement(['MA', 'MTs']) . ' Terpadu ' . $faker->city(),
            // Strategy 4: Name with parentheses
            fn () => $faker->randomElement(['MI', 'MTs', 'MA']) . ' ' . $faker->lastName() . ' (' . $faker->city() . ')',
            // Strategy 5: Name with dashes
            fn () => $faker->randomElement(['MI', 'MTs', 'MA']) . ' Al-' . $faker->lastName() . '-' . $faker->firstName(),
            // Strategy 6: Name with multiple special chars
            fn () => $faker->randomElement(['MI', 'MTs', 'MA']) . ' ' . $faker->lastName() . ' & ' . $faker->lastName(),
            // Strategy 7: Name with dots and commas
            fn () => 'Mts. ' . $faker->lastName() . ', ' . $faker->city(),
            // Strategy 8: Random string with injected special characters
            fn () => implode('', array_map(
                fn () => $faker->randomElement([
                    $faker->randomLetter(),
                    $faker->randomLetter(),
                    $faker->randomLetter(),
                    $specialChars[array_rand($specialChars)],
                ]),
                range(1, $faker->numberBetween(5, 20))
            )),
            // Strategy 9: Mostly special characters but with at least one alphanumeric
            fn () => $faker->randomLetter() . implode('', array_map(
                fn () => $specialChars[array_rand($specialChars)],
                range(1, $faker->numberBetween(3, 10))
            )) . $faker->randomLetter(),
            // Strategy 10: Indonesian/Arabic-style names with special chars
            fn () => $faker->randomElement(['MI', 'MTs', 'MA']) . " Roudlotul Jannah - Cab. " . $faker->city(),
        ];

        $strategy = $strategies[array_rand($strategies)];

        return $strategy();
    }
}
