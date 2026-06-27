<?php

namespace App\Services;

class MatchingService
{
    /**
     * Calculate similarity percentage between two strings.
     * Uses PHP's similar_text under the hood after normalizing both strings.
     * 
     * @param string|null $str1
     * @param string|null $str2
     * @return float Percentage of similarity (0 to 100)
     */
    public function calculateSimilarity(?string $str1, ?string $str2): float
    {
        if (empty($str1) && empty($str2)) {
            return 100.0;
        }
        if (empty($str1) || empty($str2)) {
            return 0.0;
        }

        $clean1 = $this->cleanStringForComparison($str1);
        $clean2 = $this->cleanStringForComparison($str2);

        if ($clean1 === $clean2) {
            return 100.0;
        }

        similar_text($clean1, $clean2, $percent);
        return $percent;
    }

    /**
     * Calculate an overall confidence score based on Name and Unit Kerja similarities.
     * 
     * @param string|null $name1
     * @param string|null $name2
     * @param string|null $unit1
     * @param string|null $unit2
     * @return array [ 'score' => float, 'name_similarity' => float, 'unit_similarity' => float ]
     */
    public function calculateMatchScore(?string $name1, ?string $name2, ?string $unit1, ?string $unit2): array
    {
        $nameSimilarity = $this->calculateSimilarity($name1, $name2);
        
        // If one of the unit is missing, we shouldn't heavily penalize, but we can't be as confident.
        // For this specific use case, we will always try to match. If unit is empty, we assume 50% match so it doesn't skew to 0.
        $unitSimilarity = 50.0;
        if (!empty($unit1) && !empty($unit2)) {
            $unitSimilarity = $this->calculateSimilarity($unit1, $unit2);
        }

        // Weighting: Name is 60%, Unit Kerja is 40%
        $totalScore = ($nameSimilarity * 0.6) + ($unitSimilarity * 0.4);

        return [
            'total_score' => $totalScore,
            'name_similarity' => $nameSimilarity,
            'unit_similarity' => $unitSimilarity,
        ];
    }

    /**
     * Determine the status for the import preview based on match results.
     */
    public function determineStatus(array $dbMatches, array $fileData): array
    {
        if (empty($dbMatches)) {
            return [
                'status' => 'INSERT_BARU',
                'action' => 'INSERT',
                'target_id' => null,
                'confidence' => 0,
                'message' => 'NIM tidak ditemukan. Akan ditambahkan sebagai guru baru.'
            ];
        }

        $bestMatch = null;
        $highestScore = -1;
        $bestMatchDetails = [];
        
        $perfectDuplicates = [];

        foreach ($dbMatches as $dbRecord) {
            $scoreDetails = $this->calculateMatchScore(
                $fileData['nama'] ?? '',
                $dbRecord['nama'] ?? '',
                $fileData['unit_kerja'] ?? '',
                $dbRecord['unit_kerja'] ?? ''
            );

            if ($scoreDetails['total_score'] > $highestScore) {
                $highestScore = $scoreDetails['total_score'];
                $bestMatch = $dbRecord;
                $bestMatchDetails = $scoreDetails;
                $perfectDuplicates = [$dbRecord]; // Reset duplicates
            } elseif (abs($scoreDetails['total_score'] - $highestScore) < 0.1) {
                // Another record with the exact same high score
                $perfectDuplicates[] = $dbRecord;
            }
        }

        // If there are multiple identical high-score matches, it's a conflict
        if (count($perfectDuplicates) > 1 && $highestScore > 75) {
            return [
                'status' => 'KONFLIK',
                'action' => 'MANUAL',
                'target_id' => null,
                'confidence' => $highestScore,
                'message' => 'NIM sama dan kemiripan nama sangat tinggi dengan lebih dari 1 data di database.'
            ];
        }

        // If highest score is very good (e.g. name > 75% and unit > 60%, or overall high)
        if ($bestMatchDetails['name_similarity'] > 75 && $bestMatchDetails['unit_similarity'] > 60) {
            return [
                'status' => 'UPDATE AMAN',
                'action' => 'UPDATE',
                'target_id' => $bestMatch['id'] ?? null,
                'confidence' => $highestScore,
                'message' => 'Data ditemukan dan sangat mirip. Akan diperbarui secara aman.'
            ];
        }

        if ($bestMatchDetails['name_similarity'] < 50) {
            return [
                'status' => 'ERROR',
                'action' => 'SKIP',
                'target_id' => null, 
                'confidence' => $highestScore,
                'message' => 'NIM sudah terdaftar atas nama orang lain di sistem.'
            ];
        }

        // Middle ground, requires manual review
        return [
            'status' => 'WASPADA',
            'action' => 'MANUAL',
            'target_id' => $bestMatch['id'] ?? null,
            'confidence' => $highestScore,
            'message' => 'Data ditemukan tapi nama/unit sedikit berbeda. Harap tinjau manual.'
        ];
    }

    /**
     * Determine status when NIM is NOT found in the database.
     * We try to find a teacher with a matching name & unit who does NOT have a NIM yet.
     */
    public function determineStatusByName(array $potentialMatches, array $fileData): array
    {
        if (empty($potentialMatches)) {
            return [
                'status' => 'INSERT_BARU',
                'action' => 'INSERT',
                'target_id' => null,
                'confidence' => 0,
                'message' => 'NIM tidak ditemukan dan tidak ada nama yang cocok. Akan ditambahkan sebagai guru baru.'
            ];
        }

        $bestMatch = null;
        $highestScore = -1;
        $bestMatchDetails = [];

        foreach ($potentialMatches as $dbRecord) {
            $scoreDetails = $this->calculateMatchScore(
                $fileData['nama'] ?? '',
                $dbRecord['nama'] ?? '',
                $fileData['unit_kerja'] ?? '',
                $dbRecord['unit_kerja'] ?? ''
            );

            if ($scoreDetails['total_score'] > $highestScore) {
                $highestScore = $scoreDetails['total_score'];
                $bestMatch = $dbRecord;
                $bestMatchDetails = $scoreDetails;
            }
        }

        // If we found a very good match (Name > 80% and Unit > 60%)
        if ($bestMatchDetails['name_similarity'] > 80 && $bestMatchDetails['unit_similarity'] > 60) {
            return [
                'status' => 'UPDATE_AMAN',
                'action' => 'UPDATE',
                'target_id' => $bestMatch['id'] ?? null,
                'confidence' => $highestScore,
                'message' => 'NIM baru akan ditambahkan ke data guru yang sudah ada (berdasarkan kecocokan nama & unit).'
            ];
        }

        // Otherwise, no confident match, insert as new
        return [
            'status' => 'INSERT_BARU',
            'action' => 'INSERT',
            'target_id' => null,
            'confidence' => 0,
            'message' => 'NIM tidak ditemukan. Tidak ada nama yang cukup mirip, akan dibuat data baru.'
        ];
    }

    private function cleanStringForComparison(string $str): string
    {
        // 1. Lowercase
        $str = strtolower(trim($str));
        
        // 2. Remove titles/degrees separated by comma (e.g., "Moch. Taufiq, S.Pd" -> "Moch. Taufiq")
        if (str_contains($str, ',')) {
            $str = explode(',', $str)[0];
        }

        // 3. Remove punctuation
        $str = preg_replace('/[^a-z0-9 ]/', '', $str);

        // 4. Remove extra spaces
        $str = preg_replace('/\s+/', ' ', $str);

        // 5. Expand common abbreviations (Optional but helpful)
        $abbreviations = [
            'moch ' => 'mohammad ',
            'muh ' => 'muhammad ',
            'abd ' => 'abdul '
        ];
        foreach ($abbreviations as $abbr => $full) {
            if (str_starts_with($str . ' ', $abbr)) {
                $str = $full . substr($str, strlen($abbr) - 1);
            }
        }

        return trim($str);
    }
}
