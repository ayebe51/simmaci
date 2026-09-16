<?php

namespace Tests\Feature;

use App\Models\AnugerahRegistration;
use App\Models\Competition;
use App\Models\CompetitionJuryScore;
use App\Models\Event;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompetitionScoreLockTest extends TestCase
{
    use RefreshDatabase;

    private Event $event;
    private Competition $competition;
    private AnugerahRegistration $registration;

    protected function setUp(): void
    {
        parent::setUp();

        $this->event = Event::create([
            'name'     => 'Harlah LP Ma\'arif 97',
            'slug'     => 'harlah-97-lock-test',
            'category' => 'Anugerah',
            'date'     => '2026-09-19',
            'status'   => 'OPEN',
        ]);
        Setting::setValue("jury_pin_event_{$this->event->id}", '1234');

        $this->competition = Competition::create([
            'event_id'   => $this->event->id,
            'name'       => 'MTQ Putri',
            'category'   => 'Seni',
            'type'       => 'Individual',
            'lomba_type' => 'mtq_pi',
            'status'     => 'OPEN',
            'scoring_criteria' => [
                ['component' => 'Tajwid', 'weight' => 45],
                ['component' => 'Lagu & Irama', 'weight' => 35],
                ['component' => 'Adab & Penampilan', 'weight' => 20],
            ],
        ]);

        $this->registration = AnugerahRegistration::create([
            'event_id'       => $this->event->id,
            'competition_id' => $this->competition->id,
            'category'       => 'Siswa',
            'applicant_name' => 'Siti Aisyah',
            'school_name'    => 'MTs Ma\'arif 01',
            'jenjang'        => 'MTs/SMP',
            'status'         => 'submitted',
        ]);
    }

    public function test_jury_can_score_when_not_locked(): void
    {
        $loginRes = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $this->competition->id,
            'pin'            => '1234',
            'jury_name'      => 'Juri A',
        ]);
        $loginRes->assertStatus(200);
        $token = $loginRes->json('data.token');

        $scoreRes = $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id'  => "reg_{$this->registration->id}",
            'score'           => 88.5,
            'score_breakdown' => [
                ['component' => 'Tajwid', 'weight' => 45, 'value' => 90],
                ['component' => 'Lagu & Irama', 'weight' => 35, 'value' => 88],
                ['component' => 'Adab & Penampilan', 'weight' => 20, 'value' => 86],
            ],
        ]);
        $scoreRes->assertStatus(200);
    }

    public function test_jury_cannot_score_when_locked(): void
    {
        // Lock this competition
        $this->competition->lockScores();
        $this->assertTrue($this->competition->fresh()->isScoresLocked());

        $loginRes = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $this->competition->id,
            'pin'            => '1234',
            'jury_name'      => 'Juri A',
        ]);
        $loginRes->assertStatus(200);
        $token = $loginRes->json('data.token');

        // Check juryParticipants payload returns is_locked true
        $partsRes = $this->getJson("/api/public/jury/{$token}/participants");
        $partsRes->assertStatus(200);
        $this->assertTrue($partsRes->json('data.competition.is_locked'));

        // Attempting to score must return 403 Forbidden
        $scoreRes = $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id' => "reg_{$this->registration->id}",
            'score'          => 92.0,
        ]);
        $scoreRes->assertStatus(403);
        $scoreRes->assertJsonFragment([
            'message' => 'Penilaian untuk cabang lomba ini telah dikunci/final. Nilai tidak dapat diubah.',
        ]);
    }

    public function test_operator_cannot_save_results_when_locked(): void
    {
        $this->competition->lockScores();

        $operator = User::factory()->create(['role' => 'admin_yayasan']);

        $res = $this->actingAs($operator)->postJson("/api/competitions/{$this->competition->id}/results", [
            'participant_id' => "reg_{$this->registration->id}",
            'score'          => 95.0,
        ]);
        $res->assertStatus(403);
        $res->assertJsonFragment([
            'message' => 'Nilai cabang lomba ini telah dikunci/final. Perubahan nilai tidak diizinkan.',
        ]);
    }

    public function test_artisan_lock_command_locks_and_unlocks_competitions(): void
    {
        // 1. Run artisan lock command for all competitions
        $this->artisan('competition:lock-scores --all')
            ->assertExitCode(0);

        $this->assertTrue($this->competition->fresh()->isScoresLocked());
        $this->assertEquals('FINISHED', $this->competition->fresh()->status);

        // 2. Run artisan unlock command
        $this->artisan('competition:lock-scores --all --unlock')
            ->assertExitCode(0);

        $this->assertFalse($this->competition->fresh()->isScoresLocked());
        $this->assertEquals('OPEN', $this->competition->fresh()->status);
    }

    public function test_freeze_submitted_scores_allows_unscored_and_blocks_already_scored(): void
    {
        $reg2 = AnugerahRegistration::create([
            'event_id'       => $this->event->id,
            'competition_id' => $this->competition->id,
            'category'       => 'Siswa',
            'applicant_name' => 'Fatimah Az-Zahra',
            'school_name'    => 'MTs Ma\'arif 02',
            'jenjang'        => 'MTs/SMP',
            'status'         => 'submitted',
        ]);

        $loginRes = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $this->competition->id,
            'pin'            => '1234',
            'jury_name'      => 'Juri A',
        ]);
        $token = $loginRes->json('data.token');

        // Score first participant
        $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id' => "reg_{$this->registration->id}",
            'score'          => 85.0,
        ])->assertStatus(200);

        // Turn on freeze submitted scores mode
        $this->competition->freezeSubmittedScores();
        $this->assertTrue($this->competition->fresh()->isFreezeSubmittedScores());

        // Attempting to re-score or edit first participant must be BLOCKED
        $editRes = $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id' => "reg_{$this->registration->id}",
            'score'          => 95.0,
        ]);
        $editRes->assertStatus(403);
        $editRes->assertJsonFragment([
            'message' => 'Nilai untuk peserta ini sudah tersimpan dan telah dikunci. Nilai tidak dapat diubah lagi.',
        ]);

        // But scoring the second (unscored) participant MUST SUCCEED
        $newScoreRes = $this->postJson("/api/public/jury/{$token}/score", [
            'participant_id' => "reg_{$reg2->id}",
            'score'          => 90.0,
        ]);
        $newScoreRes->assertStatus(200);
    }
}
