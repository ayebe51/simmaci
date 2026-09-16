<?php

namespace Tests\Feature;

use App\Models\AnugerahRegistration;
use App\Models\Competition;
use App\Models\CompetitionJuryScore;
use App\Models\CompetitionParticipant;
use App\Models\CompetitionResult;
use App\Models\Event;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MultiJuryScoringTest extends TestCase
{
    use RefreshDatabase;

    public function test_multi_jury_scores_are_saved_independently_and_averaged_for_festival(): void
    {
        $event = Event::create([
            'name'     => 'Festival Aswaja 2026',
            'slug'     => 'festival-aswaja-multi-jury-2026',
            'category' => 'Festival',
            'date'     => '2026-09-19',
            'location' => 'Cilacap',
            'status'   => 'OPEN',
        ]);
        \App\Models\Setting::setValue("jury_pin_event_{$event->id}", 'maarif2026');

        $competition = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Paduan Suara Mars Ma\'arif',
            'category'   => 'Seni Budaya',
            'type'       => 'Group',
            'lomba_type' => 'mars_maarif',
            'status'     => 'OPEN',
        ]);

        $timA = CompetitionParticipant::create([
            'competition_id' => $competition->id,
            'name'           => 'Tim Padus A',
            'institution'    => 'MI Ma\'arif 01',
        ]);
        $timB = CompetitionParticipant::create([
            'competition_id' => $competition->id,
            'name'           => 'Tim Padus B',
            'institution'    => 'MI Ma\'arif 02',
        ]);

        // Juri 1: Kyai Ridwan login with PIN
        $loginRes1 = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'maarif2026',
            'jury_name'      => 'Kyai Ridwan',
        ]);
        $loginRes1->assertStatus(200);
        $token1 = $loginRes1->json('data.token');
        $this->assertEquals('Kyai Ridwan', $loginRes1->json('data.jury_name'));

        // Juri 2: Drs. Ahmad login with PIN
        $loginRes2 = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'maarif2026',
            'jury_name'      => 'Drs. Ahmad',
        ]);
        $loginRes2->assertStatus(200);
        $token2 = $loginRes2->json('data.token');
        $this->assertEquals('Drs. Ahmad', $loginRes2->json('data.jury_name'));

        // Kyai Ridwan scores Tim A = 80 (tested with integer participant_id), Tim B = 90 (tested with string participant_id)
        $this->postJson("/api/public/jury/{$token1}/score", [
            'participant_id' => $timA->id, // Raw integer
            'score'          => 80.0,
            'notes'          => 'Vokal harmonis',
        ])->assertStatus(200);

        $this->postJson("/api/public/jury/{$token1}/score", [
            'participant_id' => (string) $timB->id, // String
            'score'          => 90.0,
            'notes'          => 'Sangat baik',
        ])->assertStatus(200);

        // Drs. Ahmad scores Tim A = 90 (integer), Tim B = 94 (string)
        $this->postJson("/api/public/jury/{$token2}/score", [
            'participant_id' => $timA->id, // Raw integer
            'score'          => 90.0,
            'notes'          => 'Artikulasi mantap',
        ])->assertStatus(200);

        $this->postJson("/api/public/jury/{$token2}/score", [
            'participant_id' => (string) $timB->id, // String
            'score'          => 94.0,
            'notes'          => 'Luar biasa',
        ])->assertStatus(200);

        // 1. Verify competition_jury_scores records are preserved independently
        $this->assertDatabaseHas('competition_jury_scores', [
            'competition_id' => $competition->id,
            'participant_id' => $timA->id,
            'jury_name'      => 'Kyai Ridwan',
            'score'          => 80.00,
        ]);
        $this->assertDatabaseHas('competition_jury_scores', [
            'competition_id' => $competition->id,
            'participant_id' => $timA->id,
            'jury_name'      => 'Drs. Ahmad',
            'score'          => 90.00,
        ]);
        $this->assertDatabaseHas('competition_jury_scores', [
            'competition_id' => $competition->id,
            'participant_id' => $timB->id,
            'jury_name'      => 'Kyai Ridwan',
            'score'          => 90.00,
        ]);
        $this->assertDatabaseHas('competition_jury_scores', [
            'competition_id' => $competition->id,
            'participant_id' => $timB->id,
            'jury_name'      => 'Drs. Ahmad',
            'score'          => 94.00,
        ]);

        // 2. Verify competition_results has aggregated average:
        // Tim A: (80 + 90) / 2 = 85.00 -> Rank 2
        // Tim B: (90 + 94) / 2 = 92.00 -> Rank 1
        $this->assertDatabaseHas('competition_results', [
            'participant_id' => $timB->id,
            'score'          => 92.00,
            'rank'           => 1,
        ]);
        $this->assertDatabaseHas('competition_results', [
            'participant_id' => $timA->id,
            'score'          => 85.00,
            'rank'           => 2,
        ]);
    }

    public function test_multi_jury_scoring_for_anugerah_maarif(): void
    {
        $event = Event::create([
            'name'     => 'Anugerah Ma\'arif 2026',
            'slug'     => 'anugerah-maarif-multi-jury-2026',
            'category' => 'Anugerah',
            'date'     => '2026-09-19',
            'location' => 'Cilacap',
            'status'   => 'OPEN',
        ]);
        \App\Models\Setting::setValue("jury_pin_event_{$event->id}", 'maarif2026');

        $competition = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Guru Berprestasi',
            'category'   => 'Anugerah',
            'type'       => 'Individual',
            'lomba_type' => 'guru_berprestasi',
            'status'     => 'OPEN',
        ]);

        $g1 = AnugerahRegistration::create([
            'event_id'        => $event->id,
            'competition_id'  => $competition->id,
            'registration_no' => 'REG-GURU-01',
            'category'        => 'guru',
            'jenjang'         => 'MI/SD',
            'applicant_name'  => 'Ustadz Zaid',
            'school_name'     => 'MI Ma\'arif 01',
            'status'          => 'submitted',
        ]);

        $g2 = AnugerahRegistration::create([
            'event_id'        => $event->id,
            'competition_id'  => $competition->id,
            'registration_no' => 'REG-GURU-02',
            'category'        => 'guru',
            'jenjang'         => 'MI/SD',
            'applicant_name'  => 'Ustadzah Fatimah',
            'school_name'     => 'MI Ma\'arif 02',
            'status'          => 'submitted',
        ]);

        // Juri 1: Prof. Subhan
        $login1 = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'maarif2026',
            'jury_name'      => 'Prof. Subhan',
        ]);
        $token1 = $login1->json('data.token');

        // Juri 2: Dr. Fatimah
        $login2 = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'maarif2026',
            'jury_name'      => 'Dr. Fatimah',
        ]);
        $token2 = $login2->json('data.token');

        // Prof. Subhan scores: G1 = 88.50, G2 = 91.00
        $this->postJson("/api/public/jury/{$token1}/score", [
            'participant_id' => "reg_{$g1->id}",
            'score'          => 88.50,
        ])->assertStatus(200);

        $this->postJson("/api/public/jury/{$token1}/score", [
            'participant_id' => "reg_{$g2->id}",
            'score'          => 91.00,
        ])->assertStatus(200);

        // Dr. Fatimah scores: G1 = 92.50, G2 = 85.00
        $this->postJson("/api/public/jury/{$token2}/score", [
            'participant_id' => "reg_{$g1->id}",
            'score'          => 92.50,
        ])->assertStatus(200);

        $this->postJson("/api/public/jury/{$token2}/score", [
            'participant_id' => "reg_{$g2->id}",
            'score'          => 85.00,
        ])->assertStatus(200);

        // Verify Anugerah averages:
        // G1: (88.50 + 92.50) / 2 = 90.50 -> Rank 1
        // G2: (91.00 + 85.00) / 2 = 88.00 -> Rank 2
        $g1->refresh();
        $g2->refresh();

        $this->assertEquals(90.50, (float) $g1->total_score);
        $this->assertEquals(1, $g1->rank);

        $this->assertEquals(88.00, (float) $g2->total_score);
        $this->assertEquals(2, $g2->rank);
    }

    public function test_jury_participants_loads_specific_jurys_own_scores(): void
    {
        $event = Event::create([
            'name'     => 'Festival Aswaja 2026',
            'slug'     => 'festival-aswaja-check-2026',
            'category' => 'Festival',
            'date'     => '2026-09-19',
            'location' => 'Cilacap',
            'status'   => 'OPEN',
        ]);
        \App\Models\Setting::setValue("jury_pin_event_{$event->id}", 'maarif2026');

        $competition = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'MTQ',
            'category'   => 'Keagamaan',
            'type'       => 'Individual',
            'lomba_type' => 'mtq',
            'status'     => 'OPEN',
        ]);

        $part = CompetitionParticipant::create([
            'competition_id' => $competition->id,
            'name'           => 'Ahmad Santri',
            'institution'    => 'MTs Ma\'arif 01',
        ]);

        // Juri 1: Kyai Ridwan
        $t1 = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'maarif2026',
            'jury_name'      => 'Kyai Ridwan',
        ])->json('data.token');

        // Juri 2: Drs. Ahmad
        $t2 = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'maarif2026',
            'jury_name'      => 'Drs. Ahmad',
        ])->json('data.token');

        // Kyai Ridwan scores 82.50
        $this->postJson("/api/public/jury/{$t1}/score", [
            'participant_id' => (string) $part->id,
            'score'          => 82.50,
            'notes'          => 'Catatan Kyai Ridwan',
        ]);

        // Drs. Ahmad scores 94.00
        $this->postJson("/api/public/jury/{$t2}/score", [
            'participant_id' => (string) $part->id,
            'score'          => 94.00,
            'notes'          => 'Catatan Drs. Ahmad',
        ]);

        // Kyai Ridwan requests participants:
        // Must see his OWN score (82.50), not Drs. Ahmad's score (94.00)
        $res1 = $this->getJson("/api/public/jury/{$t1}/participants");
        $res1->assertStatus(200);

        $partData1 = $res1->json('data.participants.0.result');
        $this->assertEquals(82.50, (float) $partData1['score']);
        $this->assertEquals('Catatan Kyai Ridwan', $partData1['notes']);
        $this->assertTrue($partData1['is_scored_by_me']);
        $this->assertEquals(2, $partData1['juries_count']);
        $this->assertEquals(88.25, (float) $partData1['final_score']); // (82.50 + 94.00) / 2

        // Drs. Ahmad requests participants:
        // Must see his OWN score (94.00)
        $res2 = $this->getJson("/api/public/jury/{$t2}/participants");
        $res2->assertStatus(200);

        $partData2 = $res2->json('data.participants.0.result');
        $this->assertEquals(94.00, (float) $partData2['score']);
        $this->assertEquals('Catatan Drs. Ahmad', $partData2['notes']);
        $this->assertTrue($partData2['is_scored_by_me']);
        $this->assertEquals(2, $partData2['juries_count']);
        $this->assertEquals(88.25, (float) $partData2['final_score']);
    }

    public function test_jury_verify_pin_fails_when_pin_not_configured_for_event(): void
    {
        $event = Event::create([
            'name'     => 'Event Without PIN',
            'slug'     => 'event-without-pin-2026',
            'category' => 'Festival',
            'date'     => '2026-09-19',
            'location' => 'Cilacap',
            'status'   => 'OPEN',
        ]);

        $competition = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Kaligrafi',
            'category'   => 'Seni Budaya',
            'type'       => 'Individual',
            'lomba_type' => 'kaligrafi',
            'status'     => 'OPEN',
        ]);

        $res = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'maarif2026',
            'jury_name'      => 'Juri Tester',
        ]);

        $res->assertStatus(422);
        $this->assertStringContainsString('PIN juri belum dikonfigurasi', $res->json('message'));
    }

    public function test_film_dokumenter_is_ranked_in_single_pool_across_all_jenjang(): void
    {
        $event = Event::create([
            'name'     => 'Festival Aswaja 2026',
            'slug'     => 'festival-film-dokumenter-2026',
            'category' => 'Festival',
            'date'     => '2026-09-19',
            'location' => 'Cilacap',
            'status'   => 'OPEN',
        ]);

        $competition = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Film Pendek Dokumenter',
            'category'   => 'Karya Ilmiah & Seni',
            'type'       => 'Group',
            'lomba_type' => 'film_dokumenter',
            'status'     => 'OPEN',
        ]);

        $p1 = CompetitionParticipant::create([
            'competition_id' => $competition->id,
            'name'           => 'Film Tim SMA',
            'institution'    => 'MA Ma\'arif 01',
            'jenjang'        => 'SMA/MA/SMK',
        ]);
        $p2 = CompetitionParticipant::create([
            'competition_id' => $competition->id,
            'name'           => 'Film Tim SMP',
            'institution'    => 'MTs Ma\'arif 01',
            'jenjang'        => 'SMP/MTs',
        ]);
        $p3 = CompetitionParticipant::create([
            'competition_id' => $competition->id,
            'name'           => 'Film Tim SD',
            'institution'    => 'MI Ma\'arif 01',
            'jenjang'        => 'MI/SD',
        ]);

        // Create results with different scores: p2 (92) > p1 (88) > p3 (80)
        CompetitionResult::create([
            'competition_id' => $competition->id,
            'participant_id' => $p1->id,
            'score'          => 88.00,
        ]);
        CompetitionResult::create([
            'competition_id' => $competition->id,
            'participant_id' => $p2->id,
            'score'          => 92.00,
        ]);
        CompetitionResult::create([
            'competition_id' => $competition->id,
            'participant_id' => $p3->id,
            'score'          => 80.00,
        ]);

        \App\Services\CompetitionRankingService::autoRank($competition);

        // Verify ranks:
        // Rank 1: p2 (92.00) - SMP/MTs
        // Rank 2: p1 (88.00) - SMA/MA/SMK
        // Rank 3: p3 (80.00) - MI/SD
        // Ranks must NOT reset per jenjang!
        $this->assertDatabaseHas('competition_results', [
            'participant_id' => $p2->id,
            'rank'           => 1,
        ]);
        $this->assertDatabaseHas('competition_results', [
            'participant_id' => $p1->id,
            'rank'           => 2,
        ]);
        $this->assertDatabaseHas('competition_results', [
            'participant_id' => $p3->id,
            'rank'           => 3,
        ]);
    }

    public function test_recalculate_scores_command_normalizes_mtq_and_reaggregates(): void
    {
        $event = Event::create([
            'name'     => 'Festival MTQ 2026',
            'slug'     => 'festival-mtq-recalc-2026',
            'category' => 'Festival',
            'date'     => '2026-09-19',
            'location' => 'Cilacap',
            'status'   => 'OPEN',
        ]);

        $competition = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Musabaqah Tilawatil Qur\'an',
            'category'   => 'Keagamaan',
            'type'       => 'Individual',
            'lomba_type' => 'mtq',
            'status'     => 'OPEN',
        ]);

        $part = CompetitionParticipant::create([
            'competition_id' => $competition->id,
            'name'           => 'Qari Ahmad',
            'institution'    => 'MTs Ma\'arif 01',
            'jenjang'        => 'SMP/MTs',
        ]);

        // Juri 1 (Kyai Ridwan): input 0-100 scale correctly
        CompetitionJuryScore::create([
            'competition_id'  => $competition->id,
            'participant_id'  => $part->id,
            'jury_name'       => 'Kyai Ridwan',
            'score'           => 75.00,
            'score_breakdown' => [
                ['component' => 'Tajwid', 'weight' => 0.45, 'value' => 75.0],
                ['component' => 'Lagu & Irama', 'weight' => 0.35, 'value' => 75.0],
                ['component' => 'Adab & Fashahah', 'weight' => 0.20, 'value' => 75.0],
            ],
        ]);

        // Juri 2 (Zen Muzaki): input raw component points (35/45, 26/35, 12/20) which resulted in 27.25
        CompetitionJuryScore::create([
            'competition_id'  => $competition->id,
            'participant_id'  => $part->id,
            'jury_name'       => 'Zen Muzaki',
            'score'           => 27.25,
            'score_breakdown' => [
                ['component' => 'Tajwid', 'weight' => 0.45, 'value' => 35.0],
                ['component' => 'Lagu & Irama', 'weight' => 0.35, 'value' => 26.0],
                ['component' => 'Adab & Fashahah', 'weight' => 0.20, 'value' => 12.0],
            ],
        ]);

        // Run artisan command with --normalize
        $this->artisan("competition:recalculate-scores {$competition->id} --normalize")
            ->assertExitCode(0);

        // Verify Zen Muzaki's score was normalized to 73.00
        $zenScore = CompetitionJuryScore::where('competition_id', $competition->id)
            ->where('jury_name', 'Zen Muzaki')
            ->first();

        $this->assertNotNull($zenScore);
        $this->assertEquals(73.00, (float) $zenScore->score);

        // Verify competition_results has average: (75.00 + 73.00) / 2 = 74.00
        $result = CompetitionResult::where('competition_id', $competition->id)
            ->where('participant_id', $part->id)
            ->first();

        $this->assertNotNull($result);
        $this->assertEquals(74.00, (float) $result->score);
        $this->assertEquals(1, $result->rank);
    }
}

