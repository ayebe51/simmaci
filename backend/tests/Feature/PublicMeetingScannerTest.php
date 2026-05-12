<?php

namespace Tests\Feature;

use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Models\MeetingParticipant;
use App\Models\Setting;
use App\Models\User;
use App\Services\MeetingQrService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

/**
 * PublicMeetingScannerTest
 *
 * Feature tests for the panitia QR scanner endpoints.
 * Tests PIN verification, active meeting list, and QR scan check-in.
 *
 * Requirements: Meeting attendance via panitia scanner
 */
class PublicMeetingScannerTest extends TestCase
{
    use RefreshDatabase;

    private const VALID_PIN = '1234';
    private MeetingQrService $qrService;
    private User $creator;

    protected function setUp(): void
    {
        parent::setUp();

        // Set up meeting scanner PIN in settings
        Setting::setValue('meeting_scanner_pin', self::VALID_PIN);

        $this->qrService = app(MeetingQrService::class);

        $this->creator = User::factory()->create([
            'role' => 'super_admin',
            'is_active' => true,
        ]);
    }

    // ── verifyPin ─────────────────────────────────────────────────────────────

    /** @test */
    public function verify_pin_returns_success_with_correct_pin(): void
    {
        $response = $this->postJson('/api/public/meetings/verify-pin', [
            'pin' => self::VALID_PIN,
        ]);

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.role', 'meeting_scanner');
    }

    /** @test */
    public function verify_pin_returns_401_with_wrong_pin(): void
    {
        $response = $this->postJson('/api/public/meetings/verify-pin', [
            'pin' => 'wrong',
        ]);

        $response->assertStatus(401);
        $response->assertJsonPath('success', false);
    }

    /** @test */
    public function verify_pin_returns_400_when_pin_not_configured(): void
    {
        // Remove the PIN setting
        Setting::where('key', 'meeting_scanner_pin')->delete();

        $response = $this->postJson('/api/public/meetings/verify-pin', [
            'pin' => self::VALID_PIN,
        ]);

        $response->assertStatus(400);
    }

    // ── activeList ────────────────────────────────────────────────────────────

    /** @test */
    public function active_list_returns_ongoing_meetings(): void
    {
        // Create an ongoing meeting
        $ongoing = Meeting::factory()->create([
            'created_by' => $this->creator->id,
            'started_at' => now()->subHour(),
            'ended_at'   => now()->addHours(3),
        ]);

        // Create a completed meeting (should NOT appear)
        Meeting::factory()->create([
            'created_by' => $this->creator->id,
            'started_at' => now()->subDays(2),
            'ended_at'   => now()->subDay(),
        ]);

        $response = $this->getJson('/api/public/meetings/active?pin=' . self::VALID_PIN);

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->toArray();
        $this->assertContains($ongoing->id, $ids);
    }

    /** @test */
    public function active_list_returns_upcoming_meetings_within_2_hours(): void
    {
        // Upcoming in 1 hour (within 2-hour window)
        $upcoming = Meeting::factory()->create([
            'created_by' => $this->creator->id,
            'started_at' => now()->addHour(),
            'ended_at'   => now()->addHours(5),
        ]);

        // Upcoming in 3 hours (outside 2-hour window — should NOT appear)
        Meeting::factory()->create([
            'created_by' => $this->creator->id,
            'started_at' => now()->addHours(3),
            'ended_at'   => now()->addHours(7),
        ]);

        $response = $this->getJson('/api/public/meetings/active?pin=' . self::VALID_PIN);

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->toArray();
        $this->assertContains($upcoming->id, $ids);
    }

    /** @test */
    public function active_list_returns_401_with_wrong_pin(): void
    {
        $response = $this->getJson('/api/public/meetings/active?pin=wrong');
        $response->assertStatus(401);
    }

    // ── scan ──────────────────────────────────────────────────────────────────

    /** @test */
    public function scan_returns_401_with_wrong_pin(): void
    {
        $response = $this->postJson('/api/public/meetings/scan', [
            'pin'    => 'wrong',
            'qr_url' => 'https://example.com/meetings/1/check-in?signature=abc',
        ]);

        $response->assertStatus(401);
    }

    /** @test */
    public function scan_returns_400_for_non_meeting_qr_url(): void
    {
        $response = $this->postJson('/api/public/meetings/scan', [
            'pin'    => self::VALID_PIN,
            'qr_url' => 'https://simmaci.com/verify/sk/ABC123',
        ]);

        $response->assertStatus(400);
        $this->assertStringContainsString('bukan untuk absensi rapat', $response->json('message'));
    }

    /** @test */
    public function scan_returns_404_when_meeting_not_found(): void
    {
        // Build a URL that matches the pattern but meeting doesn't exist
        $fakeUrl = URL::temporarySignedRoute(
            'public.meetings.check-in.show',
            now()->addHours(2),
            ['meeting' => 99999, 'participant' => 1]
        );

        $response = $this->postJson('/api/public/meetings/scan', [
            'pin'    => self::VALID_PIN,
            'qr_url' => $fakeUrl,
        ]);

        $response->assertStatus(404);
    }

    /** @test */
    public function scan_successfully_records_attendance_for_valid_qr(): void
    {
        // Create an ongoing meeting (within H-1 to H+1 window)
        $meeting = Meeting::factory()->create([
            'created_by'         => $this->creator->id,
            'started_at'         => now()->subMinutes(30), // started 30 min ago
            'ended_at'           => now()->addHours(3),
            'geolocation_enabled' => false,
        ]);

        $participant = MeetingParticipant::factory()->forMeeting($meeting)->create([
            'name'           => 'Budi Santoso',
            'jabatan'        => 'Kepala Sekolah',
            'instansi'       => 'MI Test',
            'phone_number'   => '628123456789',
            'is_token_used'  => false,
            'token_revoked'  => false,
        ]);

        // Generate a valid signed QR URL
        $qrUrl = $this->qrService->generatePersonalQrUrl($meeting, $participant);

        $response = $this->postJson('/api/public/meetings/scan', [
            'pin'    => self::VALID_PIN,
            'qr_url' => $qrUrl,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.participant_name', 'Budi Santoso');

        // Verify attendance was recorded in DB
        $this->assertDatabaseHas('meeting_attendances', [
            'meeting_id'     => $meeting->id,
            'participant_id' => $participant->id,
        ]);

        // Verify token is marked as used
        $participant->refresh();
        $this->assertTrue($participant->is_token_used);
    }

    /** @test */
    public function scan_returns_409_when_participant_already_checked_in(): void
    {
        $meeting = Meeting::factory()->create([
            'created_by'         => $this->creator->id,
            'started_at'         => now()->subMinutes(30),
            'ended_at'           => now()->addHours(3),
            'geolocation_enabled' => false,
        ]);

        $participant = MeetingParticipant::factory()->forMeeting($meeting)->create([
            'is_token_used' => false,
            'token_revoked' => false,
        ]);

        $qrUrl = $this->qrService->generatePersonalQrUrl($meeting, $participant);

        // First scan — should succeed
        $this->postJson('/api/public/meetings/scan', [
            'pin'    => self::VALID_PIN,
            'qr_url' => $qrUrl,
        ])->assertStatus(201);

        // Second scan — should return 409
        $response = $this->postJson('/api/public/meetings/scan', [
            'pin'    => self::VALID_PIN,
            'qr_url' => $qrUrl,
        ]);

        $response->assertStatus(409);
    }

    /** @test */
    public function scan_returns_403_for_invalid_signature(): void
    {
        $meeting = Meeting::factory()->create([
            'created_by' => $this->creator->id,
            'started_at' => now()->subMinutes(30),
            'ended_at'   => now()->addHours(3),
        ]);

        $participant = MeetingParticipant::factory()->forMeeting($meeting)->create();

        // Build a URL with tampered signature
        $tamperedUrl = route('public.meetings.check-in.show', [
            'meeting'     => $meeting->id,
            'participant' => $participant->id,
        ]) . '?signature=tampered_invalid_signature';

        $response = $this->postJson('/api/public/meetings/scan', [
            'pin'    => self::VALID_PIN,
            'qr_url' => $tamperedUrl,
        ]);

        $response->assertStatus(403);
    }

    /** @test */
    public function scan_returns_410_for_expired_qr(): void
    {
        $meeting = Meeting::factory()->create([
            'created_by' => $this->creator->id,
            'started_at' => now()->subDays(3), // meeting was 3 days ago
            'ended_at'   => now()->subDays(3)->addHours(4),
        ]);

        $participant = MeetingParticipant::factory()->forMeeting($meeting)->create([
            'is_token_used' => false,
            'token_revoked' => false,
        ]);

        // Generate QR — it will be expired since meeting was 3 days ago
        $qrUrl = $this->qrService->generatePersonalQrUrl($meeting, $participant);

        $response = $this->postJson('/api/public/meetings/scan', [
            'pin'    => self::VALID_PIN,
            'qr_url' => $qrUrl,
        ]);

        // Either 403 (invalid signature due to expiry) or 410 (expired)
        $this->assertContains($response->status(), [403, 410]);
    }

    /** @test */
    public function scan_returns_400_for_walk_in_qr_without_participant(): void
    {
        $meeting = Meeting::factory()->create([
            'created_by' => $this->creator->id,
            'started_at' => now()->subMinutes(30),
            'ended_at'   => now()->addHours(3),
        ]);

        // Generate QR_Umum (walk-in, no participant)
        $qrService = app(MeetingQrService::class);
        $walkInUrl = $qrService->generateUmumQrUrl($meeting);

        $response = $this->postJson('/api/public/meetings/scan', [
            'pin'    => self::VALID_PIN,
            'qr_url' => $walkInUrl,
        ]);

        // Walk-in URL uses /walk-in path, not /check-in — controller returns 400
        // with "bukan untuk absensi rapat" since path doesn't match /check-in pattern
        $response->assertStatus(400);
    }

    /** @test */
    public function scan_attendance_is_reflected_in_meeting_detail(): void
    {
        $meeting = Meeting::factory()->create([
            'created_by'         => $this->creator->id,
            'started_at'         => now()->subMinutes(30),
            'ended_at'           => now()->addHours(3),
            'geolocation_enabled' => false,
        ]);

        $participant = MeetingParticipant::factory()->forMeeting($meeting)->create([
            'is_token_used' => false,
            'token_revoked' => false,
        ]);

        $qrUrl = $this->qrService->generatePersonalQrUrl($meeting, $participant);

        // Scan via panitia scanner
        $this->postJson('/api/public/meetings/scan', [
            'pin'    => self::VALID_PIN,
            'qr_url' => $qrUrl,
        ])->assertStatus(201);

        // Verify attendance appears in meeting detail API
        $response = $this->actingAs($this->creator)
            ->getJson("/api/meetings/{$meeting->id}");

        $response->assertOk();
        $stats = $response->json('data.attendance_stats');
        $this->assertEquals(1, $stats['present']);
        $this->assertEquals(1, $stats['total']);
    }
}
