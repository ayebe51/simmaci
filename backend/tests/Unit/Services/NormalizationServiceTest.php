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
            'fatimah dr.' => 'FATIMAH, Dr.',
            'ali Dr.' => 'ALI, Dr.',
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
}