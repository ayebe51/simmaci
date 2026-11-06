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

        return [
            'valid'        => false,
            'is_empty'     => false,
            'normalized'   => null,
            'standardized' => null,
            'reason'       => 'Validasi tanggal belum lengkap.',
        ];
    }
}
