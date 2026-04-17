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
    private const DEGREE_PATTERN = '/\b(Dr\.?|Dra\.?|S\.Pd\.?I?|M\.Pd\.?I?|S\.H\.?|S\.Ag\.?|M\.Ag\.?|S\.Si\.?|M\.Si\.?|S\.Kom\.?|M\.Kom\.?)\b/i';

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

        // Trim whitespace
        $schoolName = trim($schoolName);

        // Convert to Title Case word by word
        // Rules:
        // - Split on spaces → capitalize first letter of each word
        // - Split on hyphens within a word → capitalize each part (e.g. "Al-Hikmah")
        // - Do NOT capitalize after apostrophes (e.g. "Ma'arif" not "MA'Arif")
        // - Capitalize after opening parenthesis (e.g. "(Putra)" → "(Putra)")
        $words = explode(' ', mb_strtolower($schoolName, 'UTF-8'));
        $words = array_map(function (string $word): string {
            if ($word === '') {
                return $word;
            }
            // Handle hyphenated words: capitalize each hyphen-separated part
            $parts = explode('-', $word);
            $parts = array_map(function (string $part): string {
                if ($part === '') {
                    return $part;
                }
                // Strip leading punctuation like '(' to capitalize the actual letter
                $prefix = '';
                $rest = $part;
                while ($rest !== '' && mb_strpos('(', mb_substr($rest, 0, 1, 'UTF-8')) !== false) {
                    $prefix .= mb_substr($rest, 0, 1, 'UTF-8');
                    $rest = mb_substr($rest, 1, null, 'UTF-8');
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

        // Preserve common abbreviations in uppercase
        foreach (self::SCHOOL_ABBREVIATIONS as $abbr) {
            $pattern = '/\b' . preg_quote($abbr, '/') . '\b/i';
            $normalized = preg_replace($pattern, $abbr, $normalized);
        }

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
            'DR' => 'Dr.',
            'DRA' => 'Dra.',
            'SPD' => 'S.Pd.',
            'SPDI' => 'S.Pd.I',
            'MPD' => 'M.Pd.',
            'MPDI' => 'M.Pd.I',
            'SH' => 'S.H.',
            'SAG' => 'S.Ag.',
            'MAG' => 'M.Ag.',
            'SSI' => 'S.Si.',
            'MSI' => 'M.Si.',
            'SKOM' => 'S.Kom.',
            'MKOM' => 'M.Kom.',
        ];

        return $degreeFormats[$clean] ?? $degree;
    }
}
