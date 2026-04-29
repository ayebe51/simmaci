<?php

namespace App\Services;

class NormalizationService
{
    /**
     * Common Indonesian education abbreviations that should remain uppercase
     */
    private const SCHOOL_ABBREVIATIONS = ['MI', 'MTs', 'MA', 'NU', 'SD', 'SMP', 'SMA', 'SMK'];

    /**
     * Degrees that appear BEFORE the name (prefixes).
     * Key = normalised lookup key (no dots/spaces, uppercase).
     */
    private const PREFIX_DEGREES = ['PROF', 'DR', 'DRA'];

    /**
     * Canonical degree lookup table.
     * Key   = degree stripped of ALL dots and spaces, uppercased.
     * Value = canonical formatted form.
     *
     * Ordering matters for multi-segment degrees: longer keys must come first
     * so that e.g. "SPDI" is matched before "SPD".
     * The array is sorted by key-length descending in getDegreeMap().
     */
    private const DEGREE_MAP = [
        // ── Doctoral / Professor ──────────────────────────────────────────
        'PROF'      => 'Prof.',
        'DR'        => 'Dr.',
        'DRA'       => 'Dra.',

        // ── Sarjana (S1) ──────────────────────────────────────────────────
        'SPDI'      => 'S.Pd.I',
        'SPDSD'     => 'S.Pd.SD.',
        'SPD'       => 'S.Pd.',
        'SSOSI'     => 'S.Sos.I',
        'SSOS'      => 'S.Sos.',
        'SFILI'     => 'S.Fil.I',
        'SFIL'      => 'S.Fil.',
        'STHI'      => 'S.Th.I',
        'STH'       => 'S.Th.',
        'SSY'       => 'S.Sy.',
        'SAG'       => 'S.Ag.',
        'SH'        => 'S.H.',
        'SEI'       => 'S.E.I',
        'SE'        => 'S.E.',
        'SSI'       => 'S.Si.',
        'SKOM'      => 'S.Kom.',
        'SIP'       => 'S.IP.',
        'SIPUST'    => 'S.I.Pust.',
        'SPSI'      => 'S.Psi.',
        'ST'        => 'S.T.',
        'SHUM'      => 'S.Hum.',
        'SKED'      => 'S.Ked.',
        'SKM'       => 'S.K.M.',
        'SKEP'      => 'S.Kep.',
        'SKEPI'     => 'S.Kep.I',
        'SFAR'      => 'S.Far.',
        'SGIZI'     => 'S.Gz.',
        'SGZ'       => 'S.Gz.',
        'SAKI'      => 'S.Ak.I',
        'SAK'       => 'S.Ak.',
        'SPTR'      => 'S.Pt.',
        'SPT'       => 'S.Pt.',
        'STER'      => 'S.Ter.',
        'SANTER'    => 'S.An.',
        'SAN'       => 'S.An.',
        'SM'        => 'S.M.',

        // ── Diploma ───────────────────────────────────────────────────────
        'AMAPUST'   => 'A.Ma.Pust.',
        'AMAPD'     => 'A.Ma.Pd.',
        'AMAPDSD'   => 'A.Ma.Pd.SD.',
        'AMA'       => 'A.Ma.',
        'AMDKOM'    => 'A.Md.Kom.',
        'AMDTI'     => 'A.Md.T.I.',
        'AMDKEB'    => 'Amd.Keb.',
        'AMDKEP'    => 'Amd.Kep.',
        'AMDFAR'    => 'Amd.Far.',
        'AMDGZ'     => 'Amd.Gz.',
        'AMDAK'     => 'Amd.Ak.',
        'AMDRAD'    => 'Amd.Rad.',
        'AMDFIS'    => 'Amd.Fis.',
        'AMDPK'     => 'Amd.PK.',
        'AMDK'      => 'Amd.K.',
        'AMD'       => 'A.Md.',
        'DIII'      => 'D.III',
        'DII'       => 'D.II',
        'DIV'       => 'D.IV',
        'DI'        => 'D.I',

        // ── Magister (S2) ─────────────────────────────────────────────────
        'MPDI'      => 'M.Pd.I',
        'MPD'       => 'M.Pd.',
        'MSOSI'     => 'M.Sos.I',
        'MSOS'      => 'M.Sos.',
        'MFILI'     => 'M.Fil.I',
        'MFIL'      => 'M.Fil.',
        'MTHI'      => 'M.Th.I',
        'MTH'       => 'M.Th.',
        'MAG'       => 'M.Ag.',
        'MH'        => 'M.H.',
        'MEI'       => 'M.E.I',
        'ME'        => 'M.E.',
        'MSI'       => 'M.Si.',
        'MKOM'      => 'M.Kom.',
        'MIP'       => 'M.IP.',
        'MPSI'      => 'M.Psi.',
        'MT'        => 'M.T.',
        'MHUM'      => 'M.Hum.',
        'MM'        => 'M.M.',
        'MBA'       => 'M.B.A.',
        'MKM'       => 'M.K.M.',
        'MKES'      => 'M.Kes.',
        'MKED'      => 'M.Ked.',
        'MAK'       => 'M.Ak.',
        'MKN'       => 'M.Kn.',
        'MSN'       => 'M.Sn.',
        'MDS'       => 'M.Ds.',
        'MPAR'      => 'M.Par.',

        // ── Doktor (S3) ───────────────────────────────────────────────────
        'PHD'       => 'Ph.D.',

        // ── Profesi / Spesialis ───────────────────────────────────────────
        'NS'        => 'Ns.',
        'LC'        => 'Lc.',
        'SH1'       => 'S.H.',   // alias
        'SPOG'      => 'Sp.OG.',
        'SPA'       => 'Sp.A.',
        'SPKJ'      => 'Sp.KJ.',
        'SPRAD'     => 'Sp.Rad.',
        'SPBEDAH'   => 'Sp.B.',
        'SPB'       => 'Sp.B.',
        'SPJP'      => 'Sp.JP.',
        'SPPD'      => 'Sp.PD.',
        'SPKK'      => 'Sp.KK.',
        'SPMK'      => 'Sp.MK.',
    ];

    /**
     * Normalize school name to Title Case format
     * Preserves common abbreviations in uppercase (MI, MTs, MA, NU)
     */
    public function normalizeSchoolName(?string $schoolName): ?string
    {
        if ($schoolName === null || trim($schoolName) === '') {
            return $schoolName;
        }

        $schoolName = trim($schoolName);
        $lower = mb_strtolower($schoolName, 'UTF-8');

        $words = explode(' ', $lower);
        $words = array_map(function (string $word): string {
            if ($word === '') return $word;
            $parts = explode('-', $word);
            $parts = array_map(function (string $part): string {
                if ($part === '') return $part;
                $prefix = '';
                $rest   = $part;
                while ($rest !== '') {
                    $ch = mb_substr($rest, 0, 1, 'UTF-8');
                    if (mb_strpos('([{', $ch) !== false) {
                        $prefix .= $ch;
                        $rest    = mb_substr($rest, 1, null, 'UTF-8');
                    } else {
                        break;
                    }
                }
                if ($rest === '') return $prefix;
                return $prefix
                    . mb_strtoupper(mb_substr($rest, 0, 1, 'UTF-8'), 'UTF-8')
                    . mb_substr($rest, 1, null, 'UTF-8');
            }, $parts);
            return implode('-', $parts);
        }, $words);

        $normalized = implode(' ', $words);

        $padded = ' ' . $normalized . ' ';
        foreach (self::SCHOOL_ABBREVIATIONS as $abbr) {
            $padded = str_ireplace(' ' . $abbr . ' ', ' ' . $abbr . ' ', $padded);
            $padded = str_ireplace(' ' . $abbr . '. ', ' ' . $abbr . '. ', $padded);
        }

        return trim($padded);
    }

    /**
     * Normalize place of birth to Title Case format
     */
    public function normalizePlaceOfBirth(?string $placeOfBirth): ?string
    {
        if ($placeOfBirth === null || trim($placeOfBirth) === '') {
            return $placeOfBirth;
        }

        return mb_convert_case(trim($placeOfBirth), MB_CASE_TITLE, 'UTF-8');
    }

    /**
     * Normalize teacher name to UPPERCASE with properly formatted academic degrees.
     *
     * Prefix degrees (Dr., Dra., Prof.) appear BEFORE the name.
     * Suffix degrees (S.Pd., M.Ag., etc.) appear AFTER the name, separated by ", ".
     *
     * Examples:
     *   "dr. ahmad fauzi s.pd"  → "Dr. AHMAD FAUZI, S.Pd."
     *   "dra. siti fatimah"     → "Dra. SITI FATIMAH"
     *   "ahmad s.pd.i m.ag"     → "AHMAD, S.Pd.I, M.Ag."
     */
    public function normalizeTeacherName(?string $teacherName): ?string
    {
        if ($teacherName === null || trim($teacherName) === '') {
            return $teacherName;
        }

        $teacherName = trim($teacherName);
        $parsed      = $this->parseAcademicDegrees($teacherName);

        $normalizedName = mb_strtoupper($parsed['name'], 'UTF-8');

        $prefixes = $parsed['prefix_degrees'];
        $suffixes = $parsed['suffix_degrees'];

        $result = $normalizedName;

        if (!empty($suffixes)) {
            $result .= ', ' . implode(', ', $suffixes);
        }

        if (!empty($prefixes)) {
            $result = implode(' ', $prefixes) . ' ' . $result;
        }

        return $result;
    }

    /**
     * Parse academic degrees from a full name string using the DEGREE_MAP lookup.
     *
     * Prefix degrees (Dr., Dra., Prof.) are separated from suffix degrees.
     * A prefix degree is only treated as prefix when it appears BEFORE any name token.
     * Once a name token is encountered, all subsequent degrees become suffixes.
     *
     * Post-processing rule: if a prefix-type degree (Dr., Dra., Prof.) ended up as a
     * suffix (because it appeared after the name, with or without a comma), AND there
     * are no other non-prefix suffix degrees alongside it, move it to the prefix
     * position. This handles the common Indonesian data-entry pattern of writing
     * "MUMBASITOH, Dra." which should normalise to "Dra. MUMBASITOH".
     *
     * @return array{name: string, prefix_degrees: string[], suffix_degrees: string[]}
     */
    protected function parseAcademicDegrees(string $fullName): array
    {
        $map = $this->getDegreeMap();

        // Pre-process: split degrees that are attached to the name without separator.
        // e.g. "MAFTUHSAG" → "MAFTUH SAG", "AHMADSPDI" → "AHMAD SPDI"
        $fullName = $this->splitAttachedDegrees($fullName);

        // Pre-process: merge split compound degrees that span two tokens.
        // e.g. "S.Pd. SD" / "S.Pd SD" / "SPD SD" → "S.Pd.SD"
        // This handles the common data-entry pattern where S.Pd.SD. is written
        // as two separate tokens "S.Pd." and "SD".
        $fullName = $this->mergeCompoundDegrees($fullName);

        // Normalise separators: replace commas with spaces, collapse whitespace
        $flat   = preg_replace('/,+/', ' ', $fullName);
        $flat   = preg_replace('/\s+/', ' ', $flat);
        $tokens = array_filter(explode(' ', trim($flat)), fn($t) => $t !== '');
        $tokens = array_values($tokens);

        $nameTokens     = [];
        $prefixDegrees  = [];
        $suffixDegrees  = [];
        $nameStarted    = false;
        $i              = 0;
        $n              = count($tokens);

        while ($i < $n) {
            // Try to greedily match the longest run of tokens as a single degree.
            $matched = false;
            for ($window = min(4, $n - $i); $window >= 1; $window--) {
                $slice = array_slice($tokens, $i, $window);
                $key   = $this->degreeKey(implode('', $slice));
                if (isset($map[$key])) {
                    $canonical = $map[$key];
                    $isPrefix  = in_array($key, self::PREFIX_DEGREES, true);

                    if ($isPrefix && !$nameStarted) {
                        $prefixDegrees[] = $canonical;
                    } else {
                        $suffixDegrees[] = $canonical;
                    }

                    $i += $window;
                    $matched = true;
                    break;
                }
            }

            if (!$matched) {
                $token = $tokens[$i];
                if (!empty($suffixDegrees) && str_contains($token, '.')) {
                    // Unknown degree-like token after known suffix degrees — preserve as-is
                    $suffixDegrees[] = $token;
                } else {
                    $nameTokens[]  = $token;
                    $nameStarted   = true;
                }
                $i++;
            }
        }

        // Clean up name: remove stray dots/commas, collapse spaces
        $name = implode(' ', $nameTokens);
        $name = preg_replace('/[.,]+/', '', $name);
        $name = preg_replace('/\s+/', ' ', $name);
        $name = trim($name);

        // Post-process: if a prefix-type degree (Dr., Dra., Prof.) ended up in suffixes
        // because it appeared after the name (e.g. "MUMBASITOH, Dra." or "fatimah dr."),
        // move it to the prefix position — but only when there are no other suffix degrees
        // alongside it (e.g. "FATIMAH, Dra., M.Pd." keeps Dra. as suffix).
        if (empty($prefixDegrees)) {
            $nonPrefixSuffixes = array_filter($suffixDegrees, function ($deg) {
                return !in_array($this->degreeKey($deg), self::PREFIX_DEGREES, true);
            });

            if (empty($nonPrefixSuffixes)) {
                // All suffixes are prefix-type degrees — move them to prefix position
                $movedPrefixes = [];
                foreach ($suffixDegrees as $deg) {
                    if (in_array($this->degreeKey($deg), self::PREFIX_DEGREES, true)) {
                        $movedPrefixes[] = $deg;
                    }
                }
                $prefixDegrees = $movedPrefixes;
                $suffixDegrees = [];
            }
        }

        return [
            'name'           => $name,
            'prefix_degrees' => $prefixDegrees,
            'suffix_degrees' => $suffixDegrees,
        ];
    }

    /**
     * Split degrees that are attached directly to the last name token without
     * any separator (space, comma, or dot).
     *
     * Common patterns from messy Excel data:
     *   "MAFTUHSAG"   → "MAFTUH SAG"    (S.Ag attached)
     *   "AHMADSPDI"   → "AHMAD SPDI"    (S.Pd.I attached)
     *   "FATIMAHMPD"  → "FATIMAH MPD"   (M.Pd attached)
     *   "HASANSPD"    → "HASAN SPD"     (S.Pd attached)
     *
     * Only degree keys with ≥ 3 characters are used to avoid false positives
     * on short keys (SH, ST, SE, MM, MT) that could match common name endings.
     * Token must be pure alpha (no dots/commas) and total length ≥ 6.
     * Name part must be ≥ 3 characters after splitting.
     */
    protected function splitAttachedDegrees(string $name): string
    {
        // Minimum key length for split detection.
        // Short keys like DR, DRA, SH, ST, SE are excluded because they appear
        // too frequently as substrings inside real Indonesian names
        // (e.g. LEANDRA, CANDRA, INDRA, SANDRA → false positives with DRA/DR).
        $minKeyLen = 4;

        // Keys explicitly excluded from split detection due to high false-positive rate
        // as name substrings. These are still handled correctly when they appear as
        // separate tokens (e.g. "AHMAD DR" or "SITI, Dra.").
        $excludeFromSplit = ['DR', 'DRA', 'SH', 'ST', 'SE', 'SM', 'MM', 'MT', 'ME', 'MH'];

        $map    = $this->getDegreeMap(); // sorted longest-first
        $tokens = preg_split('/\s+/', trim($name));
        $result = [];

        foreach ($tokens as $token) {
            // Only process tokens that are pure alpha (no dots/commas = not already formatted)
            $stripped = preg_replace('/[^a-zA-Z]/', '', $token);
            if ($stripped !== $token) {
                // Token contains dots/commas — already formatted degree, leave as-is
                $result[] = $token;
                continue;
            }

            $upper = mb_strtoupper($stripped, 'UTF-8');

            // Minimum total: name part (≥4) + degree key (≥4) = 8
            if (strlen($upper) < 8) {
                $result[] = $token;
                continue;
            }

            $split = false;
            foreach ($map as $key => $canonical) {
                $keyLen = strlen($key);

                if ($keyLen < $minKeyLen) continue;
                if (in_array($key, $excludeFromSplit, true)) continue;

                $nameLen = strlen($upper) - $keyLen;

                if ($nameLen < 4) continue; // name part too short

                if (substr($upper, -$keyLen) === $key) {
                    $result[] = substr($upper, 0, $nameLen);
                    $result[] = $key;
                    $split    = true;
                    break;
                }
            }

            if (!$split) {
                $result[] = $token;
            }
        }

        return implode(' ', $result);
    }

    /**
     * Pre-process a raw name string to merge compound degrees that are commonly
     * written as two separate tokens due to data-entry inconsistency.
     *
     * Currently handles:
     *   S.Pd. SD  / S.Pd SD  / SPD SD  → S.Pd.SD
     *   SD, S.Pd. / SD S.Pd.           → S.Pd.SD  (reversed order)
     *   A.Ma. Pd  / A.Ma Pd  / AMA PD  → A.Ma.Pd
     *   A.Ma. Pust / A.Ma Pust          → A.Ma.Pust
     *
     * The merge is case-insensitive and handles optional trailing dots/commas.
     */
    protected function mergeCompoundDegrees(string $name): string
    {
        // S.Pd. SD → S.Pd.SD  (Sarjana Pendidikan Sekolah Dasar)
        $name = preg_replace('/\bS\.?\s*Pd\.?\s+SD\.?\b/i', 'S.Pd.SD', $name);
        // SPD SD (no dots at all)
        $name = preg_replace('/\bSPD\s+SD\b/i', 'S.Pd.SD', $name);
        // SD[,] S.Pd. → S.Pd.SD  (reversed: "DWI SUPRIYATI SD, S.Pd.")
        $name = preg_replace('/\bSD[,.]?\s+S\.?\s*Pd\.?\b/i', 'S.Pd.SD', $name);

        // A.Ma. Pd → A.Ma.Pd  (Ahli Madya Pendidikan)
        $name = preg_replace('/\bA\.?\s*Ma\.?\s+Pd\.?\b/i', 'A.Ma.Pd', $name);

        // A.Ma.Pd. SD → A.Ma.Pd.SD  (Ahli Madya Pendidikan Sekolah Dasar)
        $name = preg_replace('/\bA\.?\s*Ma\.?\s*Pd\.?\s+SD\.?\b/i', 'A.Ma.Pd.SD', $name);

        // A.Ma. Pust → A.Ma.Pust  (Ahli Madya Pustakawan)
        $name = preg_replace('/\bA\.?\s*Ma\.?\s+Pust\.?\b/i', 'A.Ma.Pust', $name);

        return $name;
    }

    /**
     * Return DEGREE_MAP sorted by key length descending (longest first).
     * Cached as a static local to avoid re-sorting on every call.
     *
     * @return array<string, string>
     */
    protected function getDegreeMap(): array
    {
        static $sorted = null;
        if ($sorted === null) {
            $sorted = self::DEGREE_MAP;
            uksort($sorted, fn($a, $b) => strlen($b) - strlen($a));
        }
        return $sorted;
    }

    /**
     * Produce the lookup key for a raw degree string:
     * strip all dots, spaces, and commas → uppercase.
     */
    protected function degreeKey(string $raw): string
    {
        $clean = preg_replace('/[\s.,]+/', '', $raw);
        return mb_strtoupper($clean, 'UTF-8');
    }

    /**
     * Normalize teacher employment status to one of the four valid values:
     * GTY, GTT, Tendik, PNS.
     *
     * Rules:
     * - 'Aktif'               → GTY if TMT ≥ 2 years ago, otherwise GTT
     * - 'GTTY'                → GTT  (typo/variant)
     * - 'Guru Tetap Yayasan'  → GTY
     * - 'Guru Tidak Tetap'    → GTT
     * - 'Kepala Madrasah'     → GTY
     * - 'Tenaga Kependidikan' → Tendik
     * - Already valid values  → returned as-is
     * - Unknown values        → GTT (safe fallback)
     *
     * @param  string|null          $status  Raw status value
     * @param  \Carbon\Carbon|null  $tmt     TMT date (used only for 'Aktif' resolution)
     * @return string|null
     */
    public function normalizeEmploymentStatus(?string $status, ?\Carbon\Carbon $tmt = null): ?string
    {
        if ($status === null || trim($status) === '') {
            return $status;
        }

        $valid = ['GTY', 'GTT', 'Tendik', 'PNS'];
        $trimmed = trim($status);

        // Already a valid value — return as-is (case-sensitive match)
        if (in_array($trimmed, $valid, true)) {
            return $trimmed;
        }

        $upper = mb_strtoupper($trimmed, 'UTF-8');

        return match (true) {
            $upper === 'AKTIF'                                    => $this->resolveAktif($tmt),
            in_array($upper, ['GTTY', 'GURU TIDAK TETAP'], true) => 'GTT',
            in_array($upper, ['GURU TETAP YAYASAN', 'KEPALA MADRASAH'], true) => 'GTY',
            in_array($upper, ['TENAGA KEPENDIDIKAN', 'TENDIK'], true) => 'Tendik',
            $upper === 'PNS'                                      => 'PNS',
            default                                               => 'GTT', // safe fallback
        };
    }

    /**
     * Map nama bulan Indonesia (panjang & singkat) ke nomor bulan.
     */
    private const BULAN_MAP = [
        'januari' => 1,  'februari' => 2,  'maret' => 3,    'april' => 4,
        'mei'     => 5,  'juni'     => 6,  'juli'  => 7,    'agustus'   => 8,
        'september' => 9, 'oktober' => 10, 'november' => 11, 'desember' => 12,
        // Singkat
        'jan' => 1, 'feb' => 2, 'mar' => 3, 'apr' => 4,
        'jun' => 6, 'jul' => 7, 'agu' => 8, 'ags' => 8,
        'sep' => 9, 'okt' => 10, 'nov' => 11, 'des' => 12,
    ];

    /**
     * Konversi string tanggal dari berbagai format ke "YYYY-MM-DD".
     *
     * Format yang didukung:
     *   1. "YYYY-MM-DD"       → ISO, dikembalikan apa adanya
     *   2. "YYYY/MM/DD"       → ISO dengan slash
     *   3. "DD MMMM YYYY"     → Indonesia panjang  ("13 Desember 2020")
     *   4. "DD MMM YYYY"      → Indonesia singkat  ("13 Des 2020")
     *   5. "DD-MM-YYYY"       → numerik dengan dash
     *   6. "DD/MM/YYYY"       → numerik dengan slash
     *   7. "DD.MM.YYYY"       → numerik dengan titik
     *
     * Jika tidak bisa di-parse, kembalikan null.
     */
    public function parseIndonesianDate(?string $val): ?string
    {
        if ($val === null || trim($val) === '') {
            return null;
        }

        $trimmed = trim($val);

        // 1. Sudah ISO YYYY-MM-DD
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed)) {
            return $trimmed;
        }

        // 2. YYYY/MM/DD
        if (preg_match('/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/', $trimmed, $m)) {
            return sprintf('%04d-%02d-%02d', $m[1], $m[2], $m[3]);
        }

        // 3 & 4. DD MMMM YYYY atau DD MMM YYYY (nama bulan Indonesia)
        if (preg_match('/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/', $trimmed, $m)) {
            $monthNum = self::BULAN_MAP[strtolower($m[2])] ?? null;
            if ($monthNum) {
                return sprintf('%04d-%02d-%02d', $m[3], $monthNum, $m[1]);
            }
        }

        // 5. DD-MM-YYYY
        if (preg_match('/^(\d{1,2})-(\d{1,2})-(\d{4})$/', $trimmed, $m)) {
            return sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1]);
        }

        // 6. DD/MM/YYYY
        if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/', $trimmed, $m)) {
            return sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1]);
        }

        // 7. DD.MM.YYYY
        if (preg_match('/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/', $trimmed, $m)) {
            return sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1]);
        }

        // Fallback: coba Carbon::parse untuk format lain yang dikenali
        try {
            return \Carbon\Carbon::parse($trimmed)->format('Y-m-d');
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Resolve 'Aktif' status based on TMT date.
     * GTY if TMT is ≥ 2 years ago, GTT otherwise (including when TMT is null).
     */
    private function resolveAktif(?\Carbon\Carbon $tmt): string
    {
        if ($tmt === null) {
            return 'GTT';
        }

        return $tmt->diffInYears(\Carbon\Carbon::now()) >= 2 ? 'GTY' : 'GTT';
    }
}
