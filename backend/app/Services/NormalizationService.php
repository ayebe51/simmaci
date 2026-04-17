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
        'SPD'       => 'S.Pd.',
        'SSOSI'     => 'S.Sos.I',
        'SSOS'      => 'S.Sos.',
        'SFILI'     => 'S.Fil.I',
        'SFIL'      => 'S.Fil.',
        'STHI'      => 'S.Th.I',
        'STH'       => 'S.Th.',
        'SAG'       => 'S.Ag.',
        'SH'        => 'S.H.',
        'SEI'       => 'S.E.I',
        'SE'        => 'S.E.',
        'SSI'       => 'S.Si.',
        'SKOM'      => 'S.Kom.',
        'SIP'       => 'S.IP.',
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

        // ── Diploma ───────────────────────────────────────────────────────
        'AMAPUST'   => 'A.Ma.Pust.',
        'AMAPD'     => 'A.Ma.Pd.',
        'AMA'       => 'A.Ma.',
        'AMDKEB'    => 'Amd.Keb.',
        'AMDKEP'    => 'Amd.Kep.',
        'AMDFAR'    => 'Amd.Far.',
        'AMDGZ'     => 'Amd.Gz.',
        'AMDAK'     => 'Amd.Ak.',
        'AMDRAD'    => 'Amd.Rad.',
        'AMDFIS'    => 'Amd.Fis.',
        'AMDPK'     => 'Amd.PK.',
        'AMDK'      => 'Amd.K.',
        'AMD'       => 'Amd.',
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
     * @return array{name: string, prefix_degrees: string[], suffix_degrees: string[]}
     */
    protected function parseAcademicDegrees(string $fullName): array
    {
        $map = $this->getDegreeMap();

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

        return [
            'name'           => $name,
            'prefix_degrees' => $prefixDegrees,
            'suffix_degrees' => $suffixDegrees,
        ];
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
}
