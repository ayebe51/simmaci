<?php

namespace Tests\Unit\Services;

use App\Services\NormalizationService;
use App\Services\StrictDateValidationService;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PHPUnit\Framework\TestCase;

class StrictDateValidationServiceTest extends TestCase
{
    private StrictDateValidationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $normalizationService = new NormalizationService();
        $this->service = new StrictDateValidationService($normalizationService);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POSITIVE CASES
    // ─────────────────────────────────────────────────────────────────────────

    public function test_accepts_abbreviated_month(): void
    {
        $res = $this->service->validateDateString('11 Nov 2022');
        $this->assertTrue($res['valid']);
        $this->assertSame('2022-11-11', $res['normalized']);
        $this->assertNull($res['reason']);
    }

    public function test_accepts_full_month_name(): void
    {
        $res = $this->service->validateDateString('11 November 2022');
        $this->assertTrue($res['valid']);
        $this->assertSame('2022-11-11', $res['normalized']);
    }

    public function test_accepts_and_standardizes_nopember_alias(): void
    {
        $res = $this->service->validateDateString('11 Nopember 2022');
        $this->assertTrue($res['valid']);
        $this->assertSame('11 November 2022', $res['standardized']);
        $this->assertSame('2022-11-11', $res['normalized']);
    }

    public function test_accepts_leading_zero_day(): void
    {
        $res = $this->service->validateDateString('05 Januari 2023');
        $this->assertTrue($res['valid']);
        $this->assertSame('2023-01-05', $res['normalized']);
    }

    public function test_accepts_indonesian_agu_abbreviation(): void
    {
        $res = $this->service->validateDateString('21 Agu 2024');
        $this->assertTrue($res['valid']);
        $this->assertSame('2024-08-21', $res['normalized']);
    }

    public function test_accepts_full_agustus(): void
    {
        $res = $this->service->validateDateString('21 Agustus 2024');
        $this->assertTrue($res['valid']);
        $this->assertSame('2024-08-21', $res['normalized']);
    }

    public function test_is_case_insensitive(): void
    {
        $cases = [
            '11 nov 2022'       => '2022-11-11',
            '11 NOV 2022'       => '2022-11-11',
            '11 NOVEMBER 2022'  => '2022-11-11',
            '11 NoPeMbEr 2022'  => '2022-11-11',
            '05 JANUARI 2023'   => '2023-01-05',
            '21 AGU 2024'       => '2024-08-21',
        ];

        foreach ($cases as $input => $expected) {
            $res = $this->service->validateDateString($input);
            $this->assertTrue($res['valid'], "Failed for: {$input}");
            $this->assertSame($expected, $res['normalized']);
        }
    }

    public function test_accepts_valid_leap_year_date(): void
    {
        $res = $this->service->validateDateString('29 Februari 2024');
        $this->assertTrue($res['valid']);
        $this->assertSame('2024-02-29', $res['normalized']);

        $resShort = $this->service->validateDateString('29 Feb 2024');
        $this->assertTrue($resShort['valid']);
        $this->assertSame('2024-02-29', $resShort['normalized']);
    }

    public function test_accepts_other_standard_months(): void
    {
        $cases = [
            '15 Maret 2021'     => '2021-03-15',
            '30 April 2022'     => '2022-04-30',
            '01 Mei 2020'       => '2020-05-01',
            '17 Juni 2019'      => '2019-06-17',
            '08 Juli 2023'      => '2023-07-08',
            '19 September 2022' => '2022-09-19',
            '10 Oktober 2021'   => '2021-10-10',
            '25 Desember 2023'  => '2023-12-25',
            '01 Pebruari 2020'  => '2020-02-01', // pebruari alias
        ];

        foreach ($cases as $input => $expected) {
            $res = $this->service->validateDateString($input);
            $this->assertTrue($res['valid'], "Failed for: {$input}");
            $this->assertSame($expected, $res['normalized']);
        }
    }

    public function test_accepts_null_or_empty_as_valid_empty(): void
    {
        $this->assertTrue($this->service->validateDateString(null)['valid']);
        $this->assertTrue($this->service->validateDateString('')['valid']);
        $this->assertTrue($this->service->validateDateString('   ')['valid']);
    }


}
