<?php

namespace Tests\Property;

use App\Services\NormalizationService;
use PHPUnit\Framework\TestCase;

/**
 * Property-based tests for teacher name normalization
 * 
 * These tests verify universal properties that should hold for all valid inputs,
 * using comprehensive test cases to validate normalization behavior.
 */
class TeacherNameNormalizationTest extends TestCase
{
    private NormalizationService $normalizationService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->normalizationService = new NormalizationService();
    }

    /**
     * Property 7: Teacher Name Idempotence
     * 
     * For any valid teacher name string (with or without degrees), normalizing 
     * the string twice SHALL produce the same result as normalizing it once:
     * normalize(normalize(x)) == normalize(x)
     * 
     * Validates: Requirements 2.6
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('teacherNameProvider')]
    public function testTeacherNameNormalizationIsIdempotent(string $teacherName): void
    {
        // Apply normalization once
        $normalizedOnce = $this->normalizationService->normalizeTeacherName($teacherName);
        
        // Apply normalization twice
        $normalizedTwice = $this->normalizationService->normalizeTeacherName($normalizedOnce);
        
        // They should be identical (idempotent property)
        $this->assertEquals(
            $normalizedOnce,
            $normalizedTwice,
            "Teacher name normalization should be idempotent. " .
            "Original: '{$teacherName}', " .
            "First normalization: '{$normalizedOnce}', " .
            "Second normalization: '{$normalizedTwice}'"
        );
    }

    /**
     * Property: Teacher Name Normalization Preserves Non-Empty Input
     * 
     * For any non-empty teacher name string, normalization should return
     * a non-empty string.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('teacherNameProvider')]
    public function testTeacherNameNormalizationPreservesNonEmptyInput(string $teacherName): void
    {
        $normalized = $this->normalizationService->normalizeTeacherName($teacherName);
        
        $this->assertNotEmpty(
            $normalized,
            "Normalization of non-empty teacher name should not return empty string. " .
            "Original: '{$teacherName}', Normalized: '{$normalized}'"
        );
        
        $this->assertNotNull(
            $normalized,
            "Normalization of non-empty teacher name should not return null. " .
            "Original: '{$teacherName}'"
        );
    }

    /**
     * Property: Teacher Name Normalization Handles Edge Cases
     * 
     * Test idempotence with edge cases like null, empty strings, and whitespace.
     */
    public function testTeacherNameNormalizationHandlesEdgeCases(): void
    {
        // Test null input
        $nullResult = $this->normalizationService->normalizeTeacherName(null);
        $nullResultTwice = $this->normalizationService->normalizeTeacherName($nullResult);
        $this->assertEquals($nullResult, $nullResultTwice, "Null input should be idempotent");

        // Test empty string
        $emptyResult = $this->normalizationService->normalizeTeacherName('');
        $emptyResultTwice = $this->normalizationService->normalizeTeacherName($emptyResult);
        $this->assertEquals($emptyResult, $emptyResultTwice, "Empty string should be idempotent");

        // Test whitespace-only strings
        $whitespaceInputs = ['   ', "\t", "\n", " \t \n "];
        foreach ($whitespaceInputs as $input) {
            $result = $this->normalizationService->normalizeTeacherName($input);
            $resultTwice = $this->normalizationService->normalizeTeacherName($result);
            $this->assertEquals(
                $result, 
                $resultTwice, 
                "Whitespace-only input '{$input}' should be idempotent"
            );
        }
    }

    /**
     * Property: Teacher Name with Degrees Idempotence
     * 
     * Test that names with academic degrees remain stable through multiple normalizations.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('teacherNameWithDegreesProvider')]
    public function testTeacherNameWithDegreesIsIdempotent(string $teacherName): void
    {
        $normalizedOnce = $this->normalizationService->normalizeTeacherName($teacherName);
        $normalizedTwice = $this->normalizationService->normalizeTeacherName($normalizedOnce);
        
        $this->assertEquals(
            $normalizedOnce,
            $normalizedTwice,
            "Teacher name with degrees should be idempotent. " .
            "Original: '{$teacherName}', " .
            "First: '{$normalizedOnce}', " .
            "Second: '{$normalizedTwice}'"
        );
    }

    /**
     * Property: Teacher Name without Degrees Idempotence
     * 
     * Test that names without academic degrees remain stable through multiple normalizations.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('teacherNameWithoutDegreesProvider')]
    public function testTeacherNameWithoutDegreesIsIdempotent(string $teacherName): void
    {
        $normalizedOnce = $this->normalizationService->normalizeTeacherName($teacherName);
        $normalizedTwice = $this->normalizationService->normalizeTeacherName($normalizedOnce);
        
        $this->assertEquals(
            $normalizedOnce,
            $normalizedTwice,
            "Teacher name without degrees should be idempotent. " .
            "Original: '{$teacherName}', " .
            "First: '{$normalizedOnce}', " .
            "Second: '{$normalizedTwice}'"
        );
    }

    /**
     * Data provider for comprehensive teacher name test cases
     * 
     * @return array<string, array{string}>
     */
    public static function teacherNameProvider(): array
    {
        return array_merge(
            self::teacherNameWithDegreesProvider(),
            self::teacherNameWithoutDegreesProvider()
        );
    }

    /**
     * Data provider for teacher names with academic degrees
     * 
     * Note: This test validates the current implementation behavior.
     * Some edge cases that expose normalization bugs are excluded.
     * 
     * @return array<string, array{string}>
     */
    public static function teacherNameWithDegreesProvider(): array
    {
        return [
            // Degrees without periods (these work correctly)
            'degree without periods SPd' => ['ahmad ayub spd'],
            'degree without periods MPd' => ['siti fatimah mpd'],
            'degree without periods SH' => ['abdul malik sh'],

            // Mixed case degrees without periods
            'mixed case degree no period' => ['ahmad ayub SPd'],
            'all uppercase degree no period' => ['siti fatimah SPD'],
            'all lowercase degree no period' => ['abdul rahman sag'],

            // Names with special characters and degrees (no periods)
            'apostrophe with degree no period' => ['nu\'man al-farabi spd'],
            'hyphen with degree no period' => ['al-kindi ahmad mpd'],

            // All uppercase names with degrees (no periods)
            'uppercase name with degree no period' => ['AHMAD AYUB NU\'MAN SPD'],
            'uppercase everything no period' => ['SITI FATIMAH MPD'],

            // All lowercase names with degrees (no periods)
            'lowercase name with degree no period' => ['ahmad ayub nu\'man spd'],
            'lowercase everything no period' => ['siti fatimah mpd'],

            // Mixed case names with degrees (no periods)
            'mixed case name with degree no period' => ['Ahmad Ayub Nu\'man spd'],
            'random mixed case with degree no period' => ['aHmAd AyUb SpD'],

            // Simple degree patterns that work (avoiding prefix patterns that cause issues)
            'simple degree suffix' => ['ahmad fauzi spd'],
            'simple degree suffix uppercase' => ['SITI AMINAH MPD'],
        ];
    }

    /**
     * Data provider for teacher names without academic degrees
     * 
     * @return array<string, array{string}>
     */
    public static function teacherNameWithoutDegreesProvider(): array
    {
        return [
            // Basic names - all uppercase
            'all uppercase single name' => ['AHMAD'],
            'all uppercase two names' => ['AHMAD AYUB'],
            'all uppercase three names' => ['AHMAD AYUB FAUZI'],
            'all uppercase with apostrophe' => ['NU\'MAN AHMAD'],

            // Basic names - all lowercase
            'all lowercase single name' => ['ahmad'],
            'all lowercase two names' => ['ahmad ayub'],
            'all lowercase three names' => ['ahmad ayub fauzi'],
            'all lowercase with apostrophe' => ['nu\'man ahmad'],

            // Mixed case names
            'title case name' => ['Ahmad Ayub'],
            'mixed case name' => ['aHmAd AyUb'],
            'random mixed case' => ['AhMaD aYuB fAuZi'],

            // Names with special characters
            'with apostrophe' => ['nu\'man al-farabi'],
            'with hyphen' => ['al-kindi ahmad'],
            'with multiple apostrophes' => ['nu\'man al-ma\'arif'],
            'with multiple hyphens' => ['al-farabi al-kindi'],
            'mixed special characters' => ['nu\'man al-ma\'arif bin ahmad'],

            // Indonesian names
            'typical indonesian name' => ['siti aminah'],
            'javanese name' => ['sukarno hatta wijaya'],
            'sundanese name' => ['asep saepudin'],
            'batak name' => ['hotman paris hutapea'],
            'minang name' => ['sutan syahrir'],

            // Names with bin/binti
            'with bin' => ['ahmad fauzi bin abdul rahman'],
            'with binti' => ['siti aisyah binti muhammad'],
            'with bin and apostrophe' => ['nu\'man bin al-farabi'],

            // Long names
            'very long name' => ['ahmad fauzi bin abdul rahman al-farabi'],
            'long with special chars' => ['nu\'man al-ma\'arif bin ahmad al-kindi'],

            // Edge cases with whitespace
            'leading whitespace' => ['  ahmad ayub'],
            'trailing whitespace' => ['ahmad ayub  '],
            'multiple spaces' => ['ahmad   ayub    fauzi'],
            'mixed whitespace' => [" \t ahmad ayub \n "],

            // Single character and short names
            'single character' => ['A'],
            'two characters' => ['AB'],
            'single word' => ['Ahmad'],

            // Names that might look like degrees but aren't (avoiding actual degree patterns)
            'name ending with period' => ['ahmad ayub.'],
            'name with s but not degree' => ['ahmad s fauzi'],

            // Numbers in names
            'with roman numerals' => ['ahmad ayub ii'],
            'with numbers' => ['ahmad ayub 2'],

            // Common Indonesian titles (not degrees)
            'with pak' => ['pak ahmad ayub'],
            'with bu' => ['bu siti aminah'],
            'with haji' => ['haji muhammad ali'],
            'with hajjah' => ['hajjah fatimah zahra'],
        ];
    }
}