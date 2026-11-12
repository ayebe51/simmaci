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

    // ─────────────────────────────────────────────────────────────────────────
    // NEGATIVE CASES
    // ─────────────────────────────────────────────────────────────────────────

    public function test_rejects_numeric_slash_format(): void
    {
        $res = $this->service->validateDateString('11/12/2022');
        $this->assertFalse($res['valid']);
        $this->assertNotNull($res['reason']);
        $this->assertStringContainsString('garis miring', $res['reason']);
    }

    public function test_rejects_numeric_dash_format(): void
    {
        $res = $this->service->validateDateString('11-12-2022');
        $this->assertFalse($res['valid']);
        $this->assertNotNull($res['reason']);
        $this->assertStringContainsString('tanda hubung', $res['reason']);
    }

    public function test_rejects_numeric_dot_format(): void
    {
        $res = $this->service->validateDateString('11.12.2022');
        $this->assertFalse($res['valid']);
        $this->assertNotNull($res['reason']);
        $this->assertStringContainsString('titik', $res['reason']);
    }

    public function test_rejects_iso_numeric_format(): void
    {
        $res = $this->service->validateDateString('2022-12-11');
        $this->assertFalse($res['valid']);
        $this->assertNotNull($res['reason']);
    }

    public function test_rejects_two_digit_year(): void
    {
        $res = $this->service->validateDateString('12/11/22');
        $this->assertFalse($res['valid']);

        $resWithMonth = $this->service->validateDateString('11 Nov 22');
        $this->assertFalse($resWithMonth['valid']);
        $this->assertStringContainsString('4 digit', $resWithMonth['reason']);
    }

    public function test_rejects_pure_numeric_digits(): void
    {
        $res = $this->service->validateDateString('11122022');
        $this->assertFalse($res['valid']);
    }

    public function test_rejects_raw_excel_serial_number_string(): void
    {
        $res = $this->service->validateDateString('44876');
        $this->assertFalse($res['valid']);
        $this->assertStringContainsString('tanpa nama bulan', $res['reason']);
    }

    public function test_rejects_unknown_month_name(): void
    {
        $res = $this->service->validateDateString('11 Foobar 2022');
        $this->assertFalse($res['valid']);
        $this->assertStringContainsString('tidak dikenali', $res['reason']);
    }

    public function test_rejects_calendar_invalid_31_februari(): void
    {
        $res = $this->service->validateDateString('31 Februari 2023');
        $this->assertFalse($res['valid']);
        $this->assertStringContainsString('Februari maksimal 29 hari', $res['reason']);
    }

    public function test_rejects_calendar_invalid_non_leap_february_29(): void
    {
        $res = $this->service->validateDateString('29 Februari 2023');
        $this->assertFalse($res['valid']);
        $this->assertStringContainsString('bukan tahun kabisat', $res['reason']);
    }

    public function test_rejects_calendar_invalid_31_april(): void
    {
        $res = $this->service->validateDateString('31 April 2023');
        $this->assertFalse($res['valid']);
        $this->assertStringContainsString('hanya memiliki 30 hari', $res['reason']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXCEL CELL & PHPSPREADSHEET HANDLING
    // ─────────────────────────────────────────────────────────────────────────

    public function test_cell_numeric_serial_with_written_month_format_is_accepted(): void
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $cell = $sheet->getCell('A1');

        // Excel date serial for 2022-11-11 is 44876
        $cell->setValue(44876);
        $cell->getStyle()->getNumberFormat()->setFormatCode('dd mmm yyyy');

        $res = $this->service->validateCell($cell);
        $this->assertTrue($res['valid']);
        $this->assertSame('2022-11-11', $res['normalized']);
    }

    public function test_cell_numeric_serial_with_full_month_format_is_accepted(): void
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $cell = $sheet->getCell('A1');

        $cell->setValue(44876);
        $cell->getStyle()->getNumberFormat()->setFormatCode('[$-421]dd mmmm yyyy');

        $res = $this->service->validateCell($cell);
        $this->assertTrue($res['valid']);
        $this->assertSame('2022-11-11', $res['normalized']);
    }

    public function test_cell_numeric_serial_with_slash_format_is_rejected(): void
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $cell = $sheet->getCell('A1');

        $cell->setValue(44876);
        $cell->getStyle()->getNumberFormat()->setFormatCode('dd/mm/yyyy');

        $res = $this->service->validateCell($cell);
        $this->assertFalse($res['valid']);
        $this->assertStringContainsString('tanpa format tampilan nama bulan', $res['reason']);
    }

    public function test_cell_numeric_serial_with_general_format_is_rejected(): void
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $cell = $sheet->getCell('A1');

        $cell->setValue(44876);
        $cell->getStyle()->getNumberFormat()->setFormatCode('General');

        $res = $this->service->validateCell($cell);
        $this->assertFalse($res['valid']);
        $this->assertStringContainsString('tanpa format tampilan nama bulan', $res['reason']);
    }

    public function test_cell_with_string_value_is_validated_strictly(): void
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        // Valid string cell
        $validCell = $sheet->getCell('A1');
        $validCell->setValue('11 Nov 2022');
        $validRes = $this->service->validateCell($validCell);
        $this->assertTrue($validRes['valid']);
        $this->assertSame('2022-11-11', $validRes['normalized']);

        // Invalid string cell
        $invalidCell = $sheet->getCell('B1');
        $invalidCell->setValue('11/12/2022');
        $invalidRes = $this->service->validateCell($invalidCell);
        $this->assertFalse($invalidRes['valid']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DATASET & ROW VALIDATION
    // ─────────────────────────────────────────────────────────────────────────

    public function test_validate_rows_collects_all_errors_and_formats_message(): void
    {
        $rows = [
            // Row index 0 (Excel row 2) -> valid
            [
                'nama'          => 'Ahmad Fauzi',
                'tanggal_lahir' => '11 Nov 2022',
                'tmt'           => '01 Januari 2020',
            ],
            // Row index 1 (Excel row 3) -> invalid tanggal_lahir
            [
                'nama'          => 'Budi Santoso',
                'tanggal_lahir' => '11/12/2022',
                'tmt'           => '05 Januari 2021',
            ],
            // Row index 2 (Excel row 4) -> invalid tmt
            [
                'nama'          => 'Citra Dewi',
                'tanggal_lahir' => '21 Agustus 2024',
                'tmt'           => '2023-05-12',
            ],
            // Row index 3 (Excel row 5) -> invalid TTL
            [
                'nama'          => 'Dewi Sartika',
                'tempat_tanggal_lahir' => 'Cilacap, 11-12-2022',
            ],
        ];

        $errors = $this->service->validateRows($rows);

        $this->assertCount(3, $errors);

        // Check row numbers match Excel rows (start at 2)
        $this->assertEquals(3, $errors[0]['row']);
        $this->assertEquals('Tanggal Lahir', $errors[0]['column']);
        $this->assertEquals('11/12/2022', $errors[0]['value']);

        $this->assertEquals(4, $errors[1]['row']);
        $this->assertEquals('Tanggal Mulai Tugas (TMT)', $errors[1]['column']);
        $this->assertEquals('2023-05-12', $errors[1]['value']);

        $this->assertEquals(5, $errors[2]['row']);
        $this->assertEquals('Tempat, Tanggal Lahir', $errors[2]['column']);

        // Check formatted message
        $formattedMsg = $this->service->formatErrorMessage($errors);
        $this->assertStringContainsString('Format tanggal tidak sesuai!', $formattedMsg);
        $this->assertStringContainsString('| 3 | Tanggal Lahir | 11/12/2022 |', $formattedMsg);
        $this->assertStringContainsString('| 4 | Tanggal Mulai Tugas (TMT) | 2023-05-12 |', $formattedMsg);
        $this->assertStringContainsString('| 5 | Tempat, Tanggal Lahir |', $formattedMsg);
    }
}
