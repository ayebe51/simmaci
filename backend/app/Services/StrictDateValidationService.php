<?php

namespace App\Services;

use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;

class StrictDateValidationService
{
    /**
     * Map nama bulan (huruf kecil) ke nomor bulan 1-12.
     * Mendukung bahasa Indonesia baku, variasi alias umum, dan singkatan.
     */
    private const MONTH_MAP = [
        // Nama bulan Indonesia baku (lengkap)
        'januari'   => 1,
        'februari'  => 2,
        'maret'     => 3,
        'april'     => 4,
        'mei'       => 5,
        'juni'      => 6,
        'juli'      => 7,
        'agustus'   => 8,
        'september' => 9,
        'oktober'   => 10,
        'november'  => 11,
        'desember'  => 12,

        // Alias ejaan umum / non-baku Indonesia
        'nopember'  => 11,
        'pebruari'  => 2,

        // Singkatan resmi / umum 3 huruf
        'jan'       => 1,
        'feb'       => 2,
        'mar'       => 3,
        'apr'       => 4,
        'jun'       => 6,
        'jul'       => 7,
        'agu'       => 8,
        'ags'       => 8,
        'sep'       => 9,
        'okt'       => 10,
        'nov'       => 11,
        'nop'       => 11,
        'des'       => 12,
        'peb'       => 2,

        // Bahasa Inggris (berjaga-jaga dari ekspor software tertentu)
        'january'   => 1,
        'february'  => 2,
        'march'     => 3,
        'may'       => 5,
        'june'      => 6,
        'july'      => 7,
        'august'    => 8,
        'october'   => 10,
        'december'  => 12,
    ];

    /**
     * Peta standardisasi alias ejaan bulan tidak baku ke ejaan baku.
     */
    private const MONTH_ALIASES = [
        'nopember' => 'November',
        'nop'      => 'Nov',
        'pebruari' => 'Februari',
        'peb'      => 'Feb',
        'ags'      => 'Agu',
        'january'  => 'Januari',
        'february' => 'Februari',
        'march'    => 'Maret',
        'may'      => 'Mei',
        'june'     => 'Juni',
        'july'     => 'Juli',
        'august'   => 'Agustus',
        'october'  => 'Oktober',
        'december' => 'Desember',
    ];

    /**
     * Nama bulan Indonesia baku per nomor bulan.
     */
    private const INDONESIAN_MONTH_NAMES = [
        1  => 'Januari',
        2  => 'Februari',
        3  => 'Maret',
        4  => 'April',
        5  => 'Mei',
        6  => 'Juni',
        7  => 'Juli',
        8  => 'Agustus',
        9  => 'September',
        10 => 'Oktober',
        11 => 'November',
        12 => 'Desember',
    ];

    public function __construct(
        protected NormalizationService $normalizationService
    ) {}

    /**
     * Validasi format tanggal teks secara ketat.
     *
     * Aturan:
     * - Wajib mencantumkan nama bulan (singkatan atau nama lengkap).
     * - Format numerik (11/12/2022, 11-12-2022, 11.12.2022, 2022-12-11, 12/11/22, 11122022) wajib ditolak.
     * - Tanggal, bulan, dan tahun harus valid secara kalender (misal: 31 Februari ditolak).
     * - Tahun harus terdiri dari 4 digit.
     * - Tidak membedakan huruf kapital dan nonkapital.
     * - Ejaan "Nopember" dikenali dan distandardisasi menjadi "November".
     *
     * @return array{
     *     valid: bool,
     *     normalized: ?string,
     *     standardized: ?string,
     *     reason: ?string,
     *     is_empty?: bool
     * }
     */
    public function validateDateString(?string $value): array
    {
        if ($value === null || trim($value) === '') {
            return [
                'valid'        => true,
                'is_empty'     => true,
                'normalized'   => null,
                'standardized' => null,
                'reason'       => null,
            ];
        }

        // Bersihkan non-breaking spaces dan whitespace ganda
        $trimmed = trim(str_replace("\xC2\xA0", ' ', $value));

        // ── 1. Penolakan Format Numerik Ambigu / Terlarang ──────────────────

        // Angka murni (misal: "11122022", "44876", dll)
        if (ctype_digit($trimmed) || (is_numeric($trimmed) && !str_contains($trimmed, ' '))) {
            return [
                'valid'        => false,
                'normalized'   => null,
                'standardized' => null,
                'reason'       => "Format tanggal numerik atau angka serial Excel tanpa nama bulan tidak diterima ('{$value}'). Wajib mencantumkan nama bulan (contoh: 11 Nov 2022 atau 11 November 2022).",
            ];
        }

        // Numerik dengan slash: DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD, DD/MM/YY
        if (preg_match('/^\d{1,4}\/\d{1,2}\/\d{1,4}$/', $trimmed)) {
            return [
                'valid'        => false,
                'normalized'   => null,
                'standardized' => null,
                'reason'       => "Format tanggal numerik dengan garis miring ('{$value}') tidak diterima karena berisiko pertukaran interpretasi antara tanggal dan bulan. Wajib mencantumkan nama bulan (contoh: 11 Nov 2022 atau 11 November 2022).",
            ];
        }

        // Numerik dengan dash: DD-MM-YYYY, YYYY-MM-DD (ISO), MM-DD-YYYY, DD-MM-YY
        if (preg_match('/^\d{1,4}-\d{1,2}-\d{1,4}$/', $trimmed)) {
            return [
                'valid'        => false,
                'normalized'   => null,
                'standardized' => null,
                'reason'       => "Format tanggal numerik dengan tanda hubung ('{$value}') tidak diterima. Wajib mencantumkan nama bulan (contoh: 11 Nov 2022 atau 11 November 2022).",
            ];
        }

        // Numerik dengan titik: DD.MM.YYYY, YYYY.MM.DD
        if (preg_match('/^\d{1,4}\.\d{1,2}\.\d{1,4}$/', $trimmed)) {
            return [
                'valid'        => false,
                'normalized'   => null,
                'standardized' => null,
                'reason'       => "Format tanggal numerik dengan titik ('{$value}') tidak diterima. Wajib mencantumkan nama bulan (contoh: 11 Nov 2022 atau 11 November 2022).",
            ];
        }

        // ── 2. Pemeriksaan Struktur: Hari, Nama Bulan, Tahun 4 Digit ─────────

        // Normalisasi spasi dan tanda hubung pemisah antar komponen
        // Format yang diterima: "11 Nov 2022", "11 November 2022", "11-Nov-2022", "05 Januari 2023"
        $collapsed = preg_replace('/\s+/', ' ', $trimmed);

        // Cek jika tahun hanya 2 digit dengan nama bulan (misal: "11 Nov 22")
        if (preg_match('/^(\d{1,2})[\s\-]+([a-zA-Z]+)[\s\-]+(\d{2})$/u', $collapsed)) {
            return [
                'valid'        => false,
                'normalized'   => null,
                'standardized' => null,
                'reason'       => "Tahun harus terdiri dari 4 digit ('{$value}'). Contoh yang benar: 11 Nov 2022.",
            ];
        }

        if (!preg_match('/^(\d{1,2})[\s\-]+([a-zA-Z]+)[\s\-]+(\d+)$/u', $collapsed, $matches)) {
            return [
                'valid'        => false,
                'normalized'   => null,
                'standardized' => null,
                'reason'       => "Format tanggal tidak sesuai ('{$value}'). Tanggal wajib mencantumkan hari, nama bulan, dan 4 digit tahun (contoh: 11 Nov 2022 atau 11 November 2022).",
            ];
        }

        $dayStr    = $matches[1];
        $monthRaw  = $matches[2];
        $yearStr   = $matches[3];

        $day       = (int) $dayStr;
        $monthKey  = strtolower($monthRaw);
        $year      = (int) $yearStr;

        // Pastikan tahun tepat 4 digit
        if (strlen($yearStr) !== 4) {
            return [
                'valid'        => false,
                'normalized'   => null,
                'standardized' => null,
                'reason'       => "Tahun harus terdiri dari 4 digit ('{$value}'). Ditemukan: {$yearStr}.",
            ];
        }

        // Cek pengenalan nama bulan
        if (!isset(self::MONTH_MAP[$monthKey])) {
            return [
                'valid'        => false,
                'normalized'   => null,
                'standardized' => null,
                'reason'       => "Nama bulan '{$monthRaw}' tidak dikenali. Gunakan nama bulan Indonesia atau singkatannya yang baku (contoh: Januari, Februari, Nov, Agu).",
            ];
        }

        $monthNum = self::MONTH_MAP[$monthKey];

        // ── 3. Pemeriksaan Validitas Kalender (checkdate) ────────────────────

        if (!checkdate($monthNum, $day, $year)) {
            $monthCanonical = self::INDONESIAN_MONTH_NAMES[$monthNum] ?? $monthRaw;

            if ($monthNum === 2) {
                $isLeap = ($year % 4 === 0 && ($year % 100 !== 0 || $year % 400 === 0));
                if ($day > 29) {
                    $reason = "Tanggal tidak valid secara kalender: bulan Februari maksimal 29 hari ('{$value}').";
                } elseif ($day === 29 && !$isLeap) {
                    $reason = "Tanggal tidak valid secara kalender: tahun {$year} bukan tahun kabisat (29 Februari {$year} tidak ada).";
                } else {
                    $reason = "Tanggal tidak valid secara kalender: {$day} {$monthCanonical} {$year} tidak ada dalam kalender.";
                }
            } elseif (in_array($monthNum, [4, 6, 9, 11], true) && $day > 30) {
                $reason = "Tanggal tidak valid secara kalender: bulan {$monthCanonical} hanya memiliki 30 hari ('{$value}').";
            } elseif ($day < 1 || $day > 31) {
                $reason = "Tanggal tidak valid secara kalender: hari harus antara 1 dan 31 (ditemukan: {$day}).";
            } else {
                $reason = "Tanggal tidak valid secara kalender: {$day} {$monthCanonical} {$year} tidak ada dalam kalender.";
            }

            return [
                'valid'        => false,
                'normalized'   => null,
                'standardized' => null,
                'reason'       => $reason,
            ];
        }

        // ── 4. Standardisasi Alias Bulan ─────────────────────────────────────
        // Contoh: "11 Nopember 2022" → "11 November 2022"
        $standardized = $this->standardizeMonthAlias($collapsed);

        // ── 5. Normalisasi Menggunakan Existing Normalization Service ─────────
        // Menghasilkan format baku SIMMACI "YYYY-MM-DD"
        $normalized = $this->normalizationService->parseIndonesianDate($standardized);

        if (!$normalized) {
            return [
                'valid'        => false,
                'normalized'   => null,
                'standardized' => $standardized,
                'reason'       => "Gagal menormalisasi tanggal '{$value}' menggunakan mekanisme baku sistem.",
            ];
        }

        return [
            'valid'        => true,
            'normalized'   => $normalized,
            'standardized' => $standardized,
            'reason'       => null,
        ];
    }

    /**
     * Standardisasi alias ejaan nama bulan tidak baku menjadi baku.
     * Contoh: "11 Nopember 2022" → "11 November 2022", "21 Ags 2024" → "21 Agu 2024"
     */
    public function standardizeMonthAlias(string $dateStr): string
    {
        $result = $dateStr;
        foreach (self::MONTH_ALIASES as $alias => $standard) {
            $pattern = '/\b' . preg_quote($alias, '/') . '\b/iu';
            $result  = preg_replace($pattern, $standard, $result);
        }
        return $result;
    }

    /**
     * Validasi PhpSpreadsheet Cell.
     *
     * Menangani kondisi:
     * - Cell kosong / null
     * - Cell string
     * - Numeric serial dengan number format `dd mmm yyyy` atau `dd mmmm yyyy` (DITERIMA)
     * - Numeric serial dengan number format `dd/mm/yyyy`, `mm-dd-yyyy`, atau numerik lain (DITOLAK)
     * - Cell numeric tanpa format tanggal (General, 0) (DITOLAK)
     *
     * @return array{
     *     valid: bool,
     *     normalized: ?string,
     *     standardized: ?string,
     *     reason: ?string,
     *     is_empty?: bool
     * }
     */
    public function validateCell(Cell $cell): array
    {
        $val = $cell->getValue();

        if ($val === null || trim((string) $val) === '') {
            return [
                'valid'        => true,
                'is_empty'     => true,
                'normalized'   => null,
                'standardized' => null,
                'reason'       => null,
            ];
        }

        $dataType   = $cell->getDataType();
        $isNumeric  = ($dataType === DataType::TYPE_NUMERIC) || is_numeric($val);
        $formatCode = (string) $cell->getStyle()->getNumberFormat()->getFormatCode();

        if ($isNumeric) {
            // Evaluasi format tampilan Excel
            // Excel number format rules:
            // "mmm" = 3-letter month abbreviation (e.g. "Nov")
            // "mmmm" = full month name (e.g. "November")
            // Token "m" atau "mm" bisa berarti bulan angka atau menit. Menit TIDAK PERNAH menggunakan "mmm".
            $hasMonthNameFormat = (bool) preg_match('/mmm/i', $formatCode);

            // Periksa juga apakah tahun diformat 4 digit
            $hasFourDigitYear = (bool) preg_match('/yyyy|0000/i', $formatCode);
            $hasTwoDigitYear  = (bool) (preg_match('/yy/i', $formatCode) && !$hasFourDigitYear);

            if ($hasTwoDigitYear) {
                return [
                    'valid'        => false,
                    'normalized'   => null,
                    'standardized' => null,
                    'reason'       => "Format tampilan Excel menggunakan tahun 2 digit (format: '{$formatCode}'). Tahun wajib 4 digit (contoh: dd mmm yyyy).",
                ];
            }

            if ($hasMonthNameFormat) {
                // Konversi numeric serial ke DateTime objek
                try {
                    $dateTime = ExcelDate::excelToDateTimeObject((float) $val);
                    $day      = (int) $dateTime->format('j');
                    $monthNum = (int) $dateTime->format('n');
                    $year     = (int) $dateTime->format('Y');

                    $monthName = self::INDONESIAN_MONTH_NAMES[$monthNum] ?? $dateTime->format('F');
                    $dateText  = "{$day} {$monthName} {$year}";

                    return $this->validateDateString($dateText);
                } catch (\Throwable $e) {
                    return [
                        'valid'        => false,
                        'normalized'   => null,
                        'standardized' => null,
                        'reason'       => "Gagal membaca serial tanggal Excel ('{$val}'): {$e->getMessage()}",
                    ];
                }
            }

            // Numeric serial tanpa format tampilan nama bulan (misal: dd/mm/yyyy, mm-dd-yyyy, General, dll)
            return [
                'valid'        => false,
                'normalized'   => null,
                'standardized' => null,
                'reason'       => "Format Excel berupa angka serial tanpa format tampilan nama bulan (format: '{$formatCode}') tidak diterima. Tampilkan tanggal menggunakan format nama bulan (contoh: dd mmm yyyy atau dd mmmm yyyy).",
            ];
        }

        // Tipe string biasa
        return $this->validateDateString((string) $val);
    }

    /**
     * Parse dan normalisasi nilai tanggal jika valid.
     * Mengembalikan format "YYYY-MM-DD" jika valid, atau null jika kosong/tidak valid.
     * Jika tidak valid, variabel $error akan diisi alasan penolakan.
     */
    public function parseAndNormalize(mixed $value, ?string &$error = null): ?string
    {
        $error = null;

        if ($value instanceof Cell) {
            $res = $this->validateCell($value);
        } else {
            $res = $this->validateDateString(is_string($value) ? $value : (is_null($value) ? null : (string) $value));
        }

        if (!$res['valid']) {
            $error = $res['reason'];
            return null;
        }

        return $res['normalized'];
    }


}
