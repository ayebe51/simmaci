<?php

namespace App\Services;

use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;

class StrictDateValidationService
{
    /**
     * Peta standardisasi alias ejaan bulan tidak baku & singkatan Inggris ke ejaan baku Indonesia.
     * Pemetaan nama bulan -> nomor bulan menggunakan single source of truth NormalizationService::BULAN_MAP.
     */
    private const MONTH_ALIASES = [
        'nopember' => 'November',
        'nop'      => 'Nov',
        'pebruari' => 'Februari',
        'peb'      => 'Feb',
        'ags'      => 'Agu',
        'agst'     => 'Agu',
        'aug'      => 'Agu',
        'oct'      => 'Okt',
        'dec'      => 'Des',
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

        // Cek pengenalan nama bulan (single source of truth dari NormalizationService::BULAN_MAP)
        if (!isset(NormalizationService::BULAN_MAP[$monthKey])) {
            return [
                'valid'        => false,
                'normalized'   => null,
                'standardized' => null,
                'reason'       => "Nama bulan '{$monthRaw}' tidak dikenali. Gunakan nama bulan Indonesia atau singkatannya yang baku (contoh: Januari, Februari, Nov, Agu).",
            ];
        }

        $monthNum = NormalizationService::BULAN_MAP[$monthKey];

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
                // Konversi numeric serial ke DateTime objek secara deterministik di UTC agar bebas pergeseran timezone
                try {
                    $dateTime = ExcelDate::excelToDateTimeObject((float) $val, new \DateTimeZone('UTC'));
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
     * Validasi ketat untuk format tanggal internal ISO YYYY-MM-DD hasil normalisasi preview.
     * Hanya menerima pola tepat YYYY-MM-DD yang valid secara kalender tanpa konversi timezone.
     *
     * @return array{valid: bool, normalized: ?string, reason: ?string, is_empty?: bool}
     */
    public function validateIsoDate(?string $value): array
    {
        if ($value === null || trim($value) === '') {
            return [
                'valid'      => true,
                'is_empty'   => true,
                'normalized' => null,
                'reason'     => null,
            ];
        }

        $trimmed = trim(str_replace("\xC2\xA0", ' ', $value));

        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $trimmed, $m)) {
            return [
                'valid'      => false,
                'normalized' => null,
                'reason'     => "Format tanggal internal tidak valid ('{$value}'). Wajib menggunakan format ISO YYYY-MM-DD yang sah.",
            ];
        }

        $year  = (int) $m[1];
        $month = (int) $m[2];
        $day   = (int) $m[3];

        if (!checkdate($month, $day, $year)) {
            return [
                'valid'      => false,
                'normalized' => null,
                'reason'     => "Tanggal internal tidak valid secara kalender ('{$value}').",
            ];
        }

        return [
            'valid'      => true,
            'normalized' => $trimmed,
            'reason'     => null,
        ];
    }

    /**
     * Ekstrak seluruh field bertema tanggal pada satu baris payload secara deterministik (terurut berdasarkan key).
     *
     * @return array<string, string>
     */
    public function extractDateFieldsFromRow(array $row, array $dateColumnLabels = []): array
    {
        if (empty($dateColumnLabels)) {
            $dateColumnLabels = [
                'tanggal_lahir'            => 'Tanggal Lahir',
                'tgl_lahir'                => 'Tanggal Lahir',
                'tempat_tanggal_lahir'     => 'Tempat, Tanggal Lahir',
                'ttl'                      => 'Tempat, Tanggal Lahir',
                'tempat_tgl_lahir'         => 'Tempat, Tanggal Lahir',
                'tmt'                      => 'Tanggal Mulai Tugas (TMT)',
                'mulai_tugas'              => 'Tanggal Mulai Tugas (TMT)',
                'tanggal_tugas'            => 'Tanggal Mulai Tugas (TMT)',
                'penugasan'                => 'Tanggal Penugasan',
                'tanggal_penetapan'        => 'Tanggal Penetapan SK',
                'tanggal_sk'               => 'Tanggal SK',
                'tanggal_surat_permohonan' => 'Tanggal Surat Permohonan',
            ];
        }

        $extracted = [];
        foreach ($row as $rawKey => $rawVal) {
            if ($rawVal === null || $rawVal === '') {
                continue;
            }

            $cleanKey = preg_replace('/[^a-z0-9]/', '_', trim(strtolower((string) $rawKey)));
            $cleanKey = trim(preg_replace('/_+/', '_', $cleanKey), '_');

            $isDateKey = str_contains($cleanKey, 'tempat_tanggal_lahir')
                || $cleanKey === 'ttl'
                || str_contains($cleanKey, 'tempat_tgl_lahir')
                || str_contains($cleanKey, 'tgl')
                || str_contains($cleanKey, 'tanggal')
                || $cleanKey === 'tmt'
                || str_contains($cleanKey, '_tmt')
                || str_contains($cleanKey, 'tmt_');

            if (!$isDateKey) {
                foreach ($dateColumnLabels as $targetKey => $label) {
                    if ($cleanKey === $targetKey || str_contains($cleanKey, $targetKey)) {
                        $isDateKey = true;
                        break;
                    }
                }
            }

            if ($isDateKey) {
                $extracted[$cleanKey] = trim((string) $rawVal);
            }
        }

        ksort($extracted);
        return $extracted;
    }

    /**
     * Ekstrak identitas baris yang stabil untuk pengikatan signature (F-04).
     * Mencegah cross-row signature transplant antar guru berbeda pada user/madrasah yang sama.
     *
     * @return array{nama: string, nomor_induk_maarif: string, nuptk: string, nip: string}
     */
    public function extractRowIdentity(array $row): array
    {
        return [
            'nama'               => mb_strtolower(trim((string) ($row['nama'] ?? '')), 'UTF-8'),
            'nomor_induk_maarif' => trim((string) ($row['nomor_induk_maarif'] ?? '')),
            'nuptk'              => trim((string) ($row['nuptk'] ?? '')),
            'nip'                => trim((string) ($row['nip'] ?? '')),
        ];
    }

    /**
     * Ambil secret key untuk HMAC-SHA256 secara fail-closed (F-03):
     * - Prioritaskan dedicated key (IMPORT_DATE_SIGNING_KEY) lalu APP_KEY.
     * - Tanpa hardcoded fallback dan menolak secret kosong/null.
     */
    private function resolveSigningSecret(): string
    {
        $dedicated = config('app.import_date_signing_key');
        $candidate = (is_string($dedicated) && trim($dedicated) !== '')
            ? trim($dedicated)
            : config('app.key');

        if (!is_string($candidate) || trim($candidate) === '') {
            throw new \RuntimeException('Kunci penandatanganan preview tanggal belum terkonfigurasi.');
        }

        return trim($candidate);
    }

    /**
     * Buat tanda tangan HMAC-SHA256 ber-masa-berlaku dan terikat identitas baris (F-03 & F-04).
     * Format: "v2.<exp_unix_timestamp>.<hmac_sha256_hex>"
     */
    public function signNormalizedDates(
        array $row,
        ?int $userId = null,
        ?int $schoolId = null,
        ?int $ttlSeconds = null
    ): string {
        $secret = $this->resolveSigningSecret();
        $ttl    = max(60, $ttlSeconds ?? (int) config('app.import_preview_signature_ttl', 3600));
        $exp    = \Carbon\Carbon::now()->timestamp + $ttl;

        $canonical = json_encode([
            'v'         => 'v2',
            'exp'       => $exp,
            'user_id'   => $userId,
            'school_id' => $schoolId,
            'identity'  => $this->extractRowIdentity($row),
            'dates'     => $this->extractDateFieldsFromRow($row),
        ], JSON_UNESCAPED_UNICODE);

        $hmac = hash_hmac('sha256', $canonical ?: '', $secret);

        return "v2.{$exp}.{$hmac}";
    }

    /**
     * Verifikasi apakah nilai tanggal & identitas baris masih utuh, belum kedaluwarsa,
     * dan ditandatangani oleh backend dengan secret yang valid (fail-closed) (F-03 & F-04).
     */
    public function verifyNormalizedDates(array $row, ?string $signature, ?int $userId = null, ?int $schoolId = null): bool
    {
        if ($signature === null || trim($signature) === '') {
            return false;
        }

        // Format wajib: v2.<exp_unix>.<64-char hex hmac>
        if (!preg_match('/^v2\.(\d+)\.([a-f0-9]{64})$/', trim($signature), $m)) {
            return false;
        }

        $exp          = (int) $m[1];
        $providedHmac = $m[2];

        // Verifikasi kedaluwarsa di backend (tidak mempercayai waktu/claim frontend)
        if ($exp < \Carbon\Carbon::now()->timestamp) {
            return false;
        }

        try {
            $secret = $this->resolveSigningSecret();
        } catch (\RuntimeException) {
            // Fail-closed jika secret tidak valid / tidak terkonfigurasi
            return false;
        }

        $canonical = json_encode([
            'v'         => 'v2',
            'exp'       => $exp,
            'user_id'   => $userId,
            'school_id' => $schoolId,
            'identity'  => $this->extractRowIdentity($row),
            'dates'     => $this->extractDateFieldsFromRow($row),
        ], JSON_UNESCAPED_UNICODE);

        $expectedHmac = hash_hmac('sha256', $canonical ?: '', $secret);

        return hash_equals($expectedHmac, $providedHmac);
    }

    /**
     * Validasi ulang seluruh baris pada tahap commit import guru:
     * - Baris dengan tanda tangan preview yang sah & tidak dimanipulasi: divalidasi ulang dengan validateIsoDate() (kalender & format ISO ketat).
     * - Baris tanpa tanda tangan atau yang tanggalnya dimanipulasi pasca-preview: divalidasi ulang secara ketat oleh validateRows()
     *   (menolak format numerik ambigu maupun ISO tanpa provenance preview) dan menormalisasi tanggal teks bulan yang sah ke YYYY-MM-DD.
     *
     * @param array<int, array<string, mixed>> $rows
     * @return array{
     *     errors: array<int, array{sheet: string, row: int, column: string, value: string, reason: string}>,
     *     normalized_by_index: array<int, array<string, string>>
     * }
     */
    public function validateCommitRows(
        array $rows,
        ?int $userId = null,
        ?int $schoolId = null,
        string $sheetName = 'Sheet1',
        int $startRowIndex = 2
    ): array {
        $errors = [];
        $normalizedByIndex = [];

        $defaultLabels = [
            'tanggal_lahir'            => 'Tanggal Lahir',
            'tgl_lahir'                => 'Tanggal Lahir',
            'tmt'                      => 'Tanggal Mulai Tugas (TMT)',
            'mulai_tugas'              => 'Tanggal Mulai Tugas (TMT)',
            'tanggal_tugas'            => 'Tanggal Mulai Tugas (TMT)',
            'penugasan'                => 'Tanggal Penugasan',
            'tanggal_penetapan'        => 'Tanggal Penetapan SK',
            'tanggal_sk'               => 'Tanggal SK',
            'tanggal_surat_permohonan' => 'Tanggal Surat Permohonan',
        ];

        foreach ($rows as $idx => $row) {
            $excelRowNum = $startRowIndex + $idx;
            $payload = is_array($row['payload'] ?? null) ? $row['payload'] : $row;
            $signature = (isset($row['preview_date_signature']) && is_string($row['preview_date_signature']))
                ? $row['preview_date_signature']
                : null;

            $isVerifiedPreview = $signature !== null
                && $this->verifyNormalizedDates($payload, $signature, $userId, $schoolId);

            if ($isVerifiedPreview) {
                $dateFields = $this->extractDateFieldsFromRow($payload);
                foreach ($dateFields as $cleanKey => $val) {
                    $isoRes = $this->validateIsoDate($val);
                    if (!$isoRes['valid']) {
                        $errors[] = [
                            'sheet'  => $sheetName,
                            'row'    => $excelRowNum,
                            'column' => $defaultLabels[$cleanKey] ?? ucwords(str_replace('_', ' ', $cleanKey)),
                            'value'  => $val,
                            'reason' => $isoRes['reason'],
                        ];
                    } elseif ($isoRes['normalized'] !== null) {
                        $normalizedByIndex[$idx][$cleanKey] = $isoRes['normalized'];
                    }
                }
            } else {
                // Tanpa tanda tangan preview atau telah dimanipulasi pasca-preview:
                // wajib melewati validasi ketat penuh (menolak YYYY-MM-DD / 11/12/2022 / serial / kalender invalid).
                $rowErrors = $this->validateRows([$payload], [], $sheetName, $excelRowNum);
                if (!empty($rowErrors)) {
                    array_push($errors, ...$rowErrors);
                } else {
                    // Jika data yang diedit valid berformat nama bulan (misal "21 Agst 1995"),
                    // normalisasi ulang ke ISO YYYY-MM-DD sebelum disimpan ke database (F-06: termasuk tanggal_surat_permohonan).
                    foreach ($this->extractDateFieldsFromRow($payload) as $cleanKey => $val) {
                        $targetField = match ($cleanKey) {
                            'tanggal_lahir', 'tgl_lahir'                       => 'tanggal_lahir',
                            'tmt', 'mulai_tugas', 'tanggal_tugas'              => 'tmt',
                            'tanggal_surat_permohonan', 'tgl_surat_permohonan' => 'tanggal_surat_permohonan',
                            default                                            => null,
                        };
                        if ($targetField !== null) {
                            $parsed = $this->parseAndNormalize($val);
                            if ($parsed !== null) {
                                $normalizedByIndex[$idx][$targetField] = $parsed;
                            }
                        }
                    }
                }
            }
        }

        return [
            'errors'              => $errors,
            'normalized_by_index' => $normalizedByIndex,
        ];
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

    /**
     * Validasi kumpulan baris data import sebelum proses penyimpanan.
     * Menemukan dan mengumpulkan SELURUH kesalahan tanggal di semua baris dan kolom.
     *
     * @param array<int, array<string, mixed>> $rows
     * @param array<string, string> $dateColumnLabels Peta field/kolom => Label manusiawi
     * @param string $sheetName
     * @param int $startRowIndex Nomor baris Excel fisik (default: 2, baris 1 adalah header)
     * @return array<int, array{
     *     sheet: string,
     *     row: int,
     *     column: string,
     *     value: string,
     *     reason: string
     * }>
     */
    public function validateRows(
        array $rows,
        array $dateColumnLabels = [],
        string $sheetName = 'Sheet1',
        int $startRowIndex = 2,
        array $excludedKeys = []
    ): array {
        if (empty($dateColumnLabels)) {
            $dateColumnLabels = [
                'tanggal_lahir'            => 'Tanggal Lahir',
                'tgl_lahir'                => 'Tanggal Lahir',
                'tempat_tanggal_lahir'     => 'Tempat, Tanggal Lahir',
                'ttl'                      => 'Tempat, Tanggal Lahir',
                'tempat_tgl_lahir'         => 'Tempat, Tanggal Lahir',
                'tmt'                      => 'Tanggal Mulai Tugas (TMT)',
                'mulai_tugas'              => 'Tanggal Mulai Tugas (TMT)',
                'tanggal_tugas'            => 'Tanggal Mulai Tugas (TMT)',
                'penugasan'                => 'Tanggal Penugasan',
                'tanggal_penetapan'        => 'Tanggal Penetapan SK',
                'tanggal_sk'               => 'Tanggal SK',
                'tanggal_surat_permohonan' => 'Tanggal Surat Permohonan',
            ];
        }

        $normalizedExcluded = array_map(function (string $key): string {
            $clean = preg_replace('/[^a-z0-9]/', '_', trim(strtolower($key)));
            return trim(preg_replace('/_+/', '_', $clean), '_');
        }, $excludedKeys);

        $errors = [];

        foreach ($rows as $idx => $row) {
            $excelRowNum = $startRowIndex + $idx;

            // Cari kolom tanggal dalam baris (pencocokan case-insensitive / normalized key)
            foreach ($row as $rawKey => $rawVal) {
                if ($rawVal === null || $rawVal === '') {
                    continue;
                }

                $cleanKey = preg_replace('/[^a-z0-9]/', '_', trim(strtolower($rawKey)));
                $cleanKey = trim(preg_replace('/_+/', '_', $cleanKey), '_');

                if (!empty($normalizedExcluded) && in_array($cleanKey, $normalizedExcluded, true)) {
                    continue;
                }

                // 1. Tangani kolom kombinasi Tempat Tanggal Lahir (TTL)
                $isTtl = str_contains($cleanKey, 'tempat_tanggal_lahir')
                    || $cleanKey === 'ttl'
                    || str_contains($cleanKey, 'tempat_tgl_lahir');

                if ($isTtl) {
                    $ttlStr = (string) $rawVal;
                    $parts  = explode(',', $ttlStr);
                    if (count($parts) >= 2) {
                        $datePart = trim($parts[1]);
                        $res      = $this->validateDateString($datePart);
                        if (!$res['valid']) {
                            $errors[] = [
                                'sheet'  => $sheetName,
                                'row'    => $excelRowNum,
                                'column' => $dateColumnLabels[$cleanKey] ?? ($rawKey ?: 'Tempat, Tanggal Lahir'),
                                'value'  => $ttlStr,
                                'reason' => $res['reason'],
                            ];
                        }
                    }
                    continue;
                }

                // 2. Tangani kolom tanggal independen
                $isDateCol = false;
                $colLabel  = $rawKey;

                foreach ($dateColumnLabels as $targetKey => $label) {
                    if ($cleanKey === $targetKey || str_contains($cleanKey, $targetKey)) {
                        $isDateCol = true;
                        $colLabel  = $label;
                        break;
                    }
                }

                // Deteksi tambahan jika mengandung kata kunci tanggal/tgl/tmt/lahir/penugasan
                if (!$isDateCol && (
                    str_contains($cleanKey, 'tgl') ||
                    str_contains($cleanKey, 'tanggal') ||
                    $cleanKey === 'tmt' ||
                    str_contains($cleanKey, '_tmt') ||
                    str_contains($cleanKey, 'tmt_')
                )) {
                    $isDateCol = true;
                    $colLabel  = ucwords(str_replace('_', ' ', $cleanKey));
                }

                if ($isDateCol) {
                    $valStr = is_string($rawVal) ? $rawVal : (is_numeric($rawVal) ? (string) $rawVal : null);
                    if ($valStr !== null) {
                        $res = $this->validateDateString($valStr);
                        if (!$res['valid']) {
                            $errors[] = [
                                'sheet'  => $sheetName,
                                'row'    => $excelRowNum,
                                'column' => $colLabel,
                                'value'  => (string) $rawVal,
                                'reason' => $res['reason'],
                            ];
                        }
                    }
                }
            }
        }

        return $errors;
    }

    /**
     * Validasi spreadsheet PhpSpreadsheet secara langsung sebelum diproses.
     *
     * @param array<string, string> $headerToDateLabelMap Peta nama header => Label
     * @return array<int, array{sheet: string, row: int, column: string, value: string, reason: string}>
     */
    public function validateSpreadsheet(
        Spreadsheet $spreadsheet,
        array $headerToDateLabelMap = []
    ): array {
        $errors = [];

        foreach ($spreadsheet->getAllSheets() as $sheet) {
            $sheetName   = $sheet->getTitle();
            $highestRow  = $sheet->getHighestRow();
            $highestCol  = $sheet->getHighestColumn();
            $highestColI = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($highestCol);

            if ($highestRow < 2) {
                continue;
            }

            // Baca header di baris 1
            $dateColumns = []; // colIndex => label
            for ($col = 1; $col <= $highestColI; $col++) {
                $headerCell = $sheet->getCell([$col, 1]);
                $headerText = trim((string) $headerCell->getValue());
                if ($headerText === '') continue;

                $cleanHeader = preg_replace('/[^a-z0-9]/', '_', trim(strtolower($headerText)));
                $cleanHeader = trim(preg_replace('/_+/', '_', $cleanHeader), '_');

                // Cocokkan apakah ini kolom tanggal
                foreach ($headerToDateLabelMap as $key => $label) {
                    if ($cleanHeader === $key || str_contains($cleanHeader, $key)) {
                        $dateColumns[$col] = $label;
                        break;
                    }
                }

                if (!isset($dateColumns[$col]) && (
                    str_contains($cleanHeader, 'tgl') ||
                    str_contains($cleanHeader, 'tanggal') ||
                    $cleanHeader === 'tmt' ||
                    str_contains($cleanHeader, 'lahir')
                )) {
                    $dateColumns[$col] = $headerText;
                }
            }

            if (empty($dateColumns)) {
                continue;
            }

            // Validasi setiap baris
            for ($row = 2; $row <= $highestRow; $row++) {
                // Lewati baris yang seluruh kolom tanggalnya kosong
                foreach ($dateColumns as $col => $colLabel) {
                    $cell = $sheet->getCell([$col, $row]);
                    if ($cell->getValue() === null || trim((string) $cell->getValue()) === '') {
                        continue;
                    }

                    $res = $this->validateCell($cell);
                    if (!$res['valid']) {
                        $errors[] = [
                            'sheet'  => $sheetName,
                            'row'    => $row,
                            'column' => $colLabel,
                            'value'  => (string) $cell->getValue(),
                            'reason' => $res['reason'],
                        ];
                    }
                }
            }
        }

        return $errors;
    }

    /**
     * Bangun pesan kesalahan format tanggal yang terstruktur dan mudah dipahami.
     * Sesuai ketentuan spesifikasi Section 5.
     *
     * @param array<int, array{sheet: string, row: int, column: string, value: string, reason: string}> $errors
     */
    public function formatErrorMessage(array $errors): string
    {
        $count = count($errors);

        $msg = "Format tanggal tidak sesuai!\n\n";
        $msg .= "SIMMACI hanya menerima tanggal yang mencantumkan nama bulan.\n\n";
        $msg .= "Contoh format yang diterima:\n";
        $msg .= "- 11 Nov 2022\n";
        $msg .= "- 11 November 2022\n";
        $msg .= "- 11 Nopember 2022\n";
        $msg .= "- 05 Januari 2023\n";
        $msg .= "- 21 Agu 2024\n";
        $msg .= "- 21 Agustus 2024\n\n";
        $msg .= "Contoh format yang ditolak:\n";
        $msg .= "- 11/12/2022\n";
        $msg .= "- 11-12-2022\n";
        $msg .= "- 11.12.2022\n";
        $msg .= "- 2022-12-11\n";
        $msg .= "- 12/11/22\n";
        $msg .= "- 11122022\n\n";
        $msg .= "Ditemukan {$count} kesalahan format tanggal:\n\n";
        $msg .= "| Baris | Kolom | Nilai | Alasan Penolakan |\n";
        $msg .= "|---|---|---|---|\n";

        foreach ($errors as $err) {
            $row    = $err['row'] ?? '-';
            $col    = $err['column'] ?? '-';
            $val    = $err['value'] ?? '-';
            $reason = $err['reason'] ?? 'Format tidak valid';
            $msg .= "| {$row} | {$col} | {$val} | {$reason} |\n";
        }

        $msg .= "\nSilakan perbaiki format tanggal pada file Excel dan unggah kembali.";

        return $msg;
    }
}
