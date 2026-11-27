<?php

namespace Tests\Unit\Services;

use App\Services\NormalizationService;
use App\Services\StrictDateValidationService;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use Tests\TestCase;

class ExcelDateParserP1Test extends TestCase
{
    private NormalizationService $normalization;
    private StrictDateValidationService $validator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->normalization = new NormalizationService();
        $this->validator = new StrictDateValidationService($this->normalization);
    }

    public function test_accepts_english_three_letter_abbreviations_from_sheetjs(): void
    {
        $cases = [
            '03 Aug 1992' => ['normalized' => '1992-08-03', 'standardized' => '03 Agu 1992'],
            '15 Oct 1990' => ['normalized' => '1990-10-15', 'standardized' => '15 Okt 1990'],
            '02 Dec 2018' => ['normalized' => '2018-12-02', 'standardized' => '02 Des 2018'],
            '03 AUG 1992' => ['normalized' => '1992-08-03', 'standardized' => '03 Agu 1992'],
            '15 oct 1990' => ['normalized' => '1990-10-15', 'standardized' => '15 Okt 1990'],
            '02 DEC 2018' => ['normalized' => '2018-12-02', 'standardized' => '02 Des 2018'],
        ];

        foreach ($cases as $input => $expected) {
            $res = $this->validator->validateDateString($input);
            $this->assertTrue($res['valid'], "Expected '{$input}' to be valid, got reason: " . ($res['reason'] ?? 'none'));
            $this->assertSame($expected['normalized'], $res['normalized'], "Normalized mismatch for '{$input}'");
            $this->assertSame($expected['standardized'], $res['standardized'], "Standardized mismatch for '{$input}'");
        }
    }

    public function test_accepts_indonesian_agst_variation(): void
    {
        foreach (['03 Agst 1992', '03 agst 1992', '03 AGST 1992', '03-Agst-1992'] as $input) {
            $res = $this->validator->validateDateString($input);
            $this->assertTrue($res['valid'], "Expected '{$input}' to be valid, got reason: " . ($res['reason'] ?? 'none'));
            $this->assertSame('1992-08-03', $res['normalized'], "Normalized mismatch for '{$input}'");
        }
    }

    public function test_accepts_hyphen_separated_indonesian_and_english_month_dates(): void
    {
        $cases = [
            '11-Mei-2022'      => '2022-05-11',
            '11-Agu-2022'      => '2022-08-11',
            '11-Okt-2022'      => '2022-10-11',
            '11-Des-2022'      => '2022-12-11',
            '11-Ags-2022'      => '2022-08-11',
            '11-Agst-2022'     => '2022-08-11',
            '11-Aug-2022'      => '2022-08-11',
            '11-Oct-2022'      => '2022-10-11',
            '11-Dec-2022'      => '2022-12-11',
            '03-Agustus-1992'  => '1992-08-03',
            '20-Februari-1984' => '1984-02-20',
            '11-Nopember-2022' => '2022-11-11',
            '29-Pebruari-2024' => '2024-02-29',
        ];

        foreach ($cases as $input => $expectedIso) {
            $res = $this->validator->validateDateString($input);
            $this->assertTrue($res['valid'], "Expected '{$input}' to be valid, got reason: " . ($res['reason'] ?? 'none'));
            $this->assertSame($expectedIso, $res['normalized'], "Normalized mismatch for '{$input}'");
            $this->assertSame($expectedIso, $this->normalization->parseIndonesianDate($input));
        }
    }

    public function test_excel_date_cell_and_text_cell_produce_identical_normalized_date(): void
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        $testDates = [
            ['iso' => '1992-08-03', 'texts' => ['03 Agustus 1992', '03 Agu 1992', '03 Ags 1992', '03 Agst 1992', '03 Aug 1992', '03-Agu-1992', '03-Agst-1992']],
            ['iso' => '1990-10-15', 'texts' => ['15 Oktober 1990', '15 Okt 1990', '15 Oct 1990', '15-Okt-1990']],
            ['iso' => '2018-12-02', 'texts' => ['02 Desember 2018', '02 Des 2018', '02 Dec 2018', '02-Des-2018']],
            ['iso' => '2022-05-11', 'texts' => ['11 Mei 2022', '11 May 2022', '11-Mei-2022']],
        ];

        $row = 1;
        foreach ($testDates as $group) {
            $serial = ExcelDate::PHPToExcel(new \DateTime($group['iso'], new \DateTimeZone('UTC')));

            // Excel Date Cells across common formats
            foreach (['dd mmm yyyy', 'dd mmmm yyyy', '[$-421]dd mmmm yyyy', '[$-id-ID]dd mmm yyyy'] as $fmt) {
                $cell = $sheet->getCell("A{$row}");
                $cell->setValueExplicit($serial, DataType::TYPE_NUMERIC);
                $cell->getStyle()->getNumberFormat()->setFormatCode($fmt);

                $res = $this->validator->validateCell($cell);
                $this->assertTrue($res['valid'], "Date cell {$group['iso']} ({$fmt}) failed: " . ($res['reason'] ?? ''));
                $this->assertSame($group['iso'], $res['normalized']);
                $row++;
            }

            // Excel Text Cells
            foreach ($group['texts'] as $textVal) {
                $cell = $sheet->getCell("A{$row}");
                $cell->setValueExplicit($textVal, DataType::TYPE_STRING);

                $res = $this->validator->validateCell($cell);
                $this->assertTrue($res['valid'], "Text cell '{$textVal}' failed: " . ($res['reason'] ?? ''));
                $this->assertSame($group['iso'], $res['normalized']);
                $row++;
            }
        }
    }

    public function test_date_parsing_has_no_timezone_shift_across_timezones(): void
    {
        $originalTz = date_default_timezone_get();
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $serial = ExcelDate::PHPToExcel(new \DateTime('1992-08-03', new \DateTimeZone('UTC')));
        $cell = $sheet->getCell('A1');
        $cell->setValueExplicit($serial, DataType::TYPE_NUMERIC);
        $cell->getStyle()->getNumberFormat()->setFormatCode('dd mmm yyyy');

        try {
            foreach (['UTC', 'Asia/Jakarta', 'America/New_York', 'Pacific/Kiritimati', 'Pacific/Honolulu'] as $tz) {
                date_default_timezone_set($tz);

                $this->assertSame('1992-08-03', $this->validator->validateCell($cell)['normalized'], "Excel Date Cell shifted in TZ {$tz}");
                $this->assertSame('1992-08-03', $this->validator->validateDateString('03 Aug 1992')['normalized'], "03 Aug 1992 shifted in TZ {$tz}");
                $this->assertSame('1992-08-03', $this->validator->validateDateString('03 Agst 1992')['normalized'], "03 Agst 1992 shifted in TZ {$tz}");
                $this->assertSame('2022-05-11', $this->validator->validateDateString('11-Mei-2022')['normalized'], "11-Mei-2022 shifted in TZ {$tz}");
                $this->assertSame('2018-12-02', $this->validator->validateDateString('02-Dec-2018')['normalized'], "02-Dec-2018 shifted in TZ {$tz}");
            }
        } finally {
            date_default_timezone_set($originalTz);
        }
    }

    public function test_single_source_of_truth_month_map_shared_without_duplication(): void
    {
        $this->assertArrayHasKey('aug', NormalizationService::BULAN_MAP);
        $this->assertArrayHasKey('oct', NormalizationService::BULAN_MAP);
        $this->assertArrayHasKey('dec', NormalizationService::BULAN_MAP);
        $this->assertArrayHasKey('agst', NormalizationService::BULAN_MAP);

        $reflection = new \ReflectionClass(StrictDateValidationService::class);
        $this->assertFalse(
            $reflection->hasConstant('MONTH_MAP'),
            'StrictDateValidationService should reuse NormalizationService::BULAN_MAP instead of duplicating MONTH_MAP'
        );
    }

    public function test_still_strictly_rejects_ambiguous_numeric_and_invalid_calendar_dates(): void
    {
        $rejected = [
            '11/12/2022',
            '11-12-2022',
            '11.12.2022',
            '2022-12-11',
            '12/11/22',
            '11122022',
            '44876',
            '11 Nov 22',
            '11-Aug-22',
            '11-Mei-22',
            '31 Februari 2023',
            '29-Feb-2023',
            '31-Apr-2023',
            '31-Okt-2023' => false, // wait: Oct has 31 days — keep only truly invalid below!
        ];
        unset($rejected['31-Okt-2023']);
        $rejected[] = '32-Okt-2023';
        $rejected[] = '31-Nov-2023';

        foreach ($rejected as $badDate) {
            $res = $this->validator->validateDateString($badDate);
            $this->assertFalse($res['valid'], "Ambiguous/invalid date '{$badDate}' MUST still be rejected");
        }
    }
}
