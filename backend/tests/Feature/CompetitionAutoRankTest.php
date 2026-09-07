<?php

namespace Tests\Feature;

use App\Models\AnugerahRegistration;
use App\Models\Competition;
use App\Models\CompetitionParticipant;
use App\Models\CompetitionResult;
use App\Models\Event;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class CompetitionAutoRankTest extends TestCase
{
    use RefreshDatabase;

    private function createJuryToken(int $competitionId): string
    {
        $token = bin2hex(random_bytes(20));
        Cache::put("jury_token_{$token}", $competitionId, now()->addHours(1));
        return $token;
    }

    public function test_auto_rank_assigns_correct_ranks_to_festival_aswaja_participants(): void
    {
        $event = Event::create([
            'name'     => 'Festival Aswaja 2026',
            'slug'     => 'festival-aswaja-2026',
            'category' => 'Festival',
            'date'     => '2026-09-19',
            'location' => 'Cilacap',
            'status'   => 'OPEN',
        ]);

        $competition = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Mars Ma\'arif NU',
            'category'   => 'Seni Budaya',
            'type'       => 'Group',
            'lomba_type' => 'mars_maarif',
            'status'     => 'OPEN',
        ]);

        $p1 = CompetitionParticipant::create([
            'competition_id' => $competition->id,
            'name'           => 'Tim A',
            'institution'    => 'MI Ma\'arif 01',
        ]);
        $p2 = CompetitionParticipant::create([
            'competition_id' => $competition->id,
            'name'           => 'Tim B',
            'institution'    => 'MI Ma\'arif 02',
        ]);
        $p3 = CompetitionParticipant::create([
            'competition_id' => $competition->id,
            'name'           => 'Tim C',
            'institution'    => 'MI Ma\'arif 03',
        ]);

        $token = $this->createJuryToken($competition->id);

        // Score p1 = 78.5
        $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id' => (string) $p1->id,
            'score'          => 78.5,
            'notes'          => 'Cukup baik',
        ])->assertStatus(200);

        // Score p2 = 92.0
        $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id' => (string) $p2->id,
            'score'          => 92.0,
            'notes'          => 'Sangat memukau',
        ])->assertStatus(200);

        // Score p3 = 85.0
        $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id' => (string) $p3->id,
            'score'          => 85.0,
            'notes'          => 'Bagus',
        ])->assertStatus(200);

        // Verify automatic ranks:
        // p2 (92.0) -> rank 1
        // p3 (85.0) -> rank 2
        // p1 (78.5) -> rank 3
        $this->assertDatabaseHas('competition_results', [
            'participant_id' => $p2->id,
            'rank'           => 1,
            'score'          => 92.0,
        ]);
        $this->assertDatabaseHas('competition_results', [
            'participant_id' => $p3->id,
            'rank'           => 2,
            'score'          => 85.0,
        ]);
        $this->assertDatabaseHas('competition_results', [
            'participant_id' => $p1->id,
            'rank'           => 3,
            'score'          => 78.5,
        ]);
    }

    public function test_auto_rank_groups_by_jenjang_for_multi_jenjang_competition(): void
    {
        $event = Event::create([
            'name'     => 'Festival Aswaja 2026',
            'slug'     => 'festival-aswaja-jenjang-2026',
            'category' => 'Festival',
            'date'     => '2026-09-19',
            'location' => 'Cilacap',
            'status'   => 'OPEN',
        ]);

        $competition = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'MTQ Pelajar',
            'category'   => 'Keagamaan',
            'type'       => 'Individual',
            'jenjang'    => 'MI/SD, MTs/SMP',
            'lomba_type' => 'mtq',
            'status'     => 'OPEN',
        ]);

        $mi1 = CompetitionParticipant::create([
            'competition_id' => $competition->id,
            'name'           => 'Siswa MI 1',
            'jenjang'        => 'MI/SD',
            'institution'    => 'MI Ma\'arif 01',
        ]);
        $mi2 = CompetitionParticipant::create([
            'competition_id' => $competition->id,
            'name'           => 'Siswa MI 2',
            'jenjang'        => 'MI/SD',
            'institution'    => 'MI Ma\'arif 02',
        ]);

        $mts1 = CompetitionParticipant::create([
            'competition_id' => $competition->id,
            'name'           => 'Siswa MTs 1',
            'jenjang'        => 'MTs/SMP',
            'institution'    => 'MTs Ma\'arif 01',
        ]);
        $mts2 = CompetitionParticipant::create([
            'competition_id' => $competition->id,
            'name'           => 'Siswa MTs 2',
            'jenjang'        => 'MTs/SMP',
            'institution'    => 'MTs Ma\'arif 02',
        ]);

        $token = $this->createJuryToken($competition->id);

        // MI: mi1 = 82, mi2 = 91 -> mi2 is rank 1, mi1 is rank 2
        $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id' => (string) $mi1->id,
            'score'          => 82.0,
        ])->assertStatus(200);

        $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id' => (string) $mi2->id,
            'score'          => 91.0,
        ])->assertStatus(200);

        // MTs: mts1 = 88, mts2 = 79 -> mts1 is rank 1, mts2 is rank 2
        $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id' => (string) $mts1->id,
            'score'          => 88.0,
        ])->assertStatus(200);

        $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id' => (string) $mts2->id,
            'score'          => 79.0,
        ])->assertStatus(200);

        $this->assertDatabaseHas('competition_results', ['participant_id' => $mi2->id, 'rank' => 1]);
        $this->assertDatabaseHas('competition_results', ['participant_id' => $mi1->id, 'rank' => 2]);
        $this->assertDatabaseHas('competition_results', ['participant_id' => $mts1->id, 'rank' => 1]);
        $this->assertDatabaseHas('competition_results', ['participant_id' => $mts2->id, 'rank' => 2]);
    }

    public function test_anugerah_maarif_saves_decimal_scores_and_auto_ranks(): void
    {
        $event = Event::create([
            'name'     => 'Anugerah Ma\'arif Award 2026',
            'slug'     => 'anugerah-maarif-2026',
            'category' => 'Anugerah',
            'date'     => '2026-09-19',
            'location' => 'Cilacap',
            'status'   => 'OPEN',
        ]);

        $competition = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Guru Berprestasi',
            'category'   => 'Anugerah',
            'type'       => 'Individual',
            'lomba_type' => 'guru_berprestasi',
            'status'     => 'OPEN',
        ]);

        $reg1 = AnugerahRegistration::create([
            'event_id'        => $event->id,
            'competition_id'  => $competition->id,
            'registration_no' => 'REG-ANUGERAH-001',
            'category'        => 'guru',
            'jenjang'         => 'MI/SD',
            'applicant_name'  => 'Ustadz Zaid',
            'school_name'     => 'MI Ma\'arif 01',
            'status'          => 'submitted',
        ]);

        $reg2 = AnugerahRegistration::create([
            'event_id'        => $event->id,
            'competition_id'  => $competition->id,
            'registration_no' => 'REG-ANUGERAH-002',
            'category'        => 'guru',
            'jenjang'         => 'MI/SD',
            'applicant_name'  => 'Ustadzah Fatimah',
            'school_name'     => 'MTs Ma\'arif 02',
            'status'          => 'submitted',
        ]);

        $reg3 = AnugerahRegistration::create([
            'event_id'        => $event->id,
            'competition_id'  => $competition->id,
            'registration_no' => 'REG-ANUGERAH-003',
            'category'        => 'guru',
            'jenjang'         => 'MI/SD',
            'applicant_name'  => 'Ustadz Umar',
            'school_name'     => 'MA Ma\'arif 03',
            'status'          => 'submitted',
        ]);

        $token = $this->createJuryToken($competition->id);

        // Post decimal scores with score breakdown
        $res1 = $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id'  => "reg_{$reg1->id}",
            'score'           => 86.75,
            'notes'           => 'Portofolio lengkap, esai bagus',
            'score_breakdown' => [
                ['component' => 'Portofolio', 'weight' => 40, 'value' => 85.0],
                ['component' => 'Wawancara', 'weight' => 60, 'value' => 87.91],
            ],
        ]);
        $res1->assertStatus(200);

        $res2 = $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id'  => "reg_{$reg2->id}",
            'score'           => 94.25,
            'notes'           => 'Luar biasa inspiratif',
        ]);
        $res2->assertStatus(200);

        $res3 = $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id'  => "reg_{$reg3->id}",
            'score'           => 81.50,
            'notes'           => 'Baik',
        ]);
        $res3->assertStatus(200);

        // Verify ranks and decimal score in DB
        $reg2->refresh();
        $this->assertEquals(1, $reg2->rank);
        $this->assertEquals(94.25, (float) $reg2->total_score);

        $reg1->refresh();
        $this->assertEquals(2, $reg1->rank);
        $this->assertEquals(86.75, (float) $reg1->total_score);
        $this->assertIsArray($reg1->score_breakdown);

        $reg3->refresh();
        $this->assertEquals(3, $reg3->rank);
        $this->assertEquals(81.50, (float) $reg3->total_score);
    }

    public function test_medal_tally_aggregates_both_festival_and_anugerah_medals(): void
    {
        $event = Event::create([
            'name'     => 'Harlah LP Ma\'arif NU 2026',
            'slug'     => 'harlah-lp-maarif-2026',
            'category' => 'Festival & Anugerah',
            'date'     => '2026-09-19',
            'location' => 'Cilacap',
            'status'   => 'OPEN',
        ]);

        // Competition 1: Festival
        $compFestival = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Paduan Suara Mars Ma\'arif',
            'category'   => 'Seni',
            'type'       => 'Group',
            'lomba_type' => 'mars_maarif',
            'status'     => 'OPEN',
        ]);

        $part1 = CompetitionParticipant::create([
            'competition_id' => $compFestival->id,
            'name'           => 'Padus MI 01',
            'institution'    => 'MI Ma\'arif 01 Kesugihan',
        ]);
        $part2 = CompetitionParticipant::create([
            'competition_id' => $compFestival->id,
            'name'           => 'Padus MI 02',
            'institution'    => 'MI Ma\'arif 02 Kroya',
        ]);

        CompetitionResult::create([
            'competition_id' => $compFestival->id,
            'participant_id' => $part1->id,
            'score'          => 95.0,
            'rank'           => 1, // Gold
        ]);
        CompetitionResult::create([
            'competition_id' => $compFestival->id,
            'participant_id' => $part2->id,
            'score'          => 88.0,
            'rank'           => 2, // Silver
        ]);

        // Competition 2: Anugerah
        $compAnugerah = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Madrasah Unggul Berprestasi',
            'category'   => 'Anugerah',
            'type'       => 'Group',
            'lomba_type' => 'madrasah_berprestasi',
            'status'     => 'OPEN',
        ]);

        AnugerahRegistration::create([
            'event_id'        => $event->id,
            'competition_id'  => $compAnugerah->id,
            'registration_no' => 'REG-ANUG-MADRASAH-01',
            'category'        => 'madrasah',
            'jenjang'         => 'MI/SD',
            'applicant_name'  => 'Kepala MI Kesugihan',
            'school_name'     => 'MI Ma\'arif 01 Kesugihan',
            'status'          => 'winner',
            'total_score'     => 98.50,
            'rank'            => 1, // Another Gold for MI 01 Kesugihan!
        ]);

        AnugerahRegistration::create([
            'event_id'        => $event->id,
            'competition_id'  => $compAnugerah->id,
            'registration_no' => 'REG-ANUG-MADRASAH-02',
            'category'        => 'madrasah',
            'jenjang'         => 'MTs/SMP',
            'applicant_name'  => 'Kepala MTs Kroya',
            'school_name'     => 'MTs Ma\'arif 01 Majenang',
            'status'          => 'winner',
            'total_score'     => 90.00,
            'rank'            => 3, // Bronze for MTs 01 Majenang
        ]);

        // Authenticate admin
        $admin = \App\Models\User::factory()->create(['role' => 'super_admin']);

        // Request tally
        $response = $this->actingAs($admin)->getJson("/api/events/{$event->id}/tally");
        $response->assertStatus(200);

        $tally = $response->json('data');

        // MI Ma'arif 01 Kesugihan should be 1st with 2 Golds
        $this->assertEquals('MI Ma\'arif 01 Kesugihan', $tally[0]['institution']);
        $this->assertEquals(2, $tally[0]['gold']);
        $this->assertEquals(0, $tally[0]['silver']);
        $this->assertEquals(0, $tally[0]['bronze']);
        $this->assertEquals(2, $tally[0]['total']);

        // MI Ma'arif 02 Kroya should have 1 Silver
        $kroya = collect($tally)->firstWhere('institution', 'MI Ma\'arif 02 Kroya');
        $this->assertNotNull($kroya);
        $this->assertEquals(0, $kroya['gold']);
        $this->assertEquals(1, $kroya['silver']);
        $this->assertEquals(0, $kroya['bronze']);

        // MTs Ma'arif 01 Majenang should have 1 Bronze
        $majenang = collect($tally)->firstWhere('institution', 'MTs Ma\'arif 01 Majenang');
        $this->assertNotNull($majenang);
        $this->assertEquals(0, $majenang['gold']);
        $this->assertEquals(0, $majenang['silver']);
        $this->assertEquals(1, $majenang['bronze']);
    }
}
