<?php

namespace Tests\Property;

use App\Services\NormalizationService;
use PHPUnit\Framework\TestCase;

/**
 * Property-based tests for school name normalization
 * 
 * These tests verify universal properties that should hold for all valid inputs,
 * using comprehensive test cases to validate normalization behavior.
 */
class SchoolNameNormalizationTest extends TestCase
{

    private NormalizationService $normalizationService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->normalizationService = new NormalizationService();
    }

    /**
     * Property 3: School Name Idempotence
     * 
     * For any valid school name string, normalizing the string twice
     * SHALL produce the same result as normalizing it once:
     * normalize(normalize(x)) == normalize(x)
     * 
     * Validates: Requirements 1.5
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('schoolNameProvider')]
    public function testSchoolNameNormalizationIsIdempotent(string $schoolName): void
    {
        // Apply normalization once
        $normalizedOnce = $this->normalizationService->normalizeSchoolName($schoolName);
        
        // Apply normalization twice
        $normalizedTwice = $this->normalizationService->normalizeSchoolName($normalizedOnce);
        
        // They should be identical (idempotent property)
        $this->assertEquals(
            $normalizedOnce,
            $normalizedTwice,
            "School name normalization should be idempotent. " .
            "Original: '{$schoolName}', " .
            "First normalization: '{$normalizedOnce}', " .
            "Second normalization: '{$normalizedTwice}'"
        );
    }

    /**
     * Property: School Name Normalization Preserves Non-Empty Input
     * 
     * For any non-empty school name string, normalization should return
     * a non-empty string.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('schoolNameProvider')]
    public function testSchoolNameNormalizationPreservesNonEmptyInput(string $schoolName): void
    {
        $normalized = $this->normalizationService->normalizeSchoolName($schoolName);
        
        $this->assertNotEmpty(
            $normalized,
            "Normalization of non-empty school name should not return empty string. " .
            "Original: '{$schoolName}', Normalized: '{$normalized}'"
        );
        
        $this->assertNotNull(
            $normalized,
            "Normalization of non-empty school name should not return null. " .
            "Original: '{$schoolName}'"
        );
    }

    /**
     * Property: School Name Normalization Handles Edge Cases
     * 
     * Test idempotence with edge cases like null, empty strings, and whitespace.
     */
    public function testSchoolNameNormalizationHandlesEdgeCases(): void
    {
        // Test null input
        $nullResult = $this->normalizationService->normalizeSchoolName(null);
        $nullResultTwice = $this->normalizationService->normalizeSchoolName($nullResult);
        $this->assertEquals($nullResult, $nullResultTwice, "Null input should be idempotent");

        // Test empty string
        $emptyResult = $this->normalizationService->normalizeSchoolName('');
        $emptyResultTwice = $this->normalizationService->normalizeSchoolName($emptyResult);
        $this->assertEquals($emptyResult, $emptyResultTwice, "Empty string should be idempotent");

        // Test whitespace-only strings
        $whitespaceInputs = ['   ', "\t", "\n", " \t \n "];
        foreach ($whitespaceInputs as $input) {
            $result = $this->normalizationService->normalizeSchoolName($input);
            $resultTwice = $this->normalizationService->normalizeSchoolName($result);
            $this->assertEquals(
                $result, 
                $resultTwice, 
                "Whitespace-only input '{$input}' should be idempotent"
            );
        }
    }

    /**
     * Property: School Name Abbreviation Preservation Idempotence
     * 
     * Test that abbreviations remain stable through multiple normalizations.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('abbreviationSchoolNameProvider')]
    public function testAbbreviationPreservationIsIdempotent(string $schoolName): void
    {
        $normalizedOnce = $this->normalizationService->normalizeSchoolName($schoolName);
        $normalizedTwice = $this->normalizationService->normalizeSchoolName($normalizedOnce);
        
        $this->assertEquals(
            $normalizedOnce,
            $normalizedTwice,
            "School name with abbreviation should be idempotent. " .
            "Original: '{$schoolName}', " .
            "First: '{$normalizedOnce}', " .
            "Second: '{$normalizedTwice}'"
        );
    }

    /**
     * Data provider for comprehensive school name test cases
     * 
     * @return array<string, array{string}>
     */
    public static function schoolNameProvider(): array
    {
        return [
            // Basic cases - all uppercase
            'all uppercase single word' => ['DARWATA'],
            'all uppercase multiple words' => ['DARWATA GLEMPANG'],
            'all uppercase with abbreviation' => ['MI DARWATA GLEMPANG'],
            
            // Basic cases - all lowercase
            'all lowercase single word' => ['darwata'],
            'all lowercase multiple words' => ['darwata glempang'],
            'all lowercase with abbreviation' => ['mi darwata glempang'],
            
            // Mixed case
            'mixed case' => ['Mi Darwata glempang'],
            'random mixed case' => ['mI dArWaTa GlEmPaNg'],
            
            // With special characters
            'with apostrophe' => ["nu'man islamic school"],
            'with hyphen' => ['al-farabi madrasah'],
            'with multiple special chars' => ["al-ma'arif nu'man"],
            
            // Multiple abbreviations
            'multiple abbreviations' => ['MI NU DARWATA'],
            'mixed abbreviations' => ['mi nu darwata smp'],
            
            // Indonesian school names
            'typical MI name' => ['MI NURUL HUDA'],
            'typical MTs name' => ['MTs BAITUL HIKMAH'],
            'typical MA name' => ['MA TARBIYAH ISLAMIYAH'],
            'typical SD name' => ['SD MIFTAHUL ULUM'],
            'typical SMP name' => ['SMP DARUL FALAH'],
            'typical SMA name' => ['SMA ROUDLOTUL ATHFAL'],
            'typical SMK name' => ['SMK HIDAYAH SABILILLAH'],
            
            // Complex names
            'long complex name' => ['MI MAARIF NAHDLATUL ULAMA TAQWA IRSYAD'],
            'with numbers' => ['MI DARWATA 1 GLEMPANG'],
            'with parentheses' => ['MI DARWATA (PUSAT) GLEMPANG'],
            
            // Edge cases with whitespace
            'leading whitespace' => ['  MI DARWATA GLEMPANG'],
            'trailing whitespace' => ['MI DARWATA GLEMPANG  '],
            'multiple spaces' => ['MI   DARWATA    GLEMPANG'],
            'mixed whitespace' => [" \t MI DARWATA GLEMPANG \n "],
            
            // Single character and short names
            'single character' => ['A'],
            'two characters' => ['MI'],
            'abbreviation only' => ['NU'],
            
            // Names with common Indonesian words
            'with islamic terms' => ['PONDOK PESANTREN AL HIKMAH'],
            'with boarding school' => ['BOARDING SCHOOL QURANIC CENTER'],
            'with modern terms' => ['ISLAMIC INTERNATIONAL SCHOOL'],
        ];
    }

    /**
     * Data provider for school names with abbreviations
     * 
     * @return array<string, array{string}>
     */
    public static function abbreviationSchoolNameProvider(): array
    {
        $abbreviations = ['MI', 'MTs', 'MA', 'NU', 'SD', 'SMP', 'SMA', 'SMK'];
        $cases = [];
        
        foreach ($abbreviations as $abbr) {
            $cases["uppercase {$abbr}"] = ["{$abbr} DARWATA GLEMPANG"];
            $cases["lowercase {$abbr}"] = [strtolower($abbr) . " darwata glempang"];
            $cases["title case {$abbr}"] = [ucfirst(strtolower($abbr)) . " Darwata Glempang"];
            $cases["mixed case {$abbr}"] = [strtolower($abbr[0]) . strtoupper($abbr[1]) . " darwata"];
        }
        
        return $cases;
    }
}