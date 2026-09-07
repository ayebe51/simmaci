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

        // Group by jenjang if present, otherwise single group
        $hasDistinctJenjang = $participants->pluck('jenjang')->filter()->unique()->count() > 1;
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
}
