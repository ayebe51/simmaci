<?php

namespace Tests\Feature;

use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicMeetingWalkInTest extends TestCase
{
    use RefreshDatabase;

    private User $creator;
    private Meeting $meeting;

    public function setUp(): void
    {
        parent::setUp();

        $this->creator = User::factory()->create([
            'role' => 'super_admin',
            'is_active' => true,
        ]);

        $this->meeting = Meeting::factory()->create([
            'created_by'          => $this->creator->id,
            'started_at'          => now()->subHour(),
            'ended_at'            => now()->addHours(3),
            'geolocation_enabled' => false,
        ]);
    }

    /** @test */
    public function walk_in_successfully_records_attendance(): void
    {
        $response = $this->postJson("/api/public/meetings/{$this->meeting->id}/walk-in", [
            'nama'     => 'Ahmad Dahlan',
            'jabatan'  => 'Guru',
            'instansi' => 'MI Al-Maarif 01',
            'no_hp'    => '081234567890',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.nama', 'Ahmad Dahlan');

        $this->assertDatabaseHas('meeting_attendances', [
            'meeting_id'       => $this->meeting->id,
            'walk_in_name'     => 'Ahmad Dahlan',
            'attendance_type'  => 'qr_umum',
        ]);
    }

    /** @test */
    public function multiple_participants_sharing_same_ip_can_all_check_in(): void
    {
        // Simulate 10 participants checking in from the exact same Wi-Fi IP
        for ($i = 1; $i <= 10; $i++) {
            $phone = '0812345678' . str_pad((string) $i, 2, '0', STR_PAD_LEFT);
            $response = $this->withServerVariables(['REMOTE_ADDR' => '192.168.1.100'])
                ->postJson("/api/public/meetings/{$this->meeting->id}/walk-in", [
                    'nama'     => "Peserta {$i}",
                    'jabatan'  => 'Guru',
                    'instansi' => 'MI Al-Maarif 01',
                    'no_hp'    => $phone,
                ]);

            $response->assertStatus(201, "Peserta {$i} with same IP should be accepted");
        }

        $this->assertEquals(
            10,
            MeetingAttendance::where('meeting_id', $this->meeting->id)->count()
        );
    }

    /** @test */
    public function walk_in_prevents_duplicate_submission_with_same_phone(): void
    {
        $payload = [
            'nama'     => 'Siti Aminah',
            'jabatan'  => 'Kepala Madrasah',
            'instansi' => 'RA Masyithoh',
            'no_hp'    => '081987654321',
        ];

        // First submission succeeds
        $res1 = $this->postJson("/api/public/meetings/{$this->meeting->id}/walk-in", $payload);
        $res1->assertStatus(201);

        // Second submission with the same phone returns 409 Conflict
        $res2 = $this->postJson("/api/public/meetings/{$this->meeting->id}/walk-in", $payload);
        $res2->assertStatus(409);
        $this->assertStringContainsString('sudah tercatat', $res2->json('message'));
    }
}
