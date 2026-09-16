<?php

namespace App\Services;

use App\Models\AnugerahRegistration;
use App\Models\Competition;
use App\Models\CompetitionParticipant;
use App\Models\CompetitionResult;
use Illuminate\Support\Facades\DB;

class CompetitionRankingService
{
    /**
     * Automatically calculate and assign ranks (Juara 1, 2, 3, Harapan 1, 2)
     * for all participants with scores in a competition based on score descending.
     * Groups by jenjang if the competition has multi-jenjang categories.
     *
     * @param Competition $competition
     * @return void
     */
    public static function autoRank(Competition $competition): void
    {
        $isAnugerah = in_array($competition->lomba_type, ['guru_berprestasi', 'madrasah_berprestasi']);

        if ($isAnugerah) {
            static::autoRankAnugerah($competition);
        } else {
            static::autoRankFestival($competition);
        }
    }

    /**
     * Auto-rank regular festival competition participants.
     */
    protected static function autoRankFestival(Competition $competition): void
    {
        $participants = CompetitionParticipant::where('competition_id', $competition->id)
            ->with('result')
            ->get();

        if ($participants->isEmpty()) {
            return;
        }

        // Group by jenjang if present, unless competition is a single overall pool (e.g. film_dokumenter)
        $isSinglePool = in_array($competition->lomba_type, ['film_dokumenter'], true);
        $hasDistinctJenjang = !$isSinglePool && $participants->pluck('jenjang')->filter()->unique()->count() > 1;
        $groups = $hasDistinctJenjang
            ? $participants->groupBy(fn ($p) => $p->jenjang ?: 'Umum')
            : collect(['all' => $participants]);

        DB::transaction(function () use ($groups) {
            foreach ($groups as $group) {
                // Sort participants with scores DESC, un-scored at the bottom
                $sorted = $group->sortByDesc(function ($p) {
                    return ($p->result && $p->result->score !== null) ? (float) $p->result->score : -1;
                });

                $rank = 0;
                $prevScore = null;

                foreach ($sorted as $p) {
                    $score = ($p->result && $p->result->score !== null) ? (float) $p->result->score : null;

                    if ($score === null || $score <= 0) {
                        if ($p->result && $p->result->rank !== null) {
                            $p->result->update(['rank' => null]);
                        }
                        continue;
                    }

                    // Dense ranking: equal scores share the same rank
                    if ($prevScore === null || abs($score - $prevScore) >= 0.001) {
                        $rank++;
                        $prevScore = $score;
                    }

                    $assignedRank = ($rank <= 5) ? $rank : null;

                    if ($p->result) {
                        if ($p->result->rank !== $assignedRank) {
                            $p->result->update(['rank' => $assignedRank]);
                        }
                    } else {
                        // Create result if none exists
                        CompetitionResult::create([
                            'competition_id' => $p->competition_id,
                            'participant_id' => $p->id,
                            'rank'           => $assignedRank,
                            'score'          => $score,
                        ]);
                    }
                }
            }
        });
    }

    /**
     * Auto-rank Anugerah Ma'arif registrations.
     */
    protected static function autoRankAnugerah(Competition $competition): void
    {
        $registrations = AnugerahRegistration::where('competition_id', $competition->id)->get();

        if ($registrations->isEmpty()) {
            return;
        }

        // Anugerah Guru/Madrasah is grouped by jenjang (MI/SD, MTs/SMP, MA/SMA/SMK)
        $hasDistinctJenjang = $registrations->pluck('jenjang')->filter()->unique()->count() > 1;
        $groups = $hasDistinctJenjang
            ? $registrations->groupBy(fn ($r) => $r->jenjang ?: 'Umum')
            : collect(['all' => $registrations]);

        DB::transaction(function () use ($groups) {
            foreach ($groups as $group) {
                $sorted = $group->sortByDesc(function ($r) {
                    return $r->total_score !== null ? (float) $r->total_score : -1;
                });

                $rank = 0;
                $prevScore = null;

                foreach ($sorted as $r) {
                    $score = $r->total_score !== null ? (float) $r->total_score : null;

                    if ($score === null || $score <= 0) {
                        if ($r->rank !== null) {
                            $r->update(['rank' => null]);
                        }
                        continue;
                    }

                    // Dense ranking: equal scores share the same rank
                    if ($prevScore === null || abs($score - $prevScore) >= 0.001) {
                        $rank++;
                        $prevScore = $score;
                    }

                    $assignedRank = ($rank <= 5) ? $rank : null;

                    if ($r->rank !== $assignedRank) {
                        $r->update(['rank' => $assignedRank]);
                    }
                }
            }
        });
    }

    /**
     * Detect if a jury entered raw component points (<= weight) instead of a 0-100 scale,
     * and normalize it back to 0-100 scale with real intended total score.
     */
    public static function detectAndNormalizeBreakdown(?array $breakdown, float $storedScore, array $competitionCriteria = []): ?array
    {
        if (empty($breakdown) || !is_array($breakdown)) {
            return null;
        }

        $criteriaWeightMap = [];
        foreach ($competitionCriteria as $c) {
            if (isset($c['component'], $c['weight'])) {
                $criteriaWeightMap[strtolower(trim($c['component']))] = (float) $c['weight'];
            }
        }

        $rawSum = 0.0;
        $allComponentsWithinWeight = true;
        $hasSignificantWeight = false;
        $componentCount = 0;

        foreach ($breakdown as $item) {
            if (!isset($item['component'])) {
                continue;
            }

            $compName = strtolower(trim($item['component']));
            $weight = isset($item['weight']) ? (float) $item['weight'] : ($criteriaWeightMap[$compName] ?? 0);
            $val = isset($item['value']) ? (float) $item['value'] : null;

            if ($val === null) {
                continue;
            }

            // If weight is not set, try partial word matching against criteria
            if ($weight <= 0) {
                foreach ($criteriaWeightMap as $cName => $w) {
                    if (str_contains($compName, $cName) || str_contains($cName, $compName)) {
                        $weight = $w;
                        break;
                    }
                    $firstWord = explode(' ', $compName)[0] ?? '';
                    if (strlen($firstWord) >= 3 && str_contains($cName, $firstWord)) {
                        $weight = $w;
                        break;
                    }
                }
            }

            // Keyword-based fallback for standard competition criteria
            if ($weight <= 0) {
                if (str_contains($compName, 'tajwid')) {
                    $weight = 45.0;
                } elseif (str_contains($compName, 'lagu') || str_contains($compName, 'irama')) {
                    $weight = 35.0;
                } elseif (str_contains($compName, 'adab') || str_contains($compName, 'penampilan') || str_contains($compName, 'fasohah') || str_contains($compName, 'fashahah')) {
                    $weight = 20.0;
                } elseif (str_contains($compName, 'vokal') || str_contains($compName, 'harmoni')) {
                    $weight = 35.0;
                } elseif (str_contains($compName, 'penjiwaan') || str_contains($compName, 'ekspresi')) {
                    $weight = 30.0;
                } elseif (str_contains($compName, 'makhraj') || str_contains($compName, 'artikulasi')) {
                    $weight = 35.0;
                } elseif (str_contains($compName, 'tema') || str_contains($compName, 'konten')) {
                    $weight = 35.0;
                } elseif (str_contains($compName, 'alur') || str_contains($compName, 'sinematografi') || str_contains($compName, 'editing')) {
                    $weight = 25.0;
                } elseif (str_contains($compName, 'kreativitas') || str_contains($compName, 'estetika') || str_contains($compName, 'aswaja') || str_contains($compName, 'wawancara')) {
                    $weight = 15.0;
                } elseif (str_contains($compName, 'prestasi') || str_contains($compName, 'kejuaraan')) {
                    $weight = 40.0;
                } elseif (str_contains($compName, 'naskah') || str_contains($compName, 'praktik')) {
                    $weight = 30.0;
                }
            }

            // Handle fraction weights (e.g. 0.45 -> 45)
            if ($weight > 0 && $weight <= 1.0) {
                $weight = $weight * 100.0;
            }

            $componentCount++;
            $rawSum += $val;

            if ($weight <= 0) {
                $allComponentsWithinWeight = false;
                break;
            }

            // Anomaly check: value is within the component weight (+1.0 tolerance for slight overage)
            if ($val > ($weight + 1.0)) {
                $allComponentsWithinWeight = false;
                break;
            }

            if ($weight <= 50) {
                $hasSignificantWeight = true;
            }
        }

        // Conditions for raw points anomaly:
        // 1. At least 2 components evaluated
        // 2. All component values <= weight + 1.0 (e.g. 35 <= 45, 26 <= 35, 12 <= 20)
        // 3. At least one component has weight <= 50
        // 4. Raw sum of component values >= 35.0 (indicates intended real score, e.g. 70-95)
        // 5. Stored/calculated score is <= 45.0 (because re-multiplying by weight fractions scaled it down)
        if ($componentCount >= 2 && $allComponentsWithinWeight && $hasSignificantWeight && $rawSum >= 35.0 && $storedScore <= 45.0) {
            $normalizedBreakdown = [];
            $realTotal = 0.0;

            foreach ($breakdown as $item) {
                $compName = strtolower(trim($item['component'] ?? ''));
                $weight = isset($item['weight']) ? (float) $item['weight'] : ($criteriaWeightMap[$compName] ?? 0);
                if ($weight <= 0) {
                    foreach ($criteriaWeightMap as $cName => $w) {
                        if (str_contains($compName, $cName) || str_contains($cName, $compName)) {
                            $weight = $w;
                            break;
                        }
                        $firstWord = explode(' ', $compName)[0] ?? '';
                        if (strlen($firstWord) >= 3 && str_contains($cName, $firstWord)) {
                            $weight = $w;
                            break;
                        }
                    }
                }
                if ($weight <= 0) {
                    if (str_contains($compName, 'tajwid')) {
                        $weight = 45.0;
                    } elseif (str_contains($compName, 'lagu') || str_contains($compName, 'irama')) {
                        $weight = 35.0;
                    } elseif (str_contains($compName, 'adab') || str_contains($compName, 'penampilan') || str_contains($compName, 'fasohah') || str_contains($compName, 'fashahah')) {
                        $weight = 20.0;
                    } elseif (str_contains($compName, 'vokal') || str_contains($compName, 'harmoni')) {
                        $weight = 35.0;
                    } elseif (str_contains($compName, 'penjiwaan') || str_contains($compName, 'ekspresi')) {
                        $weight = 30.0;
                    } elseif (str_contains($compName, 'makhraj') || str_contains($compName, 'artikulasi')) {
                        $weight = 35.0;
                    } elseif (str_contains($compName, 'tema') || str_contains($compName, 'konten')) {
                        $weight = 35.0;
                    } elseif (str_contains($compName, 'alur') || str_contains($compName, 'sinematografi') || str_contains($compName, 'editing')) {
                        $weight = 25.0;
                    } elseif (str_contains($compName, 'kreativitas') || str_contains($compName, 'estetika') || str_contains($compName, 'aswaja') || str_contains($compName, 'wawancara')) {
                        $weight = 15.0;
                    } elseif (str_contains($compName, 'prestasi') || str_contains($compName, 'kejuaraan')) {
                        $weight = 40.0;
                    } elseif (str_contains($compName, 'naskah') || str_contains($compName, 'praktik')) {
                        $weight = 30.0;
                    }
                }
                if ($weight > 0 && $weight <= 1.0) {
                    $weight = $weight * 100.0;
                }

                $val = isset($item['value']) ? (float) $item['value'] : 0.0;

                if ($weight > 0) {
                    $normVal = round(($val / $weight) * 100.0, 2);
                    $item['value'] = $normVal;
                    $item['weight'] = $weight;
                    $realTotal += $val;
                }

                $normalizedBreakdown[] = $item;
            }



            return [
                'normalized_breakdown' => $normalizedBreakdown,
                'real_score'           => round($realTotal, 2),
            ];
        }

        return null;
    }
}

