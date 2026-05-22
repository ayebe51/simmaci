<?php

namespace Tests\Unit\Services;

use App\Services\StudentStatisticsService;
use PHPUnit\Framework\TestCase;

class StudentStatisticsServiceTest extends TestCase
{
    private StudentStatisticsService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new StudentStatisticsService();
    }

    // ── categorizeJenjang tests ──

    /**
     * @test
     * @group student-statistics
     */
    public function it_categorizes_null_jenjang_as_tidak_terdefinisi(): void
    {
        $this->assertEquals('Tidak Terdefinisi', $this->service->categorizeJenjang(null));
    }

    /**
     * @test
     * @group student-statistics
     */
    public function it_categorizes_empty_string_jenjang_as_tidak_terdefinisi(): void
    {
        $this->assertEquals('Tidak Terdefinisi', $this->service->categorizeJenjang(''));
    }

    /**
     * @test
     * @group student-statistics
     */
    public function it_categorizes_whitespace_only_jenjang_as_tidak_terdefinisi(): void
    {
        $this->assertEquals('Tidak Terdefinisi', $this->service->categorizeJenjang('   '));
        $this->assertEquals('Tidak Terdefinisi', $this->service->categorizeJenjang("\t"));
    }

    /**
     * @test
     * @group student-statistics
     */
    public function it_categorizes_ra_case_insensitive(): void
    {
        $this->assertEquals('RA', $this->service->categorizeJenjang('RA'));
        $this->assertEquals('RA', $this->service->categorizeJenjang('ra'));
        $this->assertEquals('RA', $this->service->categorizeJenjang('Ra'));
        $this->assertEquals('RA', $this->service->categorizeJenjang('rA'));
    }

    /**
     * @test
     * @group student-statistics
     */
    public function it_categorizes_mi_case_insensitive(): void
    {
        $this->assertEquals('MI', $this->service->categorizeJenjang('MI'));
        $this->assertEquals('MI', $this->service->categorizeJenjang('mi'));
        $this->assertEquals('MI', $this->service->categorizeJenjang('Mi'));
    }

    /**
     * @test
     * @group student-statistics
     */
    public function it_categorizes_mts_case_insensitive(): void
    {
        $this->assertEquals('MTs', $this->service->categorizeJenjang('MTs'));
        $this->assertEquals('MTs', $this->service->categorizeJenjang('mts'));
        $this->assertEquals('MTs', $this->service->categorizeJenjang('MTS'));
        $this->assertEquals('MTs', $this->service->categorizeJenjang('Mts'));
    }

    /**
     * @test
     * @group student-statistics
     */
    public function it_categorizes_ma_case_insensitive(): void
    {
        $this->assertEquals('MA', $this->service->categorizeJenjang('MA'));
        $this->assertEquals('MA', $this->service->categorizeJenjang('ma'));
        $this->assertEquals('MA', $this->service->categorizeJenjang('Ma'));
    }

    /**
     * @test
     * @group student-statistics
     */
    public function it_categorizes_unknown_jenjang_as_lainnya(): void
    {
        $this->assertEquals('Lainnya', $this->service->categorizeJenjang('SD'));
        $this->assertEquals('Lainnya', $this->service->categorizeJenjang('SMP'));
        $this->assertEquals('Lainnya', $this->service->categorizeJenjang('SMA'));
        $this->assertEquals('Lainnya', $this->service->categorizeJenjang('TK'));
        $this->assertEquals('Lainnya', $this->service->categorizeJenjang('random'));
    }

    /**
     * @test
     * @group student-statistics
     */
    public function it_trims_jenjang_before_categorizing(): void
    {
        $this->assertEquals('RA', $this->service->categorizeJenjang(' RA '));
        $this->assertEquals('MI', $this->service->categorizeJenjang(' mi '));
        $this->assertEquals('MTs', $this->service->categorizeJenjang(' MTs '));
        $this->assertEquals('MA', $this->service->categorizeJenjang(' MA '));
    }

    // ── normalizeKelas tests ──

    /**
     * @test
     * @group student-statistics
     */
    public function it_normalizes_null_kelas_to_belum_ditentukan(): void
    {
        $this->assertEquals('Belum Ditentukan', $this->service->normalizeKelas(null));
    }

    /**
     * @test
     * @group student-statistics
     */
    public function it_normalizes_empty_kelas_to_belum_ditentukan(): void
    {
        $this->assertEquals('Belum Ditentukan', $this->service->normalizeKelas(''));
    }

    /**
     * @test
     * @group student-statistics
     */
    public function it_normalizes_whitespace_only_kelas_to_belum_ditentukan(): void
    {
        $this->assertEquals('Belum Ditentukan', $this->service->normalizeKelas('   '));
        $this->assertEquals('Belum Ditentukan', $this->service->normalizeKelas("\t"));
        $this->assertEquals('Belum Ditentukan', $this->service->normalizeKelas("\n"));
        $this->assertEquals('Belum Ditentukan', $this->service->normalizeKelas("  \t  \n  "));
    }

    /**
     * @test
     * @group student-statistics
     */
    public function it_trims_valid_kelas_values(): void
    {
        $this->assertEquals('1A', $this->service->normalizeKelas(' 1A '));
        $this->assertEquals('VII-A', $this->service->normalizeKelas('  VII-A  '));
        $this->assertEquals('X IPA 1', $this->service->normalizeKelas(' X IPA 1 '));
    }

    /**
     * @test
     * @group student-statistics
     */
    public function it_returns_kelas_value_as_is_when_valid(): void
    {
        $this->assertEquals('1A', $this->service->normalizeKelas('1A'));
        $this->assertEquals('2B', $this->service->normalizeKelas('2B'));
        $this->assertEquals('VII-A', $this->service->normalizeKelas('VII-A'));
        $this->assertEquals('X IPA 1', $this->service->normalizeKelas('X IPA 1'));
    }

    // ── generateExportFilename tests ──

    /**
     * @test
     * @group student-statistics
     */
    public function it_generates_filename_with_sanitized_identifier(): void
    {
        $result = $this->service->generateExportFilename('Jumlah_Siswa', 'MI Nurul Huda');

        $this->assertStringStartsWith('Jumlah_Siswa_MI_Nurul_Huda_', $result);
        $this->assertStringEndsWith('.xlsx', $result);
    }

    /**
     * @test
     * @group student-statistics
     */
    public function it_replaces_special_characters_with_underscores(): void
    {
        $result = $this->service->generateExportFilename('Rekap_Siswa', "MI Al-Hikmah Nu'man");

        // Should not contain special characters
        $this->assertDoesNotMatchRegularExpression('/[^a-zA-Z0-9_.]/', $result);
        $this->assertStringStartsWith('Rekap_Siswa_MI_Al_Hikmah_Nu_man_', $result);
    }

    /**
     * @test
     * @group student-statistics
     */
    public function it_replaces_slashes_in_filename(): void
    {
        $result = $this->service->generateExportFilename('Jumlah_Siswa', 'MI/MTs Terpadu');

        $this->assertStringNotContainsString('/', $result);
        $this->assertStringStartsWith('Jumlah_Siswa_MI_MTs_Terpadu_', $result);
    }

    /**
     * @test
     * @group student-statistics
     */
    public function it_appends_timestamp_in_correct_format(): void
    {
        $result = $this->service->generateExportFilename('Jumlah_Siswa', 'MI Test');

        // Pattern: prefix_identifier_YYYYMMdd_HHmmss.xlsx
        $this->assertMatchesRegularExpression(
            '/^Jumlah_Siswa_MI_Test_\d{8}_\d{6}\.xlsx$/',
            $result
        );
    }

    /**
     * @test
     * @group student-statistics
     */
    public function it_collapses_multiple_underscores(): void
    {
        $result = $this->service->generateExportFilename('Jumlah_Siswa', 'MI   Test---School');

        // Should not have consecutive underscores in the identifier part
        $this->assertDoesNotMatchRegularExpression('/__/', $result);
    }
}
