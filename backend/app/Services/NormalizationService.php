<?php

namespace App\Services;

class NormalizationService
{
    /**
     * Common Indonesian education abbreviations that should remain uppercase
     */
    private const SCHOOL_ABBREVIATIONS = ['MI', 'MTs', 'MA', 'NU', 'SD', 'SMP', 'SMA', 'SMK', 'RA', 'TK', 'PAUD', 'SDIT', 'SMPIT', 'SMAIT', 'LP', 'PGRI'];

    /**
     * Words that should remain lowercase in school names
     */
    private const SCHOOL_KEEP_LOWER = ['dan', 'di', 'ke', 'dari', 'yang', 'untuk', 'dengan', 'bin', 'binti'];

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
        'SPDAUDI'   => 'S.Pd.AUD.I',
        'SPDAUD'    => 'S.Pd.AUD.',
        'SPDSDI'    => 'S.Pd.SD.I',
        'SPDSD'     => 'S.Pd.SD.',
        'SPDKI'     => 'S.Pd.K.I',
        'SPDK'      => 'S.Pd.K.',
        'SPDBI'     => 'S.Pd.B.I',
        'SPDB'      => 'S.Pd.B.',
        'SPDSI'     => 'S.Pd.Si.',
        'SPDGR'     => 'S.Pd.Gr.',
        'SPDI'      => 'S.Pd.I',
        'SPD'       => 'S.Pd.',
        'SSOSI'     => 'S.Sos.I',
        'SSOS'      => 'S.Sos.',
        'SFILI'     => 'S.Fil.I',
        'SFIL'      => 'S.Fil.',
        'STHI'      => 'S.Th.I',
        'STH'       => 'S.Th.',
        'SESY'      => 'S.E.Sy.',
        'SHSY'      => 'S.H.Sy.',
        'SSY'       => 'S.Sy.',
        'SAG'       => 'S.Ag.',
        'SHINT'     => 'S.H.Int.',
        'SHI'       => 'S.H.I',
        'SH'        => 'S.H.',
        'SEI'       => 'S.E.I',
        'SE'        => 'S.E.',
        'SSI'       => 'S.Si.',
        'SKOMI'     => 'S.Kom.I',
        'SKOM'      => 'S.Kom.',
        'SIPUST'    => 'S.I.Pust.',
        'SIP'       => 'S.I.P.',
        'SPSI'      => 'S.Psi.',
        'STP'       => 'S.T.P.',
        'SPI'       => 'S.Pi.',
        'SHUT'      => 'S.Hut.',
        'SARS'      => 'S.Ars.',
        'SDS'       => 'S.Ds.',
        'SIKOM'     => 'S.I.Kom.',
        'SIK'       => 'S.I.K.',
        'SSN'       => 'S.Sn.',
        'SMAT'      => 'S.Mat.',
        'SSTAT'     => 'S.Stat.',
        'SAP'       => 'S.A.P.',
        'SAB'       => 'S.A.B.',
        'STRK'      => 'S.Tr.K.',
        'STRG'      => 'S.Tr.G.',
        'STR'       => 'S.Tr.',
        'SPWK'      => 'S.P.W.K.',
        'SPW'       => 'S.P.W.',
        'ST'        => 'S.T.',
        'SHUM'      => 'S.Hum.',
        'SKEDG'     => 'S.Ked.G.',
        'SKEDH'     => 'S.Ked.H.',
        'SKED'      => 'S.Ked.',
        'SKM'       => 'S.K.M.',
        'SKEPI'     => 'S.Kep.I',
        'SKEP'      => 'S.Kep.',
        'SFARM'     => 'S.Farm.',
        'SFAR'      => 'S.Far.',
        'SGIZI'     => 'S.Gz.',
        'SGZ'       => 'S.Gz.',
        'SAKI'      => 'S.Ak.I',
        'SAK'       => 'S.Ak.',
        'SPTR'      => 'S.Pt.',
        'SPT'       => 'S.Pt.',
        'STER'      => 'S.Ter.',
        'SANTER'    => 'S.An.',
        'SANT'      => 'S.Ant.',
        'SAN'       => 'S.An.',
        'SMB'       => 'S.M.B.',
        'SM'        => 'S.M.',
        'SBNS'      => 'S.Bns.',
        'SIN'       => 'S.In.',
        'SKS'       => 'S.K.S.',
        'SPAR'      => 'S.Par.',
        'SP'        => 'S.P.',
        'SS'        => 'S.S.',

        // ── Diploma ───────────────────────────────────────────────────────
        'AMAPUST'   => 'A.Ma.Pust.',
        'AMAPD'     => 'A.Ma.Pd.',
        'AMAPDSD'   => 'A.Ma.Pd.SD.',
        'AMA'       => 'A.Ma.',
        'AMDPUST'   => 'A.Md.Pust.',
        'AMDKOM'    => 'A.Md.Kom.',
        'AMDTI'     => 'A.Md.T.I.',
        'AMDKEB'    => 'Amd.Keb.',
        'AMDKEP'    => 'Amd.Kep.',
        'AMDFAR'    => 'Amd.Far.',
        'AMDGZ'     => 'Amd.Gz.',
        'AMDAK'     => 'Amd.Ak.',
        'AMDRAD'    => 'Amd.Rad.',
        'AMDFIS'    => 'Amd.Fis.',
        'AMDPJK'    => 'A.Md.Pjk.',
        'AMDPK'     => 'Amd.PK.',
        'AMDK'      => 'Amd.K.',
        'AMD'       => 'A.Md.',
        'DIII'      => 'D.III',
        'DII'       => 'D.II',
        'DIV'       => 'D.IV',
        'DI'        => 'D.I',

        // ── Magister (S2) ─────────────────────────────────────────────────
        'MPDGR'     => 'M.Pd.Gr.',
        'MPDI'      => 'M.Pd.I',
        'MPDKI'     => 'M.Pd.K.I',
        'MPDK'      => 'M.Pd.K.',
        'MPDBI'     => 'M.Pd.B.I',
        'MPDB'      => 'M.Pd.B.',
        'MPDSI'     => 'M.Pd.Si.',
        'MPD'       => 'M.Pd.',
        'MSOSI'     => 'M.Sos.I',
        'MSOS'      => 'M.Sos.',
        'MFILI'     => 'M.Fil.I',
        'MFIL'      => 'M.Fil.',
        'MTHI'      => 'M.Th.I',
        'MTH'       => 'M.Th.',
        'MSY'       => 'M.Sy.',
        'MHSY'      => 'M.H.Sy.',
        'MESY'      => 'M.E.Sy.',
        'MAG'       => 'M.Ag.',
        'MHI'       => 'M.H.I',
        'MH'        => 'M.H.',
        'MHKES'     => 'M.H.Kes.',
        'MEI'       => 'M.E.I',
        'ME'        => 'M.E.',
        'MSC'       => 'M.Sc.',
        'MSI'       => 'M.Si.',
        'MKOMI'     => 'M.Kom.I',
        'MKOM'      => 'M.Kom.',
        'MIP'       => 'M.I.P.',
        'MPSI'      => 'M.Psi.',
        'MT'        => 'M.T.',
        'MHUM'      => 'M.Hum.',
        'MMPD'      => 'M.M.Pd.',
        'MMRS'      => 'M.M.R.S.',
        'MMKES'     => 'M.M.Kes.',
        'MM'        => 'M.M.',
        'MA'        => 'M.A.',
        'MEDM'      => 'M.Ed.M.',
        'MED'       => 'M.Ed.',
        'MBA'       => 'M.B.A.',
        'MKM'       => 'M.K.M.',
        'MKES'      => 'M.Kes.',
        'MKED'      => 'M.Ked.',
        'MAK'       => 'M.Ak.',
        'MKN'       => 'M.Kn.',
        'MSN'       => 'M.Sn.',
        'MDS'       => 'M.Ds.',
        'MDES'      => 'M.Des.',
        'MPAR'      => 'M.Par.',
        'MEPID'     => 'M.Epid.',
        'MFARM'     => 'M.Farm.',
        'MIKOM'     => 'M.I.Kom.',
        'MKKK'      => 'M.K.K.K.',
        'MKEP'      => 'M.Kep.',
        'MP'        => 'M.P.',

        // ── Doktor (S3) ───────────────────────────────────────────────────
        'PHD'       => 'Ph.D.',

        // ── Profesi / Spesialis ───────────────────────────────────────────
        'NS'        => 'Ns.',
        'LC'        => 'Lc.',
        'SH1'       => 'S.H.',   // alias
        'AKT'       => 'Akt.',
        'APT'       => 'Apt.',
        'BDN'       => 'Bdn.',
        'DRG'       => 'drg.',
        'DRH'       => 'drh.',
        'IR'        => 'Ir.',
        'SPOG'      => 'Sp.OG.',
        'SPA'       => 'Sp.A.',
        'SPAN'      => 'Sp.An.',
        'SPKJ'      => 'Sp.KJ.',
        'SPRAD'     => 'Sp.Rad.',
        'SPBEDAH'   => 'Sp.B.',
        'SPB'       => 'Sp.B.',
        'SPG'       => 'Sp.G.',
        'SPJP'      => 'Sp.JP.',
        'SPM'       => 'Sp.M.',
        'SPP'       => 'Sp.P.',
        'SPPD'      => 'Sp.PD.',
        'SPTHT'     => 'Sp.THT.',
        'SPKK'      => 'Sp.KK.',
        'SPMK'      => 'Sp.MK.',
    ];

    /**
     * Normalize school name to Title Case format
     * Preserves common abbreviations in uppercase (MI, MTs, MA, NU, RA, dll.)
     */
    public function normalizeSchoolName(?string $schoolName): ?string
    {
        if ($schoolName === null || trim($schoolName) === '') {
            return $schoolName;
        }

        $name = trim($schoolName);

        // Step 1: Normalize prefix variants
        $name = str_replace('`', "'", $name);
        
        // Handle input kesalahan "Ma,arif" menjadi "Ma'arif" (case insensitive)
        $name = preg_replace('/ma,arif/i', "Ma'arif", $name);

        // MTsS, MTSS, MTS → MTs (case-insensitive, at start of string)
        $name = preg_replace('/^(MTsS|MTSS|MTS)\s+/i', 'MTs ', $name);

        // MIS, Mis, Mi → MI
        $name = preg_replace('/^(MIS|Mis|Mi)\s+/i', 'MI ', $name);

        // MAS, Mas → MA
        $name = preg_replace('/^(MAS|Mas)\s+/i', 'MA ', $name);

        // Step 2: Convert to Title Case word by word
        $words  = explode(' ', $name);
        $result = [];

        foreach ($words as $i => $word) {
            if (empty($word)) continue;

            $upper = mb_strtoupper($word, 'UTF-8');
            $lower = mb_strtolower($word, 'UTF-8');

            // Keep known acronyms uppercase
            if (in_array($upper, self::SCHOOL_ABBREVIATIONS, true)) {
                $result[] = $upper;
                continue;
            }

            // Keep MTs specifically (mixed case acronym)
            if (mb_strtolower($word, 'UTF-8') === 'mts') {
                $result[] = 'MTs';
                continue;
            }

            // Keep conjunctions lowercase (except first word)
            if ($i > 0 && in_array($lower, self::SCHOOL_KEEP_LOWER, true)) {
                $result[] = $lower;
                continue;
            }

            // Handle kata dengan apostrof: Ma'arif → Ma'arif, 'Uqul → 'Uqul
            if (str_contains($word, "'") || str_contains($word, '`')) {
                $result[] = $this->titleCaseWithApostrophe($word);
                continue;
            }

            // Handle hyphenated words: AL-MAHDY → Al-Mahdy, Al-mahdy → Al-Mahdy
            if (str_contains($word, '-')) {
                $result[] = $this->titleCaseWithHyphen($word);
                continue;
            }

            // Fallback: handle prefix punctuation like ( [ {
            $prefix = '';
            $rest = $word;
            while ($rest !== '') {
                $ch = mb_substr($rest, 0, 1, 'UTF-8');
                if (mb_strpos('([{', $ch) !== false) {
                    $prefix .= $ch;
                    $rest = mb_substr($rest, 1, null, 'UTF-8');
                } else {
                    break;
                }
            }
            if ($rest === '') {
                $result[] = $prefix;
            } else {
                $result[] = $prefix . mb_convert_case($rest, MB_CASE_TITLE, 'UTF-8');
            }
        }

        return implode(' ', $result);
    }

    private function titleCaseWithApostrophe(string $word): string
    {
        $apostrophes = ["'", "\u{2018}", "\u{2019}", "`"];
        
        $firstChar = mb_substr($word, 0, 1);
        if (in_array($firstChar, $apostrophes, true)) {
            $rest = mb_substr($word, 1);
            return $firstChar . mb_convert_case($rest, MB_CASE_TITLE, 'UTF-8');
        }
        
        $parts = preg_split("/(['`])/u", $word, -1, PREG_SPLIT_DELIM_CAPTURE);
        $out   = [];
        foreach ($parts as $i => $part) {
            if (in_array($part, $apostrophes, true)) {
                $out[] = "'";
            } else {
                $out[] = $i === 0 ? mb_convert_case($part, MB_CASE_TITLE, 'UTF-8') : mb_strtolower($part, 'UTF-8');
            }
        }
        return implode('', $out);
    }

    private function titleCaseWithHyphen(string $word): string
    {
        $parts = explode('-', $word);
        return implode('-', array_map(fn($p) => mb_convert_case($p, MB_CASE_TITLE, 'UTF-8'), $parts));
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
            if ($result === '') {
                $result = implode(', ', $suffixes);
            } else {
                $result .= ', ' . implode(', ', $suffixes);
            }
        }

        if (!empty($prefixes)) {
            if ($result === '') {
                $result = implode(' ', $prefixes);
            } else {
                $result = implode(' ', $prefixes) . ' ' . $result;
            }
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
    /**
     * Public wrapper for parseAcademicDegrees — allows callers outside the service
     * to extract the bare name and degree components from a full teacher name.
     *
     * @return array{name: string, prefix_degrees: string[], suffix_degrees: string[]}
     */
    public function parseAcademicDegreesPublic(string $fullName): array
    {
        return $this->parseAcademicDegrees($fullName);
    }

    protected function parseAcademicDegrees(string $fullName): array
    {
        $map = $this->getDegreeMap();

        // Pre-process: protect name abbreviations at the start of the name from being
        // mistakenly parsed as academic degrees.
        //
        // Pattern: "ST. SARINGATUN, S.Pd.I" — "ST." is a 2-letter name abbreviation
        // (singkatan nama), NOT the academic degree S.T. (Sarjana Teknik).
        //
        // Heuristic: if the string starts with a 2-3 letter token followed by ". "
        // (dot + space), AND the next token is ≥4 pure letters (looks like a real name),
        // AND the degree map ALSO contains that 2-3 letter key,
        // AND it is NOT a recognized prefix degree (Dr., Dra., Prof.) —
        // then protect it by joining with a sentinel so the parser won't treat it as a degree.
        //
        // e.g. "ST. SARINGATUN, S.Pd.I" → pre-process marks "ST." as protected → parsed
        //      correctly as name abbreviation, not S.T. degree.
        $fullName = preg_replace_callback(
            '/^([A-Za-z]{2,3})\.\s+([A-Za-z]{4,}(?:\s|,|$))/u',
            function ($matches) use ($map) {
                $abbrevKey  = mb_strtoupper($matches[1], 'UTF-8');
                $nameWord   = $matches[2];
                $nameKey    = mb_strtoupper(preg_replace('/[\s.,]+/', '', trim($nameWord)), 'UTF-8');
                // Only protect if:
                // 1. The abbreviation IS a known degree key (otherwise no conflict to resolve)
                // 2. The following word is NOT a degree key (i.e. it's a real name word)
                // 3. The abbreviation is NOT a prefix degree (Dr., Dra., Prof. must still work)
                if (
                    isset($map[$abbrevKey]) &&
                    !isset($map[$nameKey]) &&
                    !in_array($abbrevKey, self::PREFIX_DEGREES, true)
                ) {
                    // Replace the space between abbreviation and name with a zero-width sentinel
                    // so they become a single token, preventing degree detection.
                    // We use \x1A (SUB control character) as separator; it will be replaced
                    // back to a space in the name cleanup step.
                    return $matches[1] . ".\x1A" . $nameWord;
                }
                return $matches[0]; // leave unchanged
            },
            trim($fullName)
        );

        // Pre-process: ensure there is a space before degrees that start with S., M., Dr., Dra., etc.
        // e.g. "BudiS.E." -> "Budi S.E."
        $fullName = preg_replace('/([a-zA-Z]{3,})(S\.|M\.|A\.Md\.|A\.Ma\.|Dr\.|Dra\.|Prof\.)/i', '$1 $2', $fullName);

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

        // Clean up name: remove stray commas, replace sentinel, collapse spaces.
        // The '\x1A' sentinel was inserted during pre-processing to protect name
        // abbreviations like "ST." from being parsed as degrees; replace it with a space.
        $name = implode(' ', $nameTokens);
        $name = str_replace("\x1A", ' ', $name);
        // Remove stray commas (not part of names); keep dots intact because they may
        // be part of legitimate name abbreviations (e.g. "ST.", "H.", "Hj.").
        $name = str_replace(',', '', $name);
        // Remove standalone dot tokens (single "." with spaces on both sides or at ends)
        $name = preg_replace('/(?:^|\s)\.(?:\s|$)/', ' ', $name);
        $name = preg_replace('/\s+/', ' ', $name);

        // Add dots to single-letter abbreviations (e.g., A -> A.)
        $name = preg_replace('/\b([A-Za-z])(\s|$)/i', '$1.$2', $name);
        
        // Add dots to specific abbreviations (Moch, Mokh, Moh, Hj)
        $name = preg_replace('/\b(Moch|Mokh|Moh|Hj)(\s|$)/i', '$1.$2', $name);

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
     * Strategy:
     * - Try 4+ character degrees first (safer, less false positives)
     * - Then try 3-character degrees from whitelist (common degrees like SAG, SPD, MPD)
     * - Exclude 2-character degrees (too many false positives)
     * - Name part must be ≥ 4 characters after splitting
     */
    protected function splitAttachedDegrees(string $name): string
    {
        // 3-character degree keys that are safe to split (common academic degrees)
        // These are whitelisted because they're very common in Indonesian academic context
        $safeThreeCharKeys = [
            'SAG', 'SPD', 'MPD', 'SSY', 'SSI', 'SIP', 'SKM', 'SGZ', 'SAK', 'SPT',
            'MAG', 'MSI', 'MIP', 'MKM', 'MAK', 'MKN', 'MSN', 'MDS',
            'PHD', 'AMA', 'AMD', 'DII', 'DIV', 'SAN', 'SOS', 'FIL', 'STH', 'SEI',
            'SHI', 'SKI', 'SPI', 'SST', 'MHI', 'MKI', 'MPI', 'MST', 'MBA', 'MPA',
        ];

        // Keys explicitly excluded from split detection due to high false-positive rate
        // as name substrings. These are still handled correctly when they appear as
        // separate tokens (e.g. "AHMAD DR" or "SITI, Dra.").
        $excludeFromSplit = ['DR', 'DRA', 'SH', 'ST', 'SE', 'SM', 'MM', 'MT', 'ME', 'MH', 'LC', 'NS'];

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

            // Minimum total: name part (≥4) + degree key (≥3) = 7
            if (strlen($upper) < 7) {
                $result[] = $token;
                continue;
            }

            $split = false;
            
            // Try to match degrees from longest to shortest
            foreach ($map as $key => $canonical) {
                $keyLen = strlen($key);

                // Skip excluded keys
                if (in_array($key, $excludeFromSplit, true)) continue;

                // For 3-character keys, only allow whitelisted ones
                if ($keyLen === 3 && !in_array($key, $safeThreeCharKeys, true)) continue;

                // Skip 2-character or shorter keys (too risky)
                if ($keyLen < 3) continue;

                $nameLen = strlen($upper) - $keyLen;

                // Name part must be at least 4 characters
                if ($nameLen < 4) continue;

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
    public function normalizeEmploymentStatus(?string $status, ?\Carbon\Carbon $tmt = null, ?string $teacherName = null, ?string $pendidikan = null): ?string
    {
        if ($status === null || trim($status) === '') {
            return $status;
        }

        $valid = ['GTY', 'GTT', 'Tendik', 'PNS'];
        $trimmed = trim($status);

        $resolvedStatus = $trimmed;
        if (!in_array($trimmed, $valid, true)) {
            $upper = mb_strtoupper($trimmed, 'UTF-8');

            // Expanded mapping for common Excel values
            $resolvedStatus = match (true) {
                $upper === 'AKTIF'                                    => $this->resolveAktif($tmt),
                in_array($upper, ['GTTY', 'GURU TIDAK TETAP'], true) => 'GTT',
                in_array($upper, ['GURU TETAP YAYASAN', 'KEPALA MADRASAH', 'KEPALA SEKOLAH'], true) => 'GTY',
                in_array($upper, ['TENAGA KEPENDIDIKAN', 'TENDIK'], true) => 'Tendik',
                $upper === 'PNS'                                      => 'PNS',
                // Common Excel values
                str_contains($upper, 'HONORER')                       => 'GTT', // "Honorer" → GTT
                str_contains($upper, 'GTK NON PNS')                   => 'GTT', // "GTK Non PNS" → GTT
                str_contains($upper, 'NON PNS')                       => 'GTT', // "Non PNS" → GTT
                str_contains($upper, 'KONTRAK')                       => 'GTT', // "Kontrak" → GTT
                str_contains($upper, 'TIDAK TETAP')                   => 'GTT', // "Tidak Tetap" → GTT
                str_contains($upper, 'TETAP')                         => 'GTY', // "Tetap" → GTY (after "Tidak Tetap" check)
                str_contains($upper, 'YAYASAN')                       => 'GTY', // "Yayasan" → GTY
                default                                               => 'GTT', // safe fallback
            };
        } elseif (in_array($trimmed, ['GTY', 'GTT'], true) && $tmt !== null) {
            // Re-evaluate TMT-based status even for already-valid GTY/GTT values.
            // This corrects cases like: status=GTT but TMT ≥ 2 years (should be GTY),
            // or status=GTY but TMT < 2 years (should be GTT).
            $resolvedStatus = $this->resolveAktif($tmt);
        }

        // Business rule: If a teacher has no academic degrees (no prefixes and no suffixes),
        // they should be classified as 'Tendik' instead of 'GTY' or 'GTT'.
        if ($teacherName !== null && in_array($resolvedStatus, ['GTY', 'GTT'], true)) {
            $parsedName = $this->parseAcademicDegrees($teacherName);
            if (empty($parsedName['prefix_degrees']) && empty($parsedName['suffix_degrees'])) {
                return 'Tendik';
            }
            
            // Check if all suffix degrees are diploma (A.Md, A.Ma)
            if (!empty($parsedName['suffix_degrees'])) {
                $isAllDiploma = true;
                foreach ($parsedName['suffix_degrees'] as $deg) {
                    if (!str_starts_with($deg, 'A.Md') && !str_starts_with($deg, 'A.Ma')) {
                        $isAllDiploma = false;
                        break;
                    }
                }
                if ($isAllDiploma) {
                    return 'Tendik';
                }
            }
        }

        // Check explicit pendidikan column
        if ($pendidikan !== null && in_array($resolvedStatus, ['GTY', 'GTT'], true)) {
            $p = preg_replace('/[^a-z0-9]/', '', mb_strtolower(trim($pendidikan), 'UTF-8'));
            if (in_array($p, ['d3', 'diii', 'd2', 'd1', 'sma', 'smp', 'sd', 'slta', 'sltp'])) {
                return 'Tendik';
            }
        }

        return $resolvedStatus;
    }

    /**
     * Map nama bulan Indonesia (panjang & singkat) ke nomor bulan.
     */
    private const BULAN_MAP = [
        'januari' => 1,  'februari' => 2,  'maret' => 3,    'april' => 4,
        'mei'     => 5,  'juni'     => 6,  'juli'  => 7,    'agustus'   => 8,
        'september' => 9, 'oktober' => 10, 'november' => 11, 'desember' => 12,
        // Ejaan lama / umum
        'pebruari' => 2, 'nopember' => 11,
        // Bahasa Inggris (berjaga-jaga)
        'january' => 1, 'february' => 2, 'march' => 3, 'may' => 5,
        'june' => 6, 'july' => 7, 'august' => 8, 'october' => 10, 'december' => 12,
        // Singkat
        'jan' => 1, 'feb' => 2, 'peb' => 2, 'mar' => 3, 'apr' => 4,
        'jun' => 6, 'jul' => 7, 'agu' => 8, 'ags' => 8,
        'sep' => 9, 'okt' => 10, 'nov' => 11, 'nop' => 11, 'des' => 12,
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

        // Replace non-breaking spaces (\xC2\xA0) with standard spaces before trimming
        $trimmed = trim(str_replace("\xC2\xA0", ' ', $val));

        // 1. Sudah ISO YYYY-MM-DD
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/u', $trimmed)) {
            return $trimmed;
        }

        // 2. YYYY/MM/DD
        if (preg_match('/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/u', $trimmed, $m)) {
            return sprintf('%04d-%02d-%02d', $m[1], $m[2], $m[3]);
        }

        // 3 & 4. DD MMMM YYYY atau DD MMM YYYY (nama bulan Indonesia)
        if (preg_match('/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/u', $trimmed, $m)) {
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
            $parsed = \Carbon\Carbon::parse($trimmed);
            // If the input was an ISO 8601 string in UTC (e.g., from JS toISOString()),
            // converting it to the app's timezone ensures the date matches the local day.
            $parsed->setTimezone(config('app.timezone', 'Asia/Jakarta'));
            return $parsed->format('Y-m-d');
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

    /**
     * Enrich a teacher name from the SK submission with the canonical name
     * (including academic degrees) stored in the Teacher database.
     *
     * Resolution rule — the name with MORE degrees wins:
     *   - If the DB record has degrees but the input doesn't  → use DB name.
     *   - If the input has degrees but the DB record doesn't  → use input name
     *     (and the caller is responsible for updating the Teacher record).
     *   - If both have degrees                               → use input name
     *     (the freshly submitted document is the authoritative source).
     *   - If neither has degrees                             → use input name as-is.
     *
     * Matching strategy (in order):
     *   1. Exact match on the already-normalized name — return as-is (fast path).
     *   2. Strip degrees from the input, then do a case-insensitive lookup on
     *      the bare name portion of Teacher.nama within the given school.
     *   3. If still not found, try the same lookup across all schools.
     *
     * @param  string       $name      Name as extracted from the document (may be normalized already).
     * @param  int|null     $schoolId  Preferred school scope for the lookup.
     * @return string                  Best name with degrees, or the original normalized name.
     */
    public function enrichNameFromTeacher(string $name, ?int $schoolId = null): string
    {
        if (trim($name) === '') {
            return $name;
        }

        // Fast path: exact match already exists in the DB — nothing to enrich.
        $exact = \App\Models\Teacher::withoutTenantScope()
            ->where('nama', $name)
            ->when($schoolId, fn($q) => $q->where('school_id', $schoolId))
            ->value('nama');

        if ($exact !== null) {
            return $exact;
        }

        // Extract the bare name (without degrees) from the input.
        $parsed      = $this->parseAcademicDegrees($name);
        $bareName    = mb_strtoupper(trim($parsed['name']), 'UTF-8');
        $inputHasDegrees = !empty($parsed['suffix_degrees']) || !empty($parsed['prefix_degrees']);

        if ($bareName === '') {
            return $name;
        }

        // Look for a teacher whose bare name matches.
        // Strip degrees (after comma) from DB names before comparison.
        // Match: bare name (part before first comma) OR exact full name (for names without commas).
        // Uses LIKE for database-agnostic compatibility (works on both PostgreSQL and SQLite).
        $find = function (?int $sid) use ($bareName): ?string {
            return \App\Models\Teacher::withoutTenantScope()
                ->where(function ($q) use ($bareName) {
                    $q->whereRaw("UPPER(nama) = ?", [$bareName])
                      ->orWhereRaw("UPPER(nama) LIKE ?", [$bareName . ',%']);
                })
                ->when($sid, fn($q) => $q->where('school_id', $sid))
                ->orderByDesc('updated_at')
                ->value('nama');
        };

        $dbName = null;
        if ($schoolId) {
            $dbName = $find($schoolId);
        }
        if ($dbName === null) {
            $dbName = $find(null);
        }

        // No match in DB — keep the input as-is.
        if ($dbName === null) {
            return $name;
        }

        // Determine which name has degrees.
        $dbParsed      = $this->parseAcademicDegrees($dbName);
        $dbHasDegrees  = !empty($dbParsed['suffix_degrees']) || !empty($dbParsed['prefix_degrees']);

        // Input has degrees → it is the more complete source; use it.
        // DB has degrees but input doesn't → use DB name.
        // Neither has degrees → use input (no change).
        if ($inputHasDegrees) {
            return $name;
        }

        if ($dbHasDegrees) {
            return $dbName;
        }

        return $name;
    }

    /**
     * Normalize a NIM (Nomor Induk Maarif) to digits-only format.
     *
     * Accepts formats like:
     *   "113.403.283"  → "113403283"
     *   "113-403-283"  → "113403283"
     *   " 113403283 "  → "113403283"
     *   "'113403283"   → "113403283"
     *   "113403283"    → "113403283"  (already clean)
     *
     * Returns null if the input is null/empty or contains no digits.
     */
    public function normalizeNim(?string $nim): ?string
    {
        if ($nim === null || trim($nim) === '') {
            return null;
        }

        // Strip leading apostrophe (Excel artifact), then remove all non-digit characters
        $cleaned = preg_replace('/[^0-9]/', '', ltrim(trim($nim), "'"));

        return $cleaned !== '' ? $cleaned : null;
    }
}
