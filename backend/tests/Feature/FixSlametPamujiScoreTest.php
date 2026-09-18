<?php

namespace Tests\Feature;

use App\Models\AnugerahRegistration;
use App\Models\Competition;
use App\Models\CompetitionJuryScore;
use App\Models\Event;
use App\Services\CompetitionRankingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FixSlametPamujiScoreTest extends TestCase
{
    use RefreshDatabase;

    public function test_slamet_pamuji_score_is_corrected_to_30_90_and_not_ranked(): void
    {
        $event = Event::create([
            'name'     => 'Harlah LP Ma\'arif 97',
            'slug'     => 'harlah-97-test-slamet',
            'category' => 'Anugerah',
            'date'     => '2026-09-19',
            'status'   => 'OPEN',
        ]);

        $guruComp = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Anugerah Guru Berprestasi',
            'category'   => 'Akademik',
            'type'       => 'Individual',
            'lomba_type' => 'guru_berprestasi',
            'status'     => 'OPEN',
            'scoring_criteria' => [
                ['component' => 'Prestasi', 'weight' => 40],
                ['component' => 'Naskah', 'weight' => 30],
                ['component' => 'Aswaja', 'weight' => 15],
                ['component' => 'Wawancara', 'weight' => 15],
            ],
        ]);

        // 3 Finalists
        $f1 = AnugerahRegistration::create([
            'event_id'       => $event->id,
            'competition_id' => $guruComp->id,
            'category'       => 'Guru',
            'jenjang'        => 'MI/SD',
            'applicant_name' => 'Apit Khadiah Yuliana, S.Pd.I',
            'school_name'    => 'MI Islamiyah Cinangsi',
            'status'         => 'finalis',
            'total_score'    => 61.12,
        ]);

        $f2 = AnugerahRegistration::create([
            'event_id'       => $event->id,
            'competition_id' => $guruComp->id,
            'category'       => 'Guru',
            'jenjang'        => 'MI/SD',
            'applicant_name' => 'IMROATUS SHOLIHAH, M.Pd.',
            'school_name'    => 'MI Darwata Glempang',
            'status'         => 'finalis',
            'total_score'    => 58.42,
        ]);

        $f3 = AnugerahRegistration::create([
            'event_id'       => $event->id,
            'competition_id' => $guruComp->id,
            'category'       => 'Guru',
            'jenjang'        => 'MI/SD',
            'applicant_name' => 'Neli Kurniawati, S.Pd.,M.Pd',
            'school_name'    => 'MI Ma\'arif 04 Gentasari',
            'status'         => 'finalis',
            'total_score'    => 57.78,
        ]);

        // Non-finalist with anomalous score 57.90: Slamet Pamuji
        $slamet = AnugerahRegistration::create([
            'event_id'       => $event->id,
            'competition_id' => $guruComp->id,
            'category'       => 'Guru',
            'jenjang'        => 'MI/SD',
            'applicant_name' => 'Slamet Pamuji, M.Pd.',
            'school_name'    => 'MI Ma\'arif Bojongsari',
            'status'         => 'submitted',
            'total_score'    => 57.90, // anomalous score
        ]);

        CompetitionJuryScore::create([
            'competition_id'           => $guruComp->id,
            'anugerah_registration_id' => $slamet->id,
            'jury_name'                => 'Dewan Juri 1',
            'score'                    => 57.90,
        ]);

        // Run autoRank
        CompetitionRankingService::autoRank($guruComp);

        $f1->refresh();
        $f2->refresh();
        $f3->refresh();
        $slamet->refresh();

        // Apit Khadiah = 1, Imroatus = 2, Neli = 3
        $this->assertEquals(1, $f1->rank);
        $this->assertEquals(2, $f2->rank);
        $this->assertEquals(3, $f3->rank);

        // Slamet Pamuji should be corrected to 30.90 and have NO rank (rank = null)
        $this->assertEquals(30.90, (float) $slamet->total_score);
        $this->assertNull($slamet->rank);
    }
}
