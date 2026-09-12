<?php

namespace Tests\Feature;

use App\Models\Competition;
use App\Models\Event;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationDeadlineExtensionTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_extension_migration_sets_deadlines_to_13_september(): void
    {
        $event = Event::create([
            'name'               => 'Anugerah Pendidikan & Festival Aswaja LP Ma\'arif NU Cilacap 2026',
            'slug'               => 'anugerah-festival-2026',
            'category'           => 'Festival',
            'date'               => '2026-09-22',
            'location'           => 'Cilacap',
            'status'             => 'OPEN',
            'registration_start' => '2026-08-01',
            'registration_end'   => '2026-09-11',
            'video_deadline'     => '2026-09-11 23:59:00',
        ]);

        $compMars = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Lomba Mars Ma\'arif',
            'category'   => 'Seni Budaya',
            'type'       => 'Beregu',
            'lomba_type' => 'mars_maarif',
            'deadline'   => '2026-09-11 23:59:00',
            'status'     => 'OPEN',
        ]);

        $compGuru = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Anugerah Guru Berprestasi',
            'category'   => 'Akademik',
            'type'       => 'Individual',
            'lomba_type' => 'guru_berprestasi',
            'deadline'   => '2026-09-11 23:59:00',
            'status'     => 'OPEN',
        ]);

        // Re-run migration logic
        $migration = require database_path('migrations/2026_09_12_000001_extend_registration_until_13_september.php');
        $migration->up();

        $event->refresh();
        $compMars->refresh();
        $compGuru->refresh();

        $this->assertEquals('OPEN', $event->status);
        $this->assertEquals('2026-09-13', $event->registration_end->format('Y-m-d'));
        $this->assertEquals('2026-09-13 23:59:00', $event->video_deadline->format('Y-m-d H:i:s'));

        $this->assertEquals('OPEN', $compMars->status);
        $this->assertEquals('2026-09-13 23:59:00', $compMars->deadline->format('Y-m-d H:i:s'));

        $this->assertEquals('OPEN', $compGuru->status);
        $this->assertEquals('2026-09-13 23:59:00', $compGuru->deadline->format('Y-m-d H:i:s'));
    }

    public function test_registration_allowed_on_12_and_13_september(): void
    {
        Carbon::setTestNow('2026-09-12 10:00:00');

        $event = Event::create([
            'name'               => 'Anugerah Pendidikan & Festival Aswaja 2026',
            'slug'               => 'anugerah-festival-2026-test',
            'category'           => 'Festival',
            'date'               => '2026-09-22',
            'location'           => 'Cilacap',
            'status'             => 'OPEN',
            'registration_start' => '2026-08-01',
            'registration_end'   => '2026-09-13',
            'video_deadline'     => '2026-09-13 23:59:00',
        ]);

        $competition = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Lomba Mars Ma\'arif',
            'category'   => 'Seni Budaya',
            'type'       => 'Beregu',
            'jenjang'    => 'MTs/SMP',
            'lomba_type' => 'mars_maarif',
            'deadline'   => '2026-09-13 23:59:00',
            'status'     => 'OPEN',
        ]);

        // Registration should succeed on 12 Sep
        $payload = [
            'competition_id' => $competition->id,
            'name'           => 'Paduan Suara MTs Ma\'arif 1',
            'institution'    => 'MTs Ma\'arif 1',
            'jenjang'        => 'MTs/SMP',
            'contact_person' => 'Budi',
            'contact_phone'  => '081234567890',
            'video_url'      => 'https://drive.google.com/file/d/test12345/view',
            'member_count'   => 5,
            'members'        => [
                ['name' => 'Peserta 1'],
            ],
        ];

        $res12 = $this->postJson("/api/public/events/{$event->id}/daftar", $payload);
        $res12->assertStatus(201);

        // Registration should also succeed on 13 Sep 23:50
        Carbon::setTestNow('2026-09-13 23:50:00');
        $payload['name'] = 'Paduan Suara MTs Ma\'arif 2';
        $res13 = $this->postJson("/api/public/events/{$event->id}/daftar", $payload);
        $res13->assertStatus(201);

        // Registration should fail after deadline on 14 Sep
        Carbon::setTestNow('2026-09-14 00:01:00');
        $payload['name'] = 'Paduan Suara MTs Ma\'arif 3';
        $res14 = $this->postJson("/api/public/events/{$event->id}/daftar", $payload);
        $res14->assertStatus(400);
        $res14->assertJsonFragment(['message' => 'Batas waktu pendaftaran cabang lomba ini sudah lewat.']);

        Carbon::setTestNow();
    }

    public function test_seed_harlah97_uses_13_september_deadline(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin']);

        $event = Event::create([
            'name'     => 'Event Harlah 97',
            'slug'     => 'event-harlah-97-test',
            'category' => 'Festival',
            'date'     => '2026-09-22',
            'status'   => 'OPEN',
        ]);

        $response = $this->actingAs($admin)
            ->postJson("/api/events/{$event->id}/seed-harlah97");

        $response->assertStatus(200);

        $competitions = Competition::where('event_id', $event->id)->get();
        $this->assertNotEmpty($competitions);

        foreach ($competitions as $comp) {
            $this->assertEquals('2026-09-13 23:59:00', $comp->deadline->format('Y-m-d H:i:s'));
        }
    }
}
