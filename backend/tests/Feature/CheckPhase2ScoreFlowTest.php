<?php

namespace Tests\Feature;

use App\Models\AnugerahRegistration;
use App\Models\Competition;
use App\Models\CompetitionJuryScore;
use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckPhase2ScoreFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_trace_phase2_guru_scoring_and_competition_show(): void
    {
        $superAdmin = User::factory()->create(['role' => 'super_admin']);

        $event = Event::create([
            'name'     => 'Harlah LP Maarif 97',
            'slug'     => 'harlah-97-test',
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
            'applicant_name' => 'Fauzi Ahmad, S.Pd',
            'school_name'    => 'MI Maarif 01',
            'jenjang'        => 'MI/SD',
            'status'         => 'submitted',
        ]);

        // Juri 1: Seleksi Berkas
        $login1 = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'pin123',
            'jury_name'      => 'Juri Berkas',
        ]);
        $token1 = $login1->json('data.token');

        // Score Phase 1: 90 (40%) + 80 (30%) = 36 + 24 = 60.0
        $this->postJson("/api/public/jury/{$token1}/score", [
            'participant_id'  => "reg_{$reg->id}",
            'score'           => 60.0,
            'score_breakdown' => [
                ['component' => 'Akumulasi Skor Kejuaraan / Prestasi', 'weight' => 40, 'value' => 90],
                ['component' => 'Naskah Praktik Baik / Karya Inovasi Pembelajaran', 'weight' => 30, 'value' => 80],
            ],
        ])->assertStatus(200);

        $this->assertEquals(60.0, (float) $reg->fresh()->total_score);

        // Admin promotes finalists
        $this->actingAs($superAdmin)->postJson("/api/competitions/{$competition->id}/promote-finalists")
            ->assertStatus(200);
        $this->assertEquals('finalis', $reg->fresh()->status);

        // Juri 2: Wawancara Fase 2
        // Case A: A different jury logs in to score Phase 2
        $login2 = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'pin123',
            'jury_name'      => 'Juri Wawancara',
        ]);
        $token2 = $login2->json('data.token');

        // Check juryParticipants in Phase 2
        $p2Res = $this->getJson("/api/public/jury/{$token2}/participants?phase=2");
        $p2Res->assertStatus(200);
        $pData = $p2Res->json('data.participants.0');
        $this->assertEquals(60.0, (float) $pData['result']['phase1_score']);

        // Score Phase 2: Aswaja 90 (15%) + Wawancara 90 (15%) = 13.5 + 13.5 = 27.0
        // Expected combined total = 60.0 + 27.0 = 87.0
        $saveP2 = $this->postJson("/api/public/jury/{$token2}/score", [
            'participant_id'  => "reg_{$reg->id}",
            'score'           => 87.0, // UI calculates 60.0 + 27.0 = 87.0
            'phase'           => 2,
            'score_breakdown' => [
                ['component' => 'Pemahaman & Pengamalan Nilai Aswaja An-Nahdliyah', 'weight' => 15, 'value' => 90],
                ['component' => 'Presentasi, Wawancara, & Deep Interview', 'weight' => 15, 'value' => 90],
            ],
        ]);
        $saveP2->assertStatus(200);

        $this->assertEquals(87.0, (float) $reg->fresh()->total_score);
        $this->assertEquals(2, CompetitionJuryScore::where('competition_id', $competition->id)->count());

        // Now Admin opens CompetitionDetailPage -> calls CompetitionController::show
        $showRes = $this->actingAs($superAdmin)->getJson("/api/competitions/{$competition->id}");
        $showRes->assertStatus(200);

        $this->assertEquals(87.0, (float) $reg->fresh()->total_score);

        // Also test scoreboard
        $sbRes = $this->getJson("/api/public/events/{$event->id}/scoreboard/{$competition->id}");
        $sbRes->assertStatus(200);
        $this->assertEquals(87.0, (float) $sbRes->json('data.results.0.score'));
    }

    public function test_same_jury_phase1_and_phase2(): void
    {
        $superAdmin = User::factory()->create(['role' => 'super_admin']);

        $event = Event::create([
            'name'     => 'Harlah LP Maarif 97',
            'slug'     => 'harlah-97-test-same',
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
            'applicant_name' => 'Fauzi Ahmad, S.Pd',
            'school_name'    => 'MI Maarif 01',
            'jenjang'        => 'MI/SD',
            'status'         => 'submitted',
        ]);

        // Juri: Pak Subhan scores Phase 1
        $login1 = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'pin123',
            'jury_name'      => 'Pak Subhan',
        ]);
        $token1 = $login1->json('data.token');

        $this->postJson("/api/public/jury/{$token1}/score", [
            'participant_id'  => "reg_{$reg->id}",
            'score'           => 60.0,
            'score_breakdown' => [
                ['component' => 'Akumulasi Skor Kejuaraan / Prestasi', 'weight' => 40, 'value' => 90],
                ['component' => 'Naskah Praktik Baik / Karya Inovasi Pembelajaran', 'weight' => 30, 'value' => 80],
            ],
        ])->assertStatus(200);

        // Admin promotes finalists
        $this->actingAs($superAdmin)->postJson("/api/competitions/{$competition->id}/promote-finalists");

        // Now Pak Subhan logs in to Phase 2 (or stays logged in)
        // Pak Subhan scores Phase 2
        $saveP2 = $this->postJson("/api/public/jury/{$token1}/score", [
            'participant_id'  => "reg_{$reg->id}",
            'score'           => 87.0,
            'phase'           => 2,
            'score_breakdown' => [
                ['component' => 'Pemahaman & Pengamalan Nilai Aswaja An-Nahdliyah', 'weight' => 15, 'value' => 90],
                ['component' => 'Presentasi, Wawancara, & Deep Interview', 'weight' => 15, 'value' => 90],
            ],
        ]);
        $saveP2->assertStatus(200);

        $this->assertEquals(87.0, (float) $reg->fresh()->total_score);
        $this->assertEquals(1, CompetitionJuryScore::where('competition_id', $competition->id)->count());
        $this->assertEquals(87.0, (float) CompetitionJuryScore::where('competition_id', $competition->id)->first()->score);

        // Show endpoint
        $showRes = $this->actingAs($superAdmin)->getJson("/api/competitions/{$competition->id}");
        $this->assertEquals(87.0, (float) $reg->fresh()->total_score);
    }

    public function test_phase1_has_no_breakdown_and_phase2_scored(): void
    {
        $superAdmin = User::factory()->create(['role' => 'super_admin']);

        $event = Event::create([
            'name'     => 'Harlah LP Maarif 97',
            'slug'     => 'harlah-97-test-nobd',
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

        // Reg has total_score 60.0 in Phase 1, but score_breakdown is NULL (common in imported / legacy data)
        $reg = AnugerahRegistration::create([
            'event_id'        => $event->id,
            'competition_id'  => $competition->id,
            'category'        => 'Guru',
            'applicant_name'  => 'Guru Tanpa Breakdown',
            'school_name'     => 'MI Maarif 02',
            'jenjang'         => 'MI/SD',
            'status'          => 'finalis', // promoted
            'total_score'     => 60.0,
            'score_breakdown' => null,
        ]);

        // Phase 2 jury logs in
        $login = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'pin123',
            'jury_name'      => 'Juri Fase 2 Saja',
        ]);
        $token = $login->json('data.token');

        // Check juryParticipants
        $pRes = $this->getJson("/api/public/jury/{$token}/participants?phase=2");
        $pRes->assertStatus(200);
        $pData = $pRes->json('data.participants.0');
        $this->assertEquals(60.0, (float) $pData['result']['phase1_score']);

        // Score Phase 2
        $saveP2 = $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id'  => "reg_{$reg->id}",
            'score'           => 87.0, // 60.0 + 27.0
            'phase'           => 2,
            'score_breakdown' => [
                ['component' => 'Pemahaman & Pengamalan Nilai Aswaja An-Nahdliyah', 'weight' => 15, 'value' => 90],
                ['component' => 'Presentasi, Wawancara, & Deep Interview', 'weight' => 15, 'value' => 90],
            ],
        ]);
        $saveP2->assertStatus(200);

        $this->assertEquals(87.0, (float) $reg->fresh()->total_score);
        $this->assertEquals(87.0, (float) CompetitionJuryScore::where('competition_id', $competition->id)->first()->score);
    }
}
