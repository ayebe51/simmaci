<?php

namespace Tests\Feature;

use App\Models\AnugerahRegistration;
use App\Models\Competition;
use App\Models\CompetitionJuryScore;
use App\Models\Event;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckMadrasahScoresTest extends TestCase
{
    use RefreshDatabase;

    public function test_check_madrasah_scores_command_runs_successfully(): void
    {
        $event = Event::create([
            'name'     => 'Harlah LP Ma\'arif 97',
            'slug'     => 'harlah-97-audit',
            'category' => 'Anugerah',
            'date'     => '2026-09-19',
            'status'   => 'OPEN',
        ]);

        $comp = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Anugerah Madrasah Berprestasi',
            'category'   => 'Kelembagaan',
            'type'       => 'Group',
            'lomba_type' => 'madrasah_berprestasi',
            'status'     => 'OPEN',
        ]);

        $regMi = AnugerahRegistration::create([
            'event_id'       => $event->id,
            'competition_id' => $comp->id,
            'category'       => 'Madrasah',
            'jenjang'        => 'MI/SD',
            'applicant_name' => 'Kepala MI 01',
            'school_name'    => 'MI Ma\'arif Unggulan 01',
            'kecamatan'      => 'Ajibarang',
            'total_score'    => 87.50,
            'rank'           => 1,
            'status'         => 'submitted',
        ]);

        CompetitionJuryScore::create([
            'competition_id'           => $comp->id,
            'anugerah_registration_id' => $regMi->id,
            'jury_name'                => 'Juri A',
            'score'                    => 85.00,
        ]);
        CompetitionJuryScore::create([
            'competition_id'           => $comp->id,
            'anugerah_registration_id' => $regMi->id,
            'jury_name'                => 'Juri B',
            'score'                    => 90.00,
        ]);

        $this->artisan('competition:check-madrasah --jenjang=MI')
            ->expectsOutputToContain('MI Ma\'arif Unggulan 01')
            ->assertExitCode(0);
    }
}
