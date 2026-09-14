<?php

namespace Tests\Feature;

use App\Models\AnugerahRegistration;
use App\Models\Competition;
use App\Models\CompetitionJuryScore;
use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TwoPhaseAnugerahScoringTest extends TestCase
{
    use RefreshDatabase;

    public function test_smart_jury_name_matching_and_existing_juries(): void
    {
        $event = Event::create([
            'name'     => 'Harlah LP Ma\'arif 97',
            'slug'     => 'harlah-97-smart-jury',
            'category' => 'Anugerah',
            'date'     => '2026-09-19',
            'status'   => 'OPEN',
        ]);
        \App\Models\Setting::setValue("jury_pin_event_{$event->id}", 'pin123');

        $competition = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Anugerah Guru Berprestasi',
            'category'   => 'Akademik',
            'type'       => 'Individual',
            'lomba_type' => 'guru_berprestasi',
            'status'     => 'OPEN',
            'scoring_criteria' => [
                ['component' => 'Akumulasi Skor Kejuaraan / Prestasi', 'weight' => 40],
                ['component' => 'Naskah Praktik Baik / Karya Inovasi Pembelajaran', 'weight' => 30],
                ['component' => 'Pemahaman & Pengamalan Nilai Aswaja An-Nahdliyah', 'weight' => 15],
                ['component' => 'Presentasi, Wawancara, & Deep Interview', 'weight' => 15],
            ],
        ]);

        $reg = AnugerahRegistration::create([
            'event_id'       => $event->id,
            'competition_id' => $competition->id,
            'category'       => 'Guru',
            'applicant_name' => 'Ahmad Fauzi, S.Pd',
            'school_name'    => 'MI Ma\'arif 01',
            'jenjang'        => 'MI/SD',
            'status'         => 'submitted',
        ]);

        // Juri 1: "Kyai Ridwan" logs in and gives score
        $res1 = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'pin123',
            'jury_name'      => 'Kyai Ridwan',
        ]);
        $res1->assertStatus(200);
        $token1 = $res1->json('data.token');

        $this->postJson("/api/public/jury/{$token1}/score", [
            'participant_id'  => "reg_{$reg->id}",
            'score'           => 60.0,
            'score_breakdown' => [
                ['component' => 'Akumulasi Skor Kejuaraan / Prestasi', 'weight' => 40, 'value' => 90],
                ['component' => 'Naskah Praktik Baik / Karya Inovasi Pembelajaran', 'weight' => 30, 'value' => 80],
            ],
        ])->assertStatus(200);

        // Verify existing-juries endpoint lists "Kyai Ridwan"
        $juriesRes = $this->getJson("/api/public/jury/competitions/{$competition->id}/existing-juries");
        $juriesRes->assertStatus(200);
        $this->assertContains('Kyai Ridwan', $juriesRes->json('data.existing_juries'));

        // Smart match 1: Typo "Kyai Ridwn" (missing 'a')
        $typoRes = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'pin123',
            'jury_name'      => 'Kyai Ridwn',
        ]);
        $typoRes->assertStatus(200);
        $this->assertEquals('Kyai Ridwan', $typoRes->json('data.jury_name'));
        $this->assertTrue($typoRes->json('data.matched_existing'));

        // Smart match 2: Title removed "Ridwan"
        $titleRes = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'pin123',
            'jury_name'      => 'Ridwan',
        ]);
        $titleRes->assertStatus(200);
        $this->assertEquals('Kyai Ridwan', $titleRes->json('data.jury_name'));
        $this->assertTrue($titleRes->json('data.matched_existing'));
    }

    public function test_two_phase_flow_promote_finalists_and_score_merging(): void
    {
        $superAdmin = User::factory()->create(['role' => 'super_admin']);

        $event = Event::create([
            'name'     => 'Harlah LP Ma\'arif 97',
            'slug'     => 'harlah-97-two-phase',
            'category' => 'Anugerah',
            'date'     => '2026-09-19',
            'status'   => 'OPEN',
        ]);
        \App\Models\Setting::setValue("jury_pin_event_{$event->id}", 'pin123');

        $competition = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Anugerah Guru Berprestasi',
            'category'   => 'Akademik',
            'type'       => 'Individual',
            'lomba_type' => 'guru_berprestasi',
            'status'     => 'OPEN',
            'scoring_criteria' => [
                ['component' => 'Akumulasi Skor Kejuaraan / Prestasi', 'weight' => 40],
                ['component' => 'Naskah Praktik Baik / Karya Inovasi Pembelajaran', 'weight' => 30],
                ['component' => 'Pemahaman & Pengamalan Nilai Aswaja An-Nahdliyah', 'weight' => 15],
                ['component' => 'Presentasi, Wawancara, & Deep Interview', 'weight' => 15],
            ],
        ]);

        // Create 4 participants in MI/SD jenjang
        $regs = [];
        for ($i = 1; $i <= 4; $i++) {
            $regs[$i] = AnugerahRegistration::create([
                'event_id'       => $event->id,
                'competition_id' => $competition->id,
                'category'       => 'Guru',
                'applicant_name' => "Guru Peserta {$i}",
                'school_name'    => "MI Ma'arif {$i}",
                'jenjang'        => 'MI/SD',
                'status'         => 'submitted',
            ]);
        }

        // Jury login
        $juryRes = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'pin123',
            'jury_name'      => 'Drs. Subhan',
        ]);
        $token = $juryRes->json('data.token');

        // Score Phase 1 (berkas only):
        // Peserta 1: 90 (40%) + 90 (30%) = 36 + 27 = 63.0
        // Peserta 2: 80 (40%) + 80 (30%) = 32 + 24 = 56.0
        // Peserta 3: 70 (40%) + 70 (30%) = 28 + 21 = 49.0
        // Peserta 4: 60 (40%) + 60 (30%) = 24 + 18 = 42.0
        $scores = [1 => [90, 90], 2 => [80, 80], 3 => [70, 70], 4 => [60, 60]];
        foreach ($scores as $i => $vals) {
            $this->postJson("/api/public/jury/{$token}/score", [
                'participant_id'  => "reg_{$regs[$i]->id}",
                'score'           => 50.0, // calculated from breakdown
                'score_breakdown' => [
                    ['component' => 'Akumulasi Skor Kejuaraan / Prestasi', 'weight' => 40, 'value' => $vals[0]],
                    ['component' => 'Naskah Praktik Baik / Karya Inovasi Pembelajaran', 'weight' => 30, 'value' => $vals[1]],
                ],
            ])->assertStatus(200);
        }

        // Admin triggers promote finalists
        $promoteRes = $this->actingAs($superAdmin)->postJson("/api/competitions/{$competition->id}/promote-finalists");
        $promoteRes->assertStatus(200);
        $promoteRes->assertJsonPath('data.total_finalists', 3);

        // Verify top 3 are finalists, 4th remains under_review/submitted
        $this->assertEquals('finalis', $regs[1]->fresh()->status);
        $this->assertEquals('finalis', $regs[2]->fresh()->status);
        $this->assertEquals('finalis', $regs[3]->fresh()->status);
        $this->assertEquals('submitted', $regs[4]->fresh()->status);

        // Phase 2 participants list: only 3 finalists returned
        $phase2List = $this->getJson("/api/public/jury/{$token}/participants?phase=2");
        $phase2List->assertStatus(200);
        $participantsP2 = $phase2List->json('data.participants');
        $this->assertCount(3, $participantsP2);

        // Check that Phase 1 score is properly calculated and returned
        $firstP2 = $participantsP2[0];
        $this->assertEquals(63.0, $firstP2['result']['phase1_score']);

        // Now score Phase 2 for Peserta 1:
        // Aswaja (15%) = 90 (13.5) + Wawancara (15%) = 90 (13.5) = 27.0
        // Total should be 63.0 + 27.0 = 90.0
        $saveP2Res = $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id'  => "reg_{$regs[1]->id}",
            'score'           => 27.0,
            'phase'           => 2,
            'score_breakdown' => [
                ['component' => 'Pemahaman & Pengamalan Nilai Aswaja An-Nahdliyah', 'weight' => 15, 'value' => 90],
                ['component' => 'Presentasi, Wawancara, & Deep Interview', 'weight' => 15, 'value' => 90],
            ],
        ]);
        $saveP2Res->assertStatus(200);

        // Verify score merging:
        // Total score of Peserta 1 is now 90.0
        $this->assertEquals(90.0, (float) $regs[1]->fresh()->total_score);

        // Score breakdown in DB contains all 4 components
        $dbScore = CompetitionJuryScore::where('anugerah_registration_id', $regs[1]->id)->first();
        $this->assertCount(4, $dbScore->score_breakdown);
        $this->assertEquals(90.0, (float) $dbScore->score);

        // Now test resetting competition scores via API
        $resetRes = $this->actingAs($superAdmin)->postJson("/api/competitions/{$competition->id}/reset-scores");
        $resetRes->assertStatus(200);
        $resetRes->assertJsonPath('data.deleted_jury_scores', 4); // 4 jury score entries

        // Verify jury scores deleted and registrations reset
        $this->assertEquals(0, CompetitionJuryScore::where('competition_id', $competition->id)->count());
        $freshReg1 = $regs[1]->fresh();
        $this->assertNull($freshReg1->total_score);
        $this->assertNull($freshReg1->final_score);
        $this->assertNull($freshReg1->rank);
        $this->assertEquals('submitted', $freshReg1->status);

        // Test Artisan command reset
        // First re-insert a score
        CompetitionJuryScore::create([
            'competition_id'           => $competition->id,
            'anugerah_registration_id' => $regs[1]->id,
            'jury_name'                => 'Drs. Subhan',
            'score'                    => 85.0,
            'score_breakdown'          => [],
        ]);
        $this->artisan("competition:reset-scores {$competition->id} --force")
            ->expectsOutputToContain('Berhasil!')
            ->assertExitCode(0);

        $this->assertEquals(0, CompetitionJuryScore::where('competition_id', $competition->id)->count());
    }
}
