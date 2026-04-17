<?php

namespace App\Services;

class NormalizationService
{
    /**
     * Common Indonesian education abbreviations that should remain uppercase
     */
    private const SCHOOL_ABBREVIATIONS = ['MI', 'MTs', 'MA', 'NU', 'SD', 'SMP', 'SMA', 'SMK'];

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
        'AMD'       => 'Amd.',
        'AMDK'      => 'Amd.K.',
        'AMDKEB'    => 'Amd.Keb.',
        'AMDKEP'    => 'Amd.Kep.',
        'AMDFAR'    => 'Amd.Far.',
        'AMDGZ'     => 'Amd.Gz.',
        'AMDAK'     => 'Amd.Ak.',
        'AMDRAD'    => 'Amd.Rad.',
        'AMDFIS'    => 'Amd.Fis.',
        'AMDPK'     => 'Amd.PK.',
        'DIII'      => 'D.III',
        'DII'       => 'D.II',
        'DI'        => 'D.I',
        'DIV'       => 'D.IV',

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
     * Strategy:
     *  1. Split the full name on commas and spaces to get tokens.
     *  2. For each token, strip dots/spaces and uppercase → look up in DEGREE_MAP.
     *  3. Tokens that match a degree are collected as degrees; the rest form the name.
     *  4. Name → UPPERCASE, degrees → canonical form, joined with ", ".
     */
    public function normalizeTeacherName(?string $teacherName): ?string
    {
        if ($teacherName === null || trim($teacherName) === '') {
            return $teacherName;
        }

        $teacherName = trim($teacherName);
        $parsed      = $this->parseAcademicDegrees($teacherName);

        $normalizedName = mb_strtoupper($parsed['name'], 'UTF-8');

        if (!empty($parsed['degrees'])) {
            return $normalizedName . ', ' . implode(', ', $parsed['degrees']);
        }

        return $normalizedName;
    }

    /**
     * Parse academic degrees from a full name string using the DEGREE_MAP lookup.
     *
     * Tokenisation:
     *  - Split on commas first (common separator: "Ahmad, S.Pd.I, M.Ag.")
     *  - Then split each segment on spaces
     *  - Consecutive degree tokens are merged before lookup so that
     *    "A Ma Pust" (three space-separated tokens) is tried as "AMAPUST".
     *
     * @return array{name: string, degrees: string[]}
     */
    protected function parseAcademicDegrees(string $fullName): array
    {
        $map = $this->getDegreeMap();

        // Normalise separators: replace commas with spaces, collapse whitespace
        $flat   = preg_replace('/,+/', ' ', $fullName);
        $flat   = preg_replace('/\s+/', ' ', $flat);
        $tokens = array_filter(explode(' ', trim($flat)), fn($t) => $t !== '');
        $tokens = array_values($tokens);

        $nameTokens   = [];
        $degreeTokens = [];
        $i            = 0;
        $n            = count($tokens);

        while ($i < $n) {
            // Try to greedily match the longest run of tokens as a single degree.
            // Max window = 4 tokens (e.g. "A Ma Pust" = 3, "M B A" = 3)
            $matched = false;
            for ($window = min(4, $n - $i); $window >= 1; $window--) {
                $slice     = array_slice($tokens, $i, $window);
                $key       = $this->degreeKey(implode('', $slice));
                if (isset($map[$key])) {
                    $degreeTokens[] = $map[$key];
                    $i += $window;
                    $matched = true;
                    break;
                }
            }

            if (!$matched) {
                // Not a degree — belongs to the name portion
                // But only if we haven't started collecting degrees yet,
                // OR if it looks like a plain name word (no dots).
                // Tokens with dots that aren't in the map are kept as-is in degrees
                // to avoid mangling unknown abbreviations.
                $token = $tokens[$i];
                if (!empty($degreeTokens) && str_contains($token, '.')) {
                    // Unknown degree-like token after known degrees — preserve as-is
                    $degreeTokens[] = $token;
                } else {
                    $nameTokens[] = $token;
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
            'name'    => $name,
            'degrees' => $degreeTokens,
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
