<?php

namespace App\Services;

class NormalizationService
{
    /**
     * Common Indonesian education abbreviations that should remain uppercase
     */
    private const SCHOOL_ABBREVIATIONS = ['MI', 'MTs', 'MA', 'NU', 'SD', 'SMP', 'SMA', 'SMK'];

    /**
     * Indonesian academic degree patterns
     */
    private const DEGREE_PATTERN = '/\b(Dr\.?|Dra\.?|Prof\.?|S\.Pd\.?I?|M\.Pd\.?I?|S\.H\.?|M\.H\.?|S\.Ag\.?|M\.Ag\.?|S\.Si\.?|M\.Si\.?|S\.Kom\.?|M\.Kom\.?|S\.Sos\.?I?|M\.Sos\.?|S\.E\.?I?|M\.E\.?I?|S\.EI\.?|M\.EI\.?|S\.Fil\.?I?|S\.Th\.?I?|M\.Th\.?I?|S\.IP\.?|M\.IP\.?|S\.Psi\.?|M\.Psi\.?|S\.T\.?|M\.T\.?|S\.Hum\.?|M\.Hum\.?|M\.M\.?|M\.B\.A\.?|Lc\.?)\b/i';

    /**
     * Normalize school name to Title Case format
     * Preserves common abbreviations in uppercase (MI, MTs, MA, NU)
     * 
     * @param string|null $schoolName
     * @return string|null
     */
    public function normalizeSchoolName(?string $schoolName): ?string
    {
        // Handle null or empty strings
        if ($schoolName === null || trim($schoolName) === '') {
            return $schoolName;
        }

        $schoolName = trim($schoolName);

        // Step 1: lowercase everything
        $lower = mb_strtolower($schoolName, 'UTF-8');

        // Step 2: Title Case word by word, splitting on spaces only.
        // Within each space-separated token, also capitalize after hyphens and
        // after leading punctuation like '(' — but NOT after apostrophes
        // (straight ' or curly ') so "ma'arif" stays "Ma'arif".
        $words = explode(' ', $lower);
        $words = array_map(function (string $word): string {
            if ($word === '') {
                return $word;
            }
            // Capitalize each hyphen-separated segment
            $parts = explode('-', $word);
            $parts = array_map(function (string $part): string {
                if ($part === '') {
                    return $part;
                }
                // Skip leading punctuation chars (e.g. '(') and capitalize the
                // first real letter
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
                if ($rest === '') {
                    return $prefix;
                }
                return $prefix
                    . mb_strtoupper(mb_substr($rest, 0, 1, 'UTF-8'), 'UTF-8')
                    . mb_substr($rest, 1, null, 'UTF-8');
            }, $parts);
            return implode('-', $parts);
        }, $words);

        $normalized = implode(' ', $words);

        // Step 3: Restore known abbreviations to their canonical uppercase form.
        // Use space-aware replacement to match whole space-delimited tokens.
        // Also handle abbreviations followed by a period (e.g. "MTs." → "MTs.")
        $padded = ' ' . $normalized . ' ';
        foreach (self::SCHOOL_ABBREVIATIONS as $abbr) {
            // Match the abbreviation as a standalone token (with or without trailing period)
            $padded = str_ireplace(' ' . $abbr . ' ', ' ' . $abbr . ' ', $padded);
            $padded = str_ireplace(' ' . $abbr . '. ', ' ' . $abbr . '. ', $padded);
        }
        $normalized = trim($padded);

        return $normalized;
    }

    /**
     * Normalize place of birth to Title Case format (e.g., "cilacap" → "Cilacap")
     *
     * @param string|null $placeOfBirth
     * @return string|null
     */
    public function normalizePlaceOfBirth(?string $placeOfBirth): ?string
    {
        if ($placeOfBirth === null || trim($placeOfBirth) === '') {
            return $placeOfBirth;
        }

        return mb_convert_case(trim($placeOfBirth), MB_CASE_TITLE, 'UTF-8');
    }

    /**
     * Normalize teacher name to UPPERCASE with preserved academic degrees
     * Handles degrees: S.Pd., M.Pd., Dr., Dra., S.H., S.Ag., M.Ag., etc.
     * 
     * @param string|null $teacherName
     * @return string|null
     */
    public function normalizeTeacherName(?string $teacherName): ?string
    {
        // Handle null or empty strings
        if ($teacherName === null || trim($teacherName) === '') {
            return $teacherName;
        }

        // Trim whitespace
        $teacherName = trim($teacherName);

        // Parse academic degrees
        $parsed = $this->parseAcademicDegrees($teacherName);

        // Convert name portion to UPPERCASE using multibyte-safe function
        $normalizedName = mb_strtoupper($parsed['name'], 'UTF-8');

        // If there are degrees, format and append them
        if (!empty($parsed['degrees'])) {
            $formattedDegrees = array_map(
                fn($degree) => $this->formatDegree($degree),
                $parsed['degrees']
            );
            return $normalizedName . ', ' . implode(', ', $formattedDegrees);
        }

        return $normalizedName;
    }

    /**
     * Parse and extract academic degrees from a name string
     * Returns array with 'name' and 'degrees' keys
     * 
     * @param string $fullName
     * @return array{name: string, degrees: array<string>}
     */
    protected function parseAcademicDegrees(string $fullName): array
    {
        $degrees = [];
        $name = $fullName;

        // Find all degree matches
        if (preg_match_all(self::DEGREE_PATTERN, $fullName, $matches)) {
            $degrees = $matches[0];
            
            // Remove degrees from the name
            $name = preg_replace(self::DEGREE_PATTERN, '', $fullName);
        }

        // Remove commas, periods, and extra whitespace from name
        $name = preg_replace('/[,.\s]+/', ' ', $name);
        $name = trim($name);

        return [
            'name' => $name,
            'degrees' => $degrees,
        ];
    }

    /**
     * Format academic degree with proper capitalization
     * 
     * @param string $degree
     * @return string
     */
    protected function formatDegree(string $degree): string
    {
        // Remove all periods first
        $clean = str_replace('.', '', $degree);
        
        // Convert to uppercase
        $clean = mb_strtoupper($clean, 'UTF-8');

        // Map of degree formats
        $degreeFormats = [
            'DR'   => 'Dr.',
            'DRA'  => 'Dra.',
            'PROF' => 'Prof.',
            'SPD'  => 'S.Pd.',
            'SPDI' => 'S.Pd.I',
            'MPD'  => 'M.Pd.',
            'MPDI' => 'M.Pd.I',
            'SH'   => 'S.H.',
            'MH'   => 'M.H.',
            'SAG'  => 'S.Ag.',
            'MAG'  => 'M.Ag.',
            'SSI'  => 'S.Si.',
            'MSI'  => 'M.Si.',
            'SKOM' => 'S.Kom.',
            'MKOM' => 'M.Kom.',
            'SSOS' => 'S.Sos.',
            'SSOSI'=> 'S.Sos.I',
            'MSOS' => 'M.Sos.',
            'SE'   => 'S.E.',
            'SEI'  => 'S.E.I',
            'MEI'  => 'M.E.I',
            'SFILI'=> 'S.Fil.I',
            'STHI' => 'S.Th.I',
            'MTHI' => 'M.Th.I',
            'SIP'  => 'S.IP.',
            'MIP'  => 'M.IP.',
            'SPSI' => 'S.Psi.',
            'MPSI' => 'M.Psi.',
            'ST'   => 'S.T.',
            'MT'   => 'M.T.',
            'SHUM' => 'S.Hum.',
            'MHUM' => 'M.Hum.',
            'MM'   => 'M.M.',
            'MBA'  => 'M.B.A.',
            'LC'   => 'Lc.',
        ];

        return $degreeFormats[$clean] ?? $degree;
    }
}
