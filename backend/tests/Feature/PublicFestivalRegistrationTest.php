<?php

namespace Tests\Feature;

use App\Models\Competition;
use App\Models\Event;
use App\Models\CompetitionParticipant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicFestivalRegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_festival_registration_requires_jenjang(): void
    {
        $event = Event::create([
            'name'               => 'Festival Aswaja 2026',
            'slug'               => 'festival-aswaja-2026',
            'category'           => 'Festival',
            'date'               => '2026-09-19',
            'location'           => 'Cilacap',
            'status'             => 'OPEN',
            'registration_start' => now()->subDays(5),
            'registration_end'   => now()->addDays(20),
        ]);

        $competition = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Mars Ma\'arif NU',
            'category'   => 'Seni Budaya',
            'type'       => 'Group',
            'jenjang'    => 'MI/SD, MTs/SMP, MA/SMA/SMK',
            'lomba_type' => 'mars_maarif',
            'status'     => 'OPEN',
        ]);

        // Missing jenjang should fail with 422
        $payloadWithoutJenjang = [
            'competition_id' => $competition->id,
            'name'           => 'Tim Paduan Suara MI Maarif 01',
            'institution'    => 'MI Ma\'arif NU 01 Cilacap',
            'contact_person' => 'Ahmad',
            'contact_phone'  => '089512345678',
            'video_url'      => 'https://drive.google.com/file/d/video123/view',
        ];

        $res = $this->postJson("/api/public/events/{$event->id}/daftar", $payloadWithoutJenjang);
        $res->assertStatus(422)
            ->assertJsonValidationErrors(['jenjang']);

        // With jenjang should succeed with 201
        $payloadWithJenjang = array_merge($payloadWithoutJenjang, [
            'jenjang'      => 'MI/SD',
            'member_count' => 3,
            'members'      => [
                ['name' => 'Ahmad', 'nim' => ''],
                ['name' => 'Ayub', 'nim' => ''],
                ['name' => 'Numan', 'nim' => ''],
            ],
        ]);

        $res2 = $this->postJson("/api/public/events/{$event->id}/daftar", $payloadWithJenjang);
        $res2->assertStatus(201);

        $this->assertDatabaseHas('competition_participants', [
            'competition_id' => $competition->id,
            'name'           => 'Tim Paduan Suara MI Maarif 01',
            'jenjang'        => 'MI/SD',
            'institution'    => 'MI Ma\'arif NU 01 Cilacap',
            'contact_phone'  => '089512345678',
            'video_url'      => 'https://drive.google.com/file/d/video123/view',
        ]);
    }
}
