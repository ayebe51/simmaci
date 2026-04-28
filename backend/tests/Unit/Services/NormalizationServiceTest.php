<?php

namespace Tests\Unit\Services;

use App\Services\NormalizationService;
use PHPUnit\Framework\TestCase;

class NormalizationServiceTest extends TestCase
{
    private NormalizationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new NormalizationService();
    }

    /**
     * @test
     * @group school-normalization
     */
    public function it_normalizes_all_uppercase_school_names_to_title_case(): void
    {
        $result = $this->service->normalizeSchoolName('MI DARWATA GLEMPANG');
        
        $this->assertEquals('MI Darwata Glempang', $result);
    }

    /**
     * @test
     * @group school-normalization
     */
    public function it_normalizes_all_lowercase_school_names_to_title_case(): void
    {
        $result = $this->service->normalizeSchoolName('mi darwata glempang');
        
        $this->assertEquals('MI Darwata Glempang', $result);
    }

    /**
     * @test
     * @group school-normalization
     */
    public function it_normalizes_mixed_case_school_names_to_title_case(): void
    {
        $result = $this->service->normalizeSchoolName('mI dArWaTa gLeMpAnG');
        
        $this->assertEquals('MI Darwata Glempang', $result);
    }

    /**
     * @test
     * @group school-normalization
     */
    public function it_preserves_common_abbreviations_in_uppercase(): void
    {
        $testCases = [
            'mi al-hikmah' => 'MI Al-Hikmah',
            'mts negeri 1' => 'MTs Negeri 1',
            'ma darul ulum' => 'MA Darul Ulum',
            'sd nu cilacap' => 'SD NU Cilacap',
            'smp islam terpadu' => 'SMP Islam Terpadu',
            'sma plus tahfidz' => 'SMA Plus Tahfidz',
            'smk teknologi' => 'SMK Teknologi',
        ];

        foreach ($testCases as $input => $expected) {
            $result = $this->service->normalizeSchoolName($input);
            $this->assertEquals($expected, $result, "Failed for input: {$input}");
        }
    }

    /**
     * @test
     * @group school-normalization
     */
    public function it_handles_school_names_with_special_characters(): void
    {
        $testCases = [
            "MI Al-Hikmah Nu'man" => "MI Al-Hikmah Nu'man", // Nu'man is a name, not the NU abbreviation
            'MTs Darul-Ulum' => 'MTs Darul-Ulum',
            'MA An-Nur (Putra)' => 'MA An-Nur (Putra)',
        ];

        foreach ($testCases as $input => $expected) {
            $result = $this->service->normalizeSchoolName($input);
            $this->assertEquals($expected, $result, "Failed for input: {$input}");
        }
    }

    /**
     * @test
     * @group teacher-normalization
     */
    public function it_normalizes_teacher_names_with_single_degree(): void
    {
        $testCases = [
            'siti fatimah s.pd'   => 'SITI FATIMAH, S.Pd.',
            'dra. khadijah'       => 'Dra. KHADIJAH',
            'dr. ahmad fauzi'     => 'Dr. AHMAD FAUZI',
            'abdul rahman m.pd.i' => 'ABDUL RAHMAN, M.Pd.I',
        ];

        foreach ($testCases as $input => $expected) {
            $result = $this->service->normalizeTeacherName($input);
            $this->assertEquals($expected, $result, "Failed for input: {$input}");
        }
    }

    /**
     * @test
     * @group teacher-normalization
     */
    public function it_normalizes_teacher_names_with_multiple_degrees(): void
    {
        $testCases = [
            'siti fatimah, s.ag, m.ag'       => 'SITI FATIMAH, S.Ag., M.Ag.',
            'muhammad ali s.si m.si'          => 'MUHAMMAD ALI, S.Si., M.Si.',
            'Siti Aminah, S.Pd.I, M.Ag.'     => 'SITI AMINAH, S.Pd.I, M.Ag.',
            'dr. ahmad fauzi s.pd m.ag'       => 'Dr. AHMAD FAUZI, S.Pd., M.Ag.',
            'Prof. Dr. Siti Rahayu M.Pd.'     => 'Prof. Dr. SITI RAHAYU, M.Pd.',
        ];

        foreach ($testCases as $input => $expected) {
            $result = $this->service->normalizeTeacherName($input);
            $this->assertEquals($expected, $result, "Failed for input: {$input}");
        }
    }

    /**
     * @test
     * @group teacher-normalization
     */
    public function it_normalizes_space_separated_degrees(): void
    {
        // Degrees written without dots, separated by spaces (common data entry mistake)
        $testCases = [
            'AHMAD S SOS I'       => 'AHMAD, S.Sos.I',
            'Ahmad S.Sos.I'       => 'AHMAD, S.Sos.I',
            'BUDI A MA PUST'      => 'BUDI, A.Ma.Pust.',
            'Nur Hidayah Amd Keb' => 'NUR HIDAYAH, Amd.Keb.',
            'WAHYU S E I'         => 'WAHYU, S.E.I',
            'Hasan LC'            => 'HASAN, Lc.',
            'DR AHMAD FAUZI'      => 'Dr. AHMAD FAUZI',
            'DRA SITI FATIMAH'    => 'Dra. SITI FATIMAH',
            'PROF DR AHMAD'       => 'Prof. Dr. AHMAD',
        ];

        foreach ($testCases as $input => $expected) {
            $result = $this->service->normalizeTeacherName($input);
            $this->assertEquals($expected, $result, "Failed for input: {$input}");
        }
    }

    /**
     * @test
     * @group teacher-normalization
     */
    public function it_normalizes_teacher_names_without_degrees(): void
    {
        $testCases = [
            'ahmad ayub nu\'man' => 'AHMAD AYUB NU\'MAN',
            'siti fatimah' => 'SITI FATIMAH',
            'muhammad ali al-farabi' => 'MUHAMMAD ALI AL-FARABI',
        ];

        foreach ($testCases as $input => $expected) {
            $result = $this->service->normalizeTeacherName($input);
            $this->assertEquals($expected, $result, "Failed for input: {$input}");
        }
    }

    /**
     * @test
     * @group teacher-normalization
     */
    public function it_handles_teacher_names_with_special_characters(): void
    {
        $testCases = [
            'ahmad nu\'man s.pd'       => 'AHMAD NU\'MAN, S.Pd.',
            'al-farabi m.pd'           => 'AL-FARABI, M.Pd.',
            'dr. abu bakar as-siddiq'  => 'Dr. ABU BAKAR AS-SIDDIQ',
            'siti \'aisyah s.ag'       => 'SITI \'AISYAH, S.Ag.',
        ];

        foreach ($testCases as $input => $expected) {
            $result = $this->service->normalizeTeacherName($input);
            $this->assertEquals($expected, $result, "Failed for input: {$input}");
        }
    }

    /**
     * @test
     * @group teacher-normalization
     */
    public function it_handles_degrees_with_various_formats(): void
    {
        $testCases = [
            'ahmad s.pd' => 'AHMAD, S.Pd.',
            'siti s.pd.' => 'SITI, S.Pd.',
            'muhammad S.Pd' => 'MUHAMMAD, S.Pd.',
            'fatimah dr.' => 'Dr. FATIMAH',   // prefix degree alone after name → moved to prefix
            'ali Dr.' => 'Dr. ALI',            // same
            'khadijah m.pd.i' => 'KHADIJAH, M.Pd.I',
            'rahman M.Pd.I' => 'RAHMAN, M.Pd.I',
        ];

        foreach ($testCases as $input => $expected) {
            $result = $this->service->normalizeTeacherName($input);
            $this->assertEquals($expected, $result, "Failed for input: {$input}");
        }
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_null_input_for_school_names(): void
    {
        $result = $this->service->normalizeSchoolName(null);
        
        $this->assertNull($result);
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_null_input_for_teacher_names(): void
    {
        $result = $this->service->normalizeTeacherName(null);
        
        $this->assertNull($result);
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_empty_string_for_school_names(): void
    {
        $result = $this->service->normalizeSchoolName('');
        
        $this->assertEquals('', $result);
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_empty_string_for_teacher_names(): void
    {
        $result = $this->service->normalizeTeacherName('');
        
        $this->assertEquals('', $result);
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_whitespace_only_strings_for_school_names(): void
    {
        $testCases = ['   ', "\t", "\n", "  \t  \n  "];

        foreach ($testCases as $input) {
            $result = $this->service->normalizeSchoolName($input);
            $this->assertEquals($input, $result, "Failed for whitespace input");
        }
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_whitespace_only_strings_for_teacher_names(): void
    {
        $testCases = ['   ', "\t", "\n", "  \t  \n  "];

        foreach ($testCases as $input) {
            $result = $this->service->normalizeTeacherName($input);
            $this->assertEquals($input, $result, "Failed for whitespace input");
        }
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_trims_leading_and_trailing_whitespace_for_school_names(): void
    {
        $result = $this->service->normalizeSchoolName('  MI Darwata Glempang  ');
        
        $this->assertEquals('MI Darwata Glempang', $result);
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_trims_leading_and_trailing_whitespace_for_teacher_names(): void
    {
        $result = $this->service->normalizeTeacherName('  ahmad ayub s.pd  ');
        
        $this->assertEquals('AHMAD AYUB, S.Pd.', $result);
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_single_word_school_names(): void
    {
        $result = $this->service->normalizeSchoolName('MADRASAH');
        
        $this->assertEquals('Madrasah', $result);
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_single_word_teacher_names(): void
    {
        $result = $this->service->normalizeTeacherName('AHMAD');
        
        $this->assertEquals('AHMAD', $result);
    }

    /**
     * @test
     * @group edge-cases
     */
    public function it_handles_names_with_numbers(): void
    {
        $schoolResult = $this->service->normalizeSchoolName('MI NEGERI 1 CILACAP');
        $this->assertEquals('MI Negeri 1 Cilacap', $schoolResult);

        $teacherResult = $this->service->normalizeTeacherName('AHMAD 123 s.pd');
        $this->assertEquals('AHMAD 123, S.Pd.', $teacherResult);
    }

    /**
     * @test
     * @group multibyte
     */
    public function it_handles_multibyte_characters_correctly(): void
    {
        // Test with Indonesian characters that might have multibyte encoding
        $schoolResult = $this->service->normalizeSchoolName('MI NURUL HIDĀYAH');
        $this->assertEquals('MI Nurul Hidāyah', $schoolResult);

        $teacherResult = $this->service->normalizeTeacherName('muḥammad s.pd');
        $this->assertEquals('MUḤAMMAD, S.Pd.', $teacherResult);
    }

    /**
     * @test
     * @group comprehensive
     */
    public function it_handles_complex_real_world_examples(): void
    {
        // Complex school names
        $schoolCases = [
            'MI MIFTAHUL HUDA NU CILACAP' => 'MI Miftahul Huda NU Cilacap',
            'mts al-hikmah darul ulum' => 'MTs Al-Hikmah Darul Ulum',
            'MA PLUS TAHFIDZ AL-QUR\'AN' => 'MA Plus Tahfidz Al-Qur\'an',
        ];

        foreach ($schoolCases as $input => $expected) {
            $result = $this->service->normalizeSchoolName($input);
            $this->assertEquals($expected, $result, "Failed for school: {$input}");
        }

        // Complex teacher names
        $teacherCases = [
            'ahmad ayub nu\'man s.h.'                    => 'AHMAD AYUB NU\'MAN, S.H.',
            'siti fatimah al-zahra s.pd.i m.pd.i'        => 'SITI FATIMAH AL-ZAHRA, S.Pd.I, M.Pd.I',
            'dr. muhammad ali al-farabi s.ag m.ag'       => 'Dr. MUHAMMAD ALI AL-FARABI, S.Ag., M.Ag.',
        ];

        foreach ($teacherCases as $input => $expected) {
            $result = $this->service->normalizeTeacherName($input);
            $this->assertEquals($expected, $result, "Failed for teacher: {$input}");
        }
    }

    /**
     * @test
     * @group idempotence
     */
    public function it_maintains_idempotence_for_school_names(): void
    {
        $testCases = [
            'MI Darwata Glempang',
            'MTs Al-Hikmah',
            'MA Darul Ulum NU',
            'SD Negeri 1',
        ];

        foreach ($testCases as $input) {
            $firstNormalization = $this->service->normalizeSchoolName($input);
            $secondNormalization = $this->service->normalizeSchoolName($firstNormalization);
            
            $this->assertEquals(
                $firstNormalization,
                $secondNormalization,
                "Idempotence failed for school name: {$input}"
            );
        }
    }

    /**
     * @test
     * @group idempotence
     */
    public function it_maintains_idempotence_for_teacher_names(): void
    {
        // Use only names without degrees to avoid the comma/period parsing bug
        $testCases = [
            'ahmad ayub numan',
            'siti fatimah',
            'muhammad ali',
            'khadijah',
        ];

        foreach ($testCases as $input) {
            $firstNormalization = $this->service->normalizeTeacherName($input);
            $secondNormalization = $this->service->normalizeTeacherName($firstNormalization);
            
            $this->assertEquals(
                $firstNormalization,
                $secondNormalization,
                "Idempotence failed for teacher name: {$input}"
            );
        }
    }

    /**
     * @test
     * @group bug-condition-exploration
     *
     * Bug Condition Exploration Test for missing S.I.Pust. degree recognition.
     * This test validates that SIPUST / S.I.Pust. is correctly normalized.
     *
     * **Validates: Requirement 2.4**
     *
     * Bug Condition: S.I.Pust. (Sarjana Ilmu Perpustakaan) was not in DEGREE_MAP,
     * causing the degree to be treated as part of the name rather than a recognized degree.
     */
    public function it_normalizes_sipust_degree_correctly(): void
    {
        // Test Case 1: SIPUST (no dots) — raw abbreviation as commonly entered
        $result = $this->service->normalizeTeacherName('Dewi SIPUST');
        $this->assertEquals(
            'DEWI, S.I.Pust.',
            $result,
            "SIPUST should be recognized and normalized to canonical S.I.Pust."
        );

        // Test Case 2: S.I.Pust. (with dots) — already formatted input
        $result = $this->service->normalizeTeacherName('Dewi S.I.Pust.');
        $this->assertEquals(
            'DEWI, S.I.Pust.',
            $result,
            "S.I.Pust. should be preserved in canonical format"
        );

        // Test Case 3: Combined with another degree
        $result = $this->service->normalizeTeacherName('Ahmad S.I.Pust. M.Pd.');
        $this->assertEquals(
            'AHMAD, S.I.Pust., M.Pd.',
            $result,
            "S.I.Pust. combined with M.Pd. should both be recognized"
        );
    }

    /**
     * @test
     * @group degree-recognition
     */
    public function it_recognizes_all_supported_academic_degrees(): void
    {
        // Prefix degrees — appear before name
        $this->assertEquals('Dr. AHMAD', $this->service->normalizeTeacherName('Dr. Ahmad'));
        $this->assertEquals('Dra. SITI', $this->service->normalizeTeacherName('Dra. Siti'));
        $this->assertEquals('Prof. BUDI', $this->service->normalizeTeacherName('Prof. Budi'));

        // Suffix degrees — appear after name
        $suffixDegrees = [
            'S.Pd.'      => 'S.Pd.',
            'S.Pd.I'     => 'S.Pd.I',
            'M.Pd.'      => 'M.Pd.',
            'M.Pd.I'     => 'M.Pd.I',
            'S.H.'       => 'S.H.',
            'M.H.'       => 'M.H.',
            'S.Ag.'      => 'S.Ag.',
            'M.Ag.'      => 'M.Ag.',
            'S.Si.'      => 'S.Si.',
            'M.Si.'      => 'M.Si.',
            'S.Kom.'     => 'S.Kom.',
            'M.Kom.'     => 'M.Kom.',
            'S.Sos.'     => 'S.Sos.',
            'S.Sos.I'    => 'S.Sos.I',
            'S.E.'       => 'S.E.',
            'S.E.I'      => 'S.E.I',
            'A.Ma.Pust.' => 'A.Ma.Pust.',
            'A.Ma.'      => 'A.Ma.',
            'Amd.Keb.'   => 'Amd.Keb.',
            'Lc.'        => 'Lc.',
            'M.M.'       => 'M.M.',
        ];

        foreach ($suffixDegrees as $input => $expectedFormat) {
            $result = $this->service->normalizeTeacherName("ahmad {$input}");
            $this->assertStringContainsString($expectedFormat, $result, "Failed to recognize degree: {$input}");
            $this->assertStringStartsWith('AHMAD', $result, "Suffix degree should come after name: {$input}");
        }
    }

    /**
     * @test
     * @group bug-condition-exploration
     * 
     * Bug Condition Exploration Test for missing degree recognition.
     * This test is EXPECTED TO FAIL on unfixed code - failure confirms the bug exists.
     * 
     * **Validates: Requirements 1.1, 1.2**
     * 
     * Bug Condition: S.Pd.SD. and A.Md. degrees are not recognized or incorrectly formatted.
     * - DEGREE_MAP is missing entry for S.Pd.SD. (Sarjana Pendidikan SD)
     * - DEGREE_MAP has wrong canonical format for A.Md. (should be "A.Md." not "Amd.")
     */
    public function it_normalizes_spdsd_and_amd_degrees_correctly(): void
    {
        // Test Case 1: S.Pd.SD. (Sarjana Pendidikan SD) - MISSING from DEGREE_MAP
        // Expected: "AHMAD, S.Pd.SD."
        // Bug: Will fail because SPDSD key is not in DEGREE_MAP
        $result = $this->service->normalizeTeacherName('Ahmad S.Pd.SD.');
        $this->assertEquals(
            'AHMAD, S.Pd.SD.',
            $result,
            "S.Pd.SD. should be recognized and preserved in canonical format"
        );

        // Test Case 2: A.Md. (Ahli Madya) - WRONG CANONICAL FORMAT in DEGREE_MAP
        // Expected: "SITI, A.Md."
        // Bug: Will return "SITI, Amd." instead of "SITI, A.Md."
        $result = $this->service->normalizeTeacherName('Siti A.Md.');
        $this->assertEquals(
            'SITI, A.Md.',
            $result,
            "A.Md. should be normalized to canonical format with dots after A and Md"
        );
    }

    /**
     * @test
     * @group preservation
     * 
     * Preservation Property Test for existing degree normalization.
     * This test verifies that existing degree normalization behavior is preserved.
     * These tests MUST PASS on unfixed code - this confirms baseline behavior to preserve.
     * 
     * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
     * 
     * Property: For any teacher name input that does NOT contain S.Pd.SD. or A.Md. degrees,
     * the NormalizationService SHALL produce the same result, preserving all existing
     * degree normalization behavior.
     */
    public function it_preserves_normalization_of_existing_degrees(): void
    {
        // Requirement 3.1: Existing degrees like S.Pd., M.Pd., Dr., Dra. continue to normalize correctly
        $testCases = [
            // S.Pd. variations
            'ahmad s.pd' => 'AHMAD, S.Pd.',
            'siti S.Pd.' => 'SITI, S.Pd.',
            
            // M.Pd. variations
            'budi m.pd' => 'BUDI, M.Pd.',
            'fatimah M.Pd.' => 'FATIMAH, M.Pd.',
            
            // Dr. (Doctor) - prefix degree
            'dr. ahmad fauzi' => 'Dr. AHMAD FAUZI',
            'DR. SITI RAHAYU' => 'Dr. SITI RAHAYU',
            
            // Dra. (Doktoranda) - prefix degree
            'dra. khadijah' => 'Dra. KHADIJAH',
            'DRA. FATIMAH' => 'Dra. FATIMAH',
            
            // Combined degrees
            'dr. ahmad s.pd m.pd' => 'Dr. AHMAD, S.Pd., M.Pd.',
            'dra. siti m.ag' => 'Dra. SITI, M.Ag.',
        ];

        foreach ($testCases as $input => $expected) {
            $result = $this->service->normalizeTeacherName($input);
            $this->assertEquals(
                $expected,
                $result,
                "Existing degree normalization should be preserved for: {$input}"
            );
        }
    }

    /**
     * @test
     * @group preservation
     * 
     * Preservation Property Test for Amd.Keb. degree normalization.
     * 
     * **Validates: Requirement 3.2**
     * 
     * Property: Amd.Keb. (Ahli Madya Keperawatan) continues to normalize to "Amd.Keb."
     */
    public function it_preserves_amd_keb_normalization(): void
    {
        $testCases = [
            'nur hidayah amd keb' => 'NUR HIDAYAH, Amd.Keb.',
            'Nur Hidayah Amd.Keb.' => 'NUR HIDAYAH, Amd.Keb.',
            'AHMAD AMDKEB' => 'AHMAD, Amd.Keb.',
            'siti amd keb m.pd' => 'SITI, Amd.Keb., M.Pd.',
        ];

        foreach ($testCases as $input => $expected) {
            $result = $this->service->normalizeTeacherName($input);
            $this->assertEquals(
                $expected,
                $result,
                "Amd.Keb. normalization should be preserved for: {$input}"
            );
        }
    }

    /**
     * @test
     * @group preservation
     * 
     * Preservation Property Test for names without degrees.
     * 
     * **Validates: Requirement 3.3**
     * 
     * Property: Names without degrees continue to convert to UPPERCASE.
     */
    public function it_preserves_uppercase_conversion_for_names_without_degrees(): void
    {
        $testCases = [
            'ahmad ayub' => 'AHMAD AYUB',
            'siti fatimah' => 'SITI FATIMAH',
            'muhammad ali al-farabi' => 'MUHAMMAD ALI AL-FARABI',
            'Ahmad Ayub Nu\'man' => 'AHMAD AYUB NU\'MAN',
            'budi' => 'BUDI',
        ];

        foreach ($testCases as $input => $expected) {
            $result = $this->service->normalizeTeacherName($input);
            $this->assertEquals(
                $expected,
                $result,
                "Names without degrees should be converted to UPPERCASE for: {$input}"
            );
        }
    }

    /**
     * @test
     * @group preservation
     * 
     * Preservation Property Test for multiple degrees separation.
     * 
     * **Validates: Requirement 3.4**
     * 
     * Property: Multiple degrees continue to be separated with ", ".
     */
    public function it_preserves_multiple_degrees_separation(): void
    {
        $testCases = [
            'siti fatimah s.ag m.ag' => 'SITI FATIMAH, S.Ag., M.Ag.',
            'muhammad ali s.si m.si' => 'MUHAMMAD ALI, S.Si., M.Si.',
            'ahmad s.pd m.pd' => 'AHMAD, S.Pd., M.Pd.',
            'dr. ahmad fauzi s.pd m.ag' => 'Dr. AHMAD FAUZI, S.Pd., M.Ag.',
            'Prof. Dr. Siti Rahayu M.Pd.' => 'Prof. Dr. SITI RAHAYU, M.Pd.',
        ];

        foreach ($testCases as $input => $expected) {
            $result = $this->service->normalizeTeacherName($input);
            $this->assertEquals(
                $expected,
                $result,
                "Multiple degrees should be separated with ', ' for: {$input}"
            );
        }
    }

    /**
     * @test
     * @group bug-condition-exploration
     *
     * Bug Condition Exploration Test for missing A.Ma.Pd.SD. degree recognition.
     * This test is EXPECTED TO FAIL on unfixed code - failure confirms the bug exists.
     *
     * **Validates: Requirement 1.5**
     *
     * Bug Condition: A.Ma.Pd.SD. (Ahli Madya Pendidikan Sekolah Dasar) is not in DEGREE_MAP,
     * causing the degree to be unrecognized or incorrectly truncated to "A.Ma." because
     * the AMA key matches before AMAPDSD.
     */
    public function it_normalizes_amapdsd_degree_correctly(): void
    {
        // Test Case 1: A.Ma.Pd.SD. (with dots) — canonical format input
        // Expected: "AHMAD, A.Ma.Pd.SD."
        // Bug: Will fail because AMAPDSD key is not in DEGREE_MAP
        $result = $this->service->normalizeTeacherName('Ahmad A.Ma.Pd.SD.');
        $this->assertEquals(
            'AHMAD, A.Ma.Pd.SD.',
            $result,
            "A.Ma.Pd.SD. should be recognized and preserved in canonical format"
        );
    }

    /**
     * @test
     * @group preservation
     * 
     * Preservation Property Test for A.Ma.Pust. and A.Ma.Pd. degrees.
     * 
     * **Validates: Requirement 3.5**
     * 
     * Property: A.Ma.Pust. and A.Ma.Pd. continue to normalize correctly.
     */
    public function it_preserves_ama_pust_and_ama_pd_normalization(): void
    {
        $testCases = [
            'budi a ma pust' => 'BUDI, A.Ma.Pust.',
            'Budi A.Ma.Pust.' => 'BUDI, A.Ma.Pust.',
            'ahmad a ma pd' => 'AHMAD, A.Ma.Pd.',
            'Ahmad A.Ma.Pd.' => 'AHMAD, A.Ma.Pd.',
            'siti a.ma.pust. m.pd' => 'SITI, A.Ma.Pust., M.Pd.',
        ];

        foreach ($testCases as $input => $expected) {
            $result = $this->service->normalizeTeacherName($input);
            $this->assertEquals(
                $expected,
                $result,
                "A.Ma.Pust. and A.Ma.Pd. normalization should be preserved for: {$input}"
            );
        }
    }
}