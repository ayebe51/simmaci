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

        // Anti-hijack test: A different person "Ridwan Kamil" must NOT match "Kyai Ridwan"!
        $diffRes = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'pin123',
            'jury_name'      => 'Ridwan Kamil',
        ]);
        $diffRes->assertStatus(200);
        $this->assertEquals('Ridwan Kamil', $diffRes->json('data.jury_name'));
        $this->assertFalse($diffRes->json('data.matched_existing'));
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

    public function test_phase2_displays_official_phase1_scores_across_different_juries_and_merges_properly(): void
    {
        $event = Event::create([
            'name'     => 'Harlah LP Ma\'arif 97 Multi-Jury',
            'slug'     => 'harlah-97-multi-jury-p2',
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

        // Peserta 1: Jenjang MI
        $regMI = AnugerahRegistration::create([
            'event_id'       => $event->id,
            'competition_id' => $competition->id,
            'category'       => 'Guru',
            'applicant_name' => 'Guru MI Hebat',
            'school_name'    => 'MI Ma\'arif 01',
            'jenjang'        => 'MI/SD',
            'status'         => 'finalis',
        ]);

        // Peserta 2: Jenjang MTs
        $regMTs = AnugerahRegistration::create([
            'event_id'       => $event->id,
            'competition_id' => $competition->id,
            'category'       => 'Guru',
            'applicant_name' => 'Guru MTs Keren',
            'school_name'    => 'MTs Ma\'arif 01',
            'jenjang'        => 'MTs/SMP',
            'status'         => 'finalis',
        ]);

        // Juri MI: "Juri Muhtarom" scores Peserta MI only in Phase 1
        $loginJuryMI = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'pin123',
            'jury_name'      => 'Juri Muhtarom',
        ]);
        $tokenMI = $loginJuryMI->json('data.token');

        $this->postJson("/api/public/jury/{$tokenMI}/score", [
            'participant_id'  => "reg_{$regMI->id}",
            'score'           => 58.0,
            'score_breakdown' => [
                ['component' => 'Akumulasi Skor Kejuaraan / Prestasi', 'weight' => 40, 'value' => 85], // 34.0
                ['component' => 'Naskah Praktik Baik / Karya Inovasi Pembelajaran', 'weight' => 30, 'value' => 80], // 24.0
            ],
        ])->assertStatus(200);

        // Juri MTs: "Juri Badawi" scores Peserta MTs only in Phase 1
        $loginJuryMTs = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'pin123',
            'jury_name'      => 'Juri Badawi',
        ]);
        $tokenMTs = $loginJuryMTs->json('data.token');

        $this->postJson("/api/public/jury/{$tokenMTs}/score", [
            'participant_id'  => "reg_{$regMTs->id}",
            'score'           => 61.0,
            'score_breakdown' => [
                ['component' => 'Akumulasi Skor Kejuaraan / Prestasi', 'weight' => 40, 'value' => 90], // 36.0
                ['component' => 'Naskah Praktik Baik / Karya Inovasi Pembelajaran', 'weight' => 30, 'value' => 83.33], // 25.0
            ],
        ])->assertStatus(200);

        // Now Phase 2 starts!
        // 1. When Juri Muhtarom logs into Phase 2:
        // Even though Muhtarom only scored MI, Muhtarom MUST see Peserta MTs with their official Phase 1 score (61.0)!
        $listResMuhtarom = $this->getJson("/api/public/jury/{$tokenMI}/participants?phase=2");
        $listResMuhtarom->assertStatus(200);
        $participants = collect($listResMuhtarom->json('data.participants'));

        $pMI = $participants->firstWhere('name', 'Guru MI Hebat');
        $pMTs = $participants->firstWhere('name', 'Guru MTs Keren');

        $this->assertEquals(58.0, (float) $pMI['result']['phase1_score']);
        $this->assertEquals(61.0, (float) $pMTs['result']['phase1_score'], 'MTs finalist must show official Phase 1 score to MI jury, not 0.00!');

        // 2. A dedicated interview jury "Dr. Wawancara" logs into Phase 2
        // Dr. Wawancara NEVER scored anyone in Phase 1!
        $loginWawancara = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'pin123',
            'jury_name'      => 'Dr. Wawancara',
        ]);
        $tokenWawancara = $loginWawancara->json('data.token');

        $listResWawancara = $this->getJson("/api/public/jury/{$tokenWawancara}/participants?phase=2");
        $listResWawancara->assertStatus(200);
        $wawancaraParticipants = collect($listResWawancara->json('data.participants'));

        $wMI = $wawancaraParticipants->firstWhere('name', 'Guru MI Hebat');
        $wMTs = $wawancaraParticipants->firstWhere('name', 'Guru MTs Keren');

        $this->assertEquals(58.0, (float) $wMI['result']['phase1_score'], 'Interview jury must see official Phase 1 score for MI!');
        $this->assertEquals(61.0, (float) $wMTs['result']['phase1_score'], 'Interview jury must see official Phase 1 score for MTs!');

        // 3. Dr. Wawancara scores Phase 2 for Peserta MTs:
        // Aswaja (15%) = 90 (13.5) + Wawancara (15%) = 80 (12.0) = 25.5 subtotal
        // Overall total score must be 61.0 + 25.5 = 86.5!
        $saveMTsRes = $this->postJson("/api/public/jury/{$tokenWawancara}/score", [
            'participant_id'  => "reg_{$regMTs->id}",
            'score'           => 25.5,
            'phase'           => 2,
            'score_breakdown' => [
                ['component' => 'Pemahaman & Pengamalan Nilai Aswaja An-Nahdliyah', 'weight' => 15, 'value' => 90],
                ['component' => 'Presentasi, Wawancara, & Deep Interview', 'weight' => 15, 'value' => 80],
            ],
        ]);
        $saveMTsRes->assertStatus(200);

        // Verify that Peserta MTs score was properly combined and NOT wiped out!
        $freshMTs = $regMTs->fresh();
        $this->assertEquals(86.5, (float) $freshMTs->total_score, 'Total score must combine Phase 1 (61.0) + Phase 2 (25.5) = 86.5!');
    }

    public function test_madrasah_berprestasi_two_phase_flow_and_multi_jury(): void
    {
        $event = Event::create([
            'name'     => 'Harlah LP Ma\'arif 97 Madrasah',
            'slug'     => 'harlah-97-madrasah-p2',
            'category' => 'Anugerah',
            'date'     => '2026-09-19',
            'status'   => 'OPEN',
        ]);
        \App\Models\Setting::setValue("jury_pin_event_{$event->id}", 'pin123');

        $competition = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Anugerah Madrasah Berprestasi',
            'category'   => 'Lembaga',
            'type'       => 'Institution',
            'lomba_type' => 'madrasah_berprestasi',
            'status'     => 'OPEN',
            'scoring_criteria' => [
                ['component' => 'Akumulasi Skor Kejuaraan Lembaga', 'weight' => 45],
                ['component' => 'Tata Kelola Institusi & Penguatan Karakter Aswaja', 'weight' => 25],
                ['component' => 'Kemitraan, Keaktifan SIMNU & SIMMACI, Kontribusi Sosial', 'weight' => 15],
                ['component' => 'Presentasi Kepala Madrasah & Visitasi / Fact Checking', 'weight' => 15],
            ],
        ]);

        // Madrasah MI
        $regMI = AnugerahRegistration::create([
            'event_id'       => $event->id,
            'competition_id' => $competition->id,
            'category'       => 'Madrasah',
            'applicant_name' => 'Kepala MI Unggulan',
            'school_name'    => 'MI Ma\'arif Unggulan',
            'jenjang'        => 'MI/SD',
            'status'         => 'finalis',
        ]);

        // Madrasah MTs
        $regMTs = AnugerahRegistration::create([
            'event_id'       => $event->id,
            'competition_id' => $competition->id,
            'category'       => 'Madrasah',
            'applicant_name' => 'Kepala MTs Teladan',
            'school_name'    => 'MTs Ma\'arif Teladan',
            'jenjang'        => 'MTs/SMP',
            'status'         => 'finalis',
        ]);

        // Juri MI: "H. Zaini" scores MI in Phase 1
        // 90 (45%) = 40.5 + 80 (25%) = 20.0 + 80 (15%) = 12.0 => Total 72.5 / 85
        $loginZaini = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'pin123',
            'jury_name'      => 'H. Zaini',
        ]);
        $tokenZaini = $loginZaini->json('data.token');

        $this->postJson("/api/public/jury/{$tokenZaini}/score", [
            'participant_id'  => "reg_{$regMI->id}",
            'score'           => 72.5,
            'score_breakdown' => [
                ['component' => 'Akumulasi Skor Kejuaraan Lembaga', 'weight' => 45, 'value' => 90],
                ['component' => 'Tata Kelola Institusi & Penguatan Karakter Aswaja', 'weight' => 25, 'value' => 80],
                ['component' => 'Kemitraan, Keaktifan SIMNU & SIMMACI, Kontribusi Sosial', 'weight' => 15, 'value' => 80],
            ],
        ])->assertStatus(200);

        // Juri MTs: "Dra. Siti" scores MTs in Phase 1
        // 90 (45%) = 40.5 + 90 (25%) = 22.5 + 90 (15%) = 13.5 => Total 76.5 / 85
        $loginSiti = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'pin123',
            'jury_name'      => 'Dra. Siti',
        ]);
        $tokenSiti = $loginSiti->json('data.token');

        $this->postJson("/api/public/jury/{$tokenSiti}/score", [
            'participant_id'  => "reg_{$regMTs->id}",
            'score'           => 76.5,
            'score_breakdown' => [
                ['component' => 'Akumulasi Skor Kejuaraan Lembaga', 'weight' => 45, 'value' => 90],
                ['component' => 'Tata Kelola Institusi & Penguatan Karakter Aswaja', 'weight' => 25, 'value' => 90],
                ['component' => 'Kemitraan, Keaktifan SIMNU & SIMMACI, Kontribusi Sosial', 'weight' => 15, 'value' => 90],
            ],
        ])->assertStatus(200);

        // In Phase 2:
        // When H. Zaini (MI jury) views Phase 2, MTs must display 76.5 / 85!
        $listRes = $this->getJson("/api/public/jury/{$tokenZaini}/participants?phase=2");
        $listRes->assertStatus(200);
        $participants = collect($listRes->json('data.participants'));

        $pMI = $participants->firstWhere('institution', 'MI Ma\'arif Unggulan');
        $pMTs = $participants->firstWhere('institution', 'MTs Ma\'arif Teladan');

        $this->assertEquals(72.5, (float) $pMI['result']['phase1_score']);
        $this->assertEquals(76.5, (float) $pMTs['result']['phase1_score'], 'MTs Madrasah Phase 1 score must be visible to MI jury!');

        // Juri Visitasi (new jury) logs into Phase 2
        $loginVisitasi = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'pin123',
            'jury_name'      => 'Tim Asesor Visitasi',
        ]);
        $tokenVisitasi = $loginVisitasi->json('data.token');

        $visitasiRes = $this->getJson("/api/public/jury/{$tokenVisitasi}/participants?phase=2");
        $vMTs = collect($visitasiRes->json('data.participants'))->firstWhere('institution', 'MTs Ma\'arif Teladan');
        $this->assertEquals(76.5, (float) $vMTs['result']['phase1_score'], 'Asesor visitasi must see Phase 1 score for MTs!');

        // Save Phase 2 (Presentasi & Visitasi 15%): value 90 => 13.5
        // Total score must be 76.5 + 13.5 = 90.0!
        $saveRes = $this->postJson("/api/public/jury/{$tokenVisitasi}/score", [
            'participant_id'  => "reg_{$regMTs->id}",
            'score'           => 13.5,
            'phase'           => 2,
            'score_breakdown' => [
                ['component' => 'Presentasi Kepala Madrasah & Visitasi / Fact Checking', 'weight' => 15, 'value' => 90],
            ],
        ]);
        $saveRes->assertStatus(200);

        $freshMTs = $regMTs->fresh();
        $this->assertEquals(90.0, (float) $freshMTs->total_score, 'Total score must combine Phase 1 (76.5) + Phase 2 (13.5) = 90.0!');
    }

    public function test_phase1_is_locked_once_finalists_promoted_and_rejects_modifications(): void
    {
        $event = Event::create([
            'name'     => 'Harlah LP Ma\'arif 97 Lock Test',
            'slug'     => 'harlah-97-lock-test',
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
            'applicant_name' => 'Guru Juara 1',
            'school_name'    => 'MI Ma\'arif 01',
            'jenjang'        => 'MI/SD',
            'status'         => 'finalis', // promoted finalist
        ]);

        $loginJury = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin'            => 'pin123',
            'jury_name'      => 'Juri Seleksi Berkas',
        ]);
        $token = $loginJury->json('data.token');

        // Check juryParticipants returns is_phase1_locked: true
        $pRes = $this->getJson("/api/public/jury/{$token}/participants?phase=1");
        $pRes->assertStatus(200);
        $this->assertTrue($pRes->json('data.competition.is_phase1_locked'));

        // Attempt to submit Phase 1 score while Phase 1 is locked -> MUST BE 403 Forbidden!
        $p1Submit = $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id'  => "reg_{$reg->id}",
            'score'           => 60.0,
            'phase'           => 1,
            'score_breakdown' => [
                ['component' => 'Akumulasi Skor Kejuaraan / Prestasi', 'weight' => 40, 'value' => 90],
                ['component' => 'Naskah Praktik Baik / Karya Inovasi Pembelajaran', 'weight' => 30, 'value' => 80],
            ],
        ]);
        $p1Submit->assertStatus(403);
        $this->assertStringContainsString('Fase 1', $p1Submit->json('message'));
        $this->assertStringContainsString('dikunci', $p1Submit->json('message'));

        // Submitting Phase 2 score (phase = 2) must succeed!
        $p2Submit = $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id'  => "reg_{$reg->id}",
            'score'           => 25.0,
            'phase'           => 2,
            'score_breakdown' => [
                ['component' => 'Pemahaman & Pengamalan Nilai Aswaja An-Nahdliyah', 'weight' => 15, 'value' => 85],
                ['component' => 'Presentasi, Wawancara, & Deep Interview', 'weight' => 15, 'value' => 85],
            ],
        ]);
        $p2Submit->assertStatus(200);
    }
}

