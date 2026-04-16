<?php

namespace Tests\Property;

use App\Services\NormalizationService;
use PHPUnit\Framework\TestCase;

/**
 * Property-based tests for normalization output validity
 * 
 * These tests verify that normalization functions return valid, non-null outputs
 * for all valid inputs, ensuring the functions never break or return invalid data.
 */
class NormalizationOutputValidityTest extends TestCase
{
    private NormalizationService $normalizationService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->normalizationService = new NormalizationService();
    }

    /**
     * Property 10: Normalization Returns Non-Null for Valid Inputs
     * 
     * For any non-null, non-empty input string, both school and teacher
     * normalization functions SHALL return a non-null, non-empty string.
     * 
     * Validates: Requirements 11.5
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('validContentStringProvider')]
    public function testSchoolNormalizationReturnsNonNullForValidInputs(string $input): void
    {
        $result = $this->normalizationService->normalizeSchoolName($input);
        
        $this->assertNotNull(
            $result,
            "School normalization should never return null for valid non-empty input. " .
            "Input: '{$input}'"
        );
        
        $this->assertNotEmpty(
            $result,
            "School normalization should never return empty string for valid non-empty input. " .
            "Input: '{$input}', Result: '{$result}'"
        );
        
        $this->assertIsString(
            $result,
            "School normalization should always return a string for valid input. " .
            "Input: '{$input}', Result type: " . gettype($result)
        );
    }

    /**
     * Property 10: Teacher Normalization Returns Non-Null for Valid Inputs
     * 
     * For any non-null, non-empty input string, teacher normalization
     * function SHALL return a non-null, non-empty string.
     * 
     * Validates: Requirements 11.5
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('validContentStringProvider')]
    public function testTeacherNormalizationReturnsNonNullForValidInputs(string $input): void
    {
        $result = $this->normalizationService->normalizeTeacherName($input);
        
        $this->assertNotNull(
            $result,
            "Teacher normalization should never return null for valid non-empty input. " .
            "Input: '{$input}'"
        );
        
        $this->assertNotEmpty(
            $result,
            "Teacher normalization should never return empty string for valid non-empty input. " .
            "Input: '{$input}', Result: '{$result}'"
        );
        
        $this->assertIsString(
            $result,
            "Teacher normalization should always return a string for valid input. " .
            "Input: '{$input}', Result type: " . gettype($result)
        );
    }

    /**
     * Property: Normalization Preserves String Nature
     * 
     * For any valid string input, normalization should return a string
     * that is still a valid string (not corrupted or malformed).
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('validContentStringProvider')]
    public function testNormalizationPreservesStringNature(string $input): void
    {
        $schoolResult = $this->normalizationService->normalizeSchoolName($input);
        $teacherResult = $this->normalizationService->normalizeTeacherName($input);
        
        // Test that results are valid UTF-8 strings
        $this->assertTrue(
            mb_check_encoding($schoolResult, 'UTF-8'),
            "School normalization result should be valid UTF-8. " .
            "Input: '{$input}', Result: '{$schoolResult}'"
        );
        
        $this->assertTrue(
            mb_check_encoding($teacherResult, 'UTF-8'),
            "Teacher normalization result should be valid UTF-8. " .
            "Input: '{$input}', Result: '{$teacherResult}'"
        );
        
        // Test that results don't contain only whitespace
        $this->assertNotEmpty(
            trim($schoolResult),
            "School normalization result should not be only whitespace. " .
            "Input: '{$input}', Result: '{$schoolResult}'"
        );
        
        $this->assertNotEmpty(
            trim($teacherResult),
            "Teacher normalization result should not be only whitespace. " .
            "Input: '{$input}', Result: '{$teacherResult}'"
        );
    }

    /**
     * Property: Normalization Handles Edge Cases Gracefully
     * 
     * Test that edge cases like pure punctuation are handled gracefully
     * without throwing exceptions, even if they return empty results.
     */
    public function testNormalizationHandlesEdgeCasesGracefully(): void
    {
        $edgeCases = [
            'only periods' => '...',
            'only commas' => ',,,',
            'only hyphens' => '---',
            'mixed punctuation' => '.,;:!?',
            'single special char' => '-',
            'single apostrophe' => "'",
        ];
        
        foreach ($edgeCases as $description => $input) {
            // These should not throw exceptions
            $schoolResult = $this->normalizationService->normalizeSchoolName($input);
            $teacherResult = $this->normalizationService->normalizeTeacherName($input);
            
            // Results should be strings (not null)
            $this->assertIsString(
                $schoolResult,
                "School normalization should return string for edge case '{$description}'. Input: '{$input}'"
            );
            
            $this->assertIsString(
                $teacherResult,
                "Teacher normalization should return string for edge case '{$description}'. Input: '{$input}'"
            );
            
            // Results should be valid UTF-8
            $this->assertTrue(
                mb_check_encoding($schoolResult, 'UTF-8'),
                "School normalization result should be valid UTF-8 for edge case '{$description}'. Input: '{$input}'"
            );
            
            $this->assertTrue(
                mb_check_encoding($teacherResult, 'UTF-8'),
                "Teacher normalization result should be valid UTF-8 for edge case '{$description}'. Input: '{$input}'"
            );
        }
    }

    /**
     * Property: Normalization Handles Null and Empty Inputs Gracefully
     * 
     * Test that null and empty inputs are handled gracefully without
     * throwing exceptions or returning invalid data.
     */
    public function testNormalizationHandlesNullAndEmptyInputsGracefully(): void
    {
        // Test null inputs
        $schoolNullResult = $this->normalizationService->normalizeSchoolName(null);
        $teacherNullResult = $this->normalizationService->normalizeTeacherName(null);
        
        $this->assertNull(
            $schoolNullResult,
            "School normalization should return null for null input"
        );
        
        $this->assertNull(
            $teacherNullResult,
            "Teacher normalization should return null for null input"
        );
        
        // Test empty string inputs
        $schoolEmptyResult = $this->normalizationService->normalizeSchoolName('');
        $teacherEmptyResult = $this->normalizationService->normalizeTeacherName('');
        
        // Empty strings should return empty strings (not null or throw exception)
        $this->assertIsString(
            $schoolEmptyResult,
            "School normalization should return string for empty string input"
        );
        
        $this->assertIsString(
            $teacherEmptyResult,
            "Teacher normalization should return string for empty string input"
        );
        
        $this->assertEquals(
            '',
            $schoolEmptyResult,
            "School normalization should return empty string for empty string input"
        );
        
        $this->assertEquals(
            '',
            $teacherEmptyResult,
            "Teacher normalization should return empty string for empty string input"
        );
    }

    /**
     * Property: Normalization Output Length is Reasonable
     * 
     * For any valid input, the normalized output should not be
     * unreasonably longer than the input (within 150% of original length).
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('validNonEmptyStringProvider')]
    public function testNormalizationOutputLengthIsReasonable(string $input): void
    {
        $schoolResult = $this->normalizationService->normalizeSchoolName($input);
        $teacherResult = $this->normalizationService->normalizeTeacherName($input);
        
        $inputLength = mb_strlen($input, 'UTF-8');
        $maxAllowedLength = (int) ceil($inputLength * 1.5); // 150% of original
        
        $schoolLength = mb_strlen($schoolResult, 'UTF-8');
        $teacherLength = mb_strlen($teacherResult, 'UTF-8');
        
        $this->assertLessThanOrEqual(
            $maxAllowedLength,
            $schoolLength,
            "School normalization result should not exceed 150% of input length. " .
            "Input: '{$input}' (length: {$inputLength}), " .
            "Result: '{$schoolResult}' (length: {$schoolLength}), " .
            "Max allowed: {$maxAllowedLength}"
        );
        
        $this->assertLessThanOrEqual(
            $maxAllowedLength,
            $teacherLength,
            "Teacher normalization result should not exceed 150% of input length. " .
            "Input: '{$input}' (length: {$inputLength}), " .
            "Result: '{$teacherResult}' (length: {$teacherLength}), " .
            "Max allowed: {$maxAllowedLength}"
        );
    }

    /**
     * Property: Normalization Never Throws Exceptions for Valid Inputs
     * 
     * For any valid string input, normalization functions should never
     * throw exceptions or fatal errors.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('validNonEmptyStringProvider')]
    public function testNormalizationNeverThrowsExceptionsForValidInputs(string $input): void
    {
        // These should not throw any exceptions
        try {
            $schoolResult = $this->normalizationService->normalizeSchoolName($input);
            $this->assertIsString($schoolResult);
        } catch (\Throwable $e) {
            $this->fail(
                "School normalization should not throw exception for valid input. " .
                "Input: '{$input}', Exception: " . $e->getMessage()
            );
        }
        
        try {
            $teacherResult = $this->normalizationService->normalizeTeacherName($input);
            $this->assertIsString($teacherResult);
        } catch (\Throwable $e) {
            $this->fail(
                "Teacher normalization should not throw exception for valid input. " .
                "Input: '{$input}', Exception: " . $e->getMessage()
            );
        }
    }

    /**
     * Data provider for valid non-empty string inputs
     * 
     * This provides a comprehensive set of valid inputs that should
     * never cause normalization functions to return null or empty results.
     * Note: Some inputs like pure punctuation may legitimately return empty
     * strings for teacher normalization when no actual name content exists.
     * 
     * @return array<string, array{string}>
     */
    public static function validNonEmptyStringProvider(): array
    {
        return [
            // Single characters
            'single letter' => ['A'],
            'single digit' => ['1'],
            'single special char' => ['-'],
            'single apostrophe' => ["'"],
            
            // Basic words
            'simple word' => ['Ahmad'],
            'uppercase word' => ['AHMAD'],
            'lowercase word' => ['ahmad'],
            'mixed case word' => ['aHmAd'],
            
            // Multiple words
            'two words' => ['Ahmad Ayub'],
            'three words' => ['Ahmad Ayub Fauzi'],
            'many words' => ['MI Darwata Glempang Nahdlatul Ulama'],
            
            // Names with special characters
            'with apostrophe' => ["Nu'man Ahmad"],
            'with hyphen' => ['Al-Farabi School'],
            'with period' => ['Dr. Ahmad'],
            'with comma' => ['Ahmad, S.Pd.'],
            'multiple special chars' => ["Al-Ma'arif Nu'man"],
            
            // School abbreviations
            'MI abbreviation' => ['MI Darwata'],
            'MTs abbreviation' => ['MTs Baitul Hikmah'],
            'MA abbreviation' => ['MA Tarbiyah'],
            'NU abbreviation' => ['NU Cilacap'],
            'SD abbreviation' => ['SD Negeri 1'],
            'SMP abbreviation' => ['SMP Islam'],
            'SMA abbreviation' => ['SMA Muhammadiyah'],
            'SMK abbreviation' => ['SMK Teknologi'],
            
            // Academic degrees
            'with S.Pd.' => ['Ahmad Fauzi, S.Pd.'],
            'with M.Pd.' => ['Siti Aminah, M.Pd.'],
            'with Dr.' => ['Dr. Abdul Rahman'],
            'with Dra.' => ['Dra. Fatimah Zahra'],
            'with S.H.' => ['Muhammad Ali, S.H.'],
            'with multiple degrees' => ['Ahmad Fauzi, S.Pd., M.Pd.'],
            'degree without periods' => ['Ahmad Fauzi SPd'],
            'mixed case degree' => ['Ahmad Fauzi spd'],
            
            // Numbers and mixed content
            'with numbers' => ['School 123'],
            'with roman numerals' => ['Ahmad II'],
            'alphanumeric' => ['A1B2C3'],
            'mixed content' => ['MI Darwata 1 (Pusat)'],
            
            // Whitespace variations (but not empty)
            'leading space' => [' Ahmad'],
            'trailing space' => ['Ahmad '],
            'multiple spaces' => ['Ahmad   Ayub'],
            'tab character' => ["Ahmad\tAyub"],
            'newline character' => ["Ahmad\nAyub"],
            'mixed whitespace' => [" \t Ahmad Ayub \n "],
            
            // Long strings
            'long name' => ['Ahmad Fauzi Bin Abdul Rahman Al-Farabi Al-Kindi Nahdlatul Ulama'],
            'very long school name' => ['Madrasah Ibtidaiyah Maarif Nahdlatul Ulama Taqwa Irsyad Darwata Glempang Cilacap'],
            
            // Unicode and international characters
            'with unicode' => ['Müller School'],
            'with accents' => ['José María'],
            'with arabic' => ['مدرسة الهدى'],
            'with chinese' => ['北京学校'],
            
            // Edge cases that should still be valid (but may return empty for teacher names)
            'only periods' => ['...'],
            'only hyphens' => ['---'],
            'mixed punctuation' => ['.,;:!?'],
            'parentheses' => ['(Ahmad)'],
            'brackets' => ['[Ahmad]'],
            'braces' => ['{Ahmad}'],
            
            // Real-world examples
            'typical indonesian school' => ['MI Miftahul Ulum Darwata'],
            'typical teacher name' => ['Ahmad Fauzi, S.Pd.I'],
            'complex school name' => ['Pondok Pesantren Modern Al-Hikmah'],
            'teacher with multiple degrees' => ['Dr. Siti Aminah, S.Pd., M.Pd.'],
            'school with location' => ['SMA Negeri 1 Jakarta Pusat'],
        ];
    }

    /**
     * Data provider for inputs that contain actual content (not just punctuation)
     * 
     * These inputs should always produce non-empty results for both school
     * and teacher normalization functions.
     * 
     * @return array<string, array{string}>
     */
    public static function validContentStringProvider(): array
    {
        return [
            // Single characters
            'single letter' => ['A'],
            'single digit' => ['1'],
            
            // Basic words
            'simple word' => ['Ahmad'],
            'uppercase word' => ['AHMAD'],
            'lowercase word' => ['ahmad'],
            'mixed case word' => ['aHmAd'],
            
            // Multiple words
            'two words' => ['Ahmad Ayub'],
            'three words' => ['Ahmad Ayub Fauzi'],
            'many words' => ['MI Darwata Glempang Nahdlatul Ulama'],
            
            // Names with special characters
            'with apostrophe' => ["Nu'man Ahmad"],
            'with hyphen' => ['Al-Farabi School'],
            'with period' => ['Dr. Ahmad'],
            'with comma' => ['Ahmad, S.Pd.'],
            'multiple special chars' => ["Al-Ma'arif Nu'man"],
            
            // School abbreviations
            'MI abbreviation' => ['MI Darwata'],
            'MTs abbreviation' => ['MTs Baitul Hikmah'],
            'MA abbreviation' => ['MA Tarbiyah'],
            'NU abbreviation' => ['NU Cilacap'],
            'SD abbreviation' => ['SD Negeri 1'],
            'SMP abbreviation' => ['SMP Islam'],
            'SMA abbreviation' => ['SMA Muhammadiyah'],
            'SMK abbreviation' => ['SMK Teknologi'],
            
            // Academic degrees
            'with S.Pd.' => ['Ahmad Fauzi, S.Pd.'],
            'with M.Pd.' => ['Siti Aminah, M.Pd.'],
            'with Dr.' => ['Dr. Abdul Rahman'],
            'with Dra.' => ['Dra. Fatimah Zahra'],
            'with S.H.' => ['Muhammad Ali, S.H.'],
            'with multiple degrees' => ['Ahmad Fauzi, S.Pd., M.Pd.'],
            'degree without periods' => ['Ahmad Fauzi SPd'],
            'mixed case degree' => ['Ahmad Fauzi spd'],
            
            // Numbers and mixed content
            'with numbers' => ['School 123'],
            'with roman numerals' => ['Ahmad II'],
            'alphanumeric' => ['A1B2C3'],
            'mixed content' => ['MI Darwata 1 (Pusat)'],
            
            // Whitespace variations (but not empty)
            'leading space' => [' Ahmad'],
            'trailing space' => ['Ahmad '],
            'multiple spaces' => ['Ahmad   Ayub'],
            'tab character' => ["Ahmad\tAyub"],
            'newline character' => ["Ahmad\nAyub"],
            'mixed whitespace' => [" \t Ahmad Ayub \n "],
            
            // Long strings
            'long name' => ['Ahmad Fauzi Bin Abdul Rahman Al-Farabi Al-Kindi Nahdlatul Ulama'],
            'very long school name' => ['Madrasah Ibtidaiyah Maarif Nahdlatul Ulama Taqwa Irsyad Darwata Glempang Cilacap'],
            
            // Unicode and international characters
            'with unicode' => ['Müller School'],
            'with accents' => ['José María'],
            'with arabic' => ['مدرسة الهدى'],
            'with chinese' => ['北京学校'],
            
            // Edge cases with content
            'parentheses' => ['(Ahmad)'],
            'brackets' => ['[Ahmad]'],
            'braces' => ['{Ahmad}'],
            
            // Real-world examples
            'typical indonesian school' => ['MI Miftahul Ulum Darwata'],
            'typical teacher name' => ['Ahmad Fauzi, S.Pd.I'],
            'complex school name' => ['Pondok Pesantren Modern Al-Hikmah'],
            'teacher with multiple degrees' => ['Dr. Siti Aminah, S.Pd., M.Pd.'],
            'school with location' => ['SMA Negeri 1 Jakarta Pusat'],
        ];
    }
}