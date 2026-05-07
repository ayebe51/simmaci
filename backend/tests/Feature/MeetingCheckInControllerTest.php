<?php

namespace Tests\Feature;

use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Models\MeetingParticipant;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

/**
 * MeetingCheckInControllerTest
 *
 * Integration tests for public check-in endpoints (no authentication required).
 * Requirements: Req 4, 5, 6, 25, 26, 27, 28, 29
 */
class MeetingCheckInControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private Meeting $meeting;
    private MeetingParticipant $participant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::factory()->create(['role' => 'super_admin']);

        $this->meeting = Meeting::factory()->create([
            'created_by' => $this->superAdmin->id,
            'started_at' => now()->addDays(1),
            'ended_at' => now()->addDays(1)->addHours(2),
            'geolocation_enabled' => false,
        ]);

        $this->participant = MeetingParticipant::factory()->create([
            'meeting_id' => $this->meeting->id,
            'participant_type' => 'external',
            'is_token_used' => false,
        ]);
    }

    // ── Show Check-In Page Tests ──────────────────────────────────────────────

    /**
     * Test show endpoint returns meeting info for valid signed URL
     */
    public function test_show_returns_meeting_info_for_valid_signed_url(): void
    {
        $url = URL::temporarySignedRoute(
            'public.meetings.check-in.show',
            now()->addHours(25),
            [
                'meeting' => $this->meeting->id,
                'participant' => $this->participant->id,
            ]
        );

        // Extract query string
        $parts = parse_url($url);
        parse_str($parts['query'], $query);

        $response = $this->getJson("/api/public/meetings/{$this->meeting->id}/check-in?" . http_build_query($query));

        $response->assertOk();
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'meeting' => ['id', 'title'],
                'participant' => ['id', 'name'],
                'mode',
            ],
        ]);
    }

    /**
     * Test show endpoint rejects invalid signature
     */
    public function test_show_rejects_invalid_signature(): void
    {
        $response = $this->getJson("/api/public/meetings/{$this->meeting->id}/check-in?signature=invalid");

        $response->assertForbidden();
        $response->assertJsonFragment(['message' => 'QR Code tidak valid atau telah dimodifikasi.']);
    }

    // ── Check-In Tests ───────────────────────────────────────────────────────

    /**
     * Test successful check-in creates attendance record
     */
    public function test_successful_check_in_creates_attendance_record(): void
    {
        $url = URL::temporarySignedRoute(
            'public.meetings.check-in.show',
            now()->addHours(25),
            [
                'meeting' => $this->meeting->id,
                'participant' => $this->participant->id,
            ]
        );

        $parts = parse_url($url);
        parse_str($parts['query'], $query);

        $response = $this->postJson(
            "/api/public/meetings/{$this->meeting->id}/check-in?" . http_build_query($query),
            [
                'is_delegation' => false,
            ]
        );

        $response->assertCreated();
        $this->assertDatabaseHas('meeting_attendances', [
            'meeting_id' => $this->meeting->id,
            'participant_id' => $this->participant->id,
            'attendance_type' => 'qr_personal',
        ]);

        // Verify token is marked as used
        $this->assertTrue($this->participant->fresh()->is_token_used);
    }

    /**
     * Test check-in rejects already checked-in participant
     */
    public function test_check_in_rejects_already_checked_in_participant(): void
    {
        // First check-in
        $this->participant->update(['is_token_used' => true, 'token_used_at' => now()]);

        $url = URL::temporarySignedRoute(
            'public.meetings.check-in.show',
            now()->addHours(25),
            [
                'meeting' => $this->meeting->id,
                'participant' => $this->participant->id,
            ]
        );

        $parts = parse_url($url);
        parse_str($parts['query'], $query);

        $response = $this->postJson(
            "/api/public/meetings/{$this->meeting->id}/check-in?" . http_build_query($query),
            [
                'is_delegation' => false,
            ]
        );

        $response->assertConflict();
        $response->assertJsonFragment(['message' => 'Anda sudah check-in pada']);
    }

    /**
     * Test check-in rejects revoked token
     */
    public function test_check_in_rejects_revoked_token(): void
    {
        $this->participant->update(['token_revoked' => true]);

        $url = URL::temporarySignedRoute(
            'public.meetings.check-in.show',
            now()->addHours(25),
            [
                'meeting' => $this->meeting->id,
                'participant' => $this->participant->id,
            ]
        );

        $parts = parse_url($url);
        parse_str($parts['query'], $query);

        $response = $this->postJson(
            "/api/public/meetings/{$this->meeting->id}/check-in?" . http_build_query($query),
            [
                'is_delegation' => false,
            ]
        );

        $response->assertStatus(410);
        $response->assertJsonFragment(['message' => 'QR Code sudah tidak berlaku.']);
    }

    // ── Walk-In Tests ────────────────────────────────────────────────────────

    /**
     * Test walk-in check-in creates attendance record
     */
    public function test_walk_in_check_in_creates_attendance_record(): void
    {
        $url = URL::temporarySignedRoute(
            'public.meetings.walk-in.show',
            now()->addHours(25),
            [
                'meeting' => $this->meeting->id,
            ]
        );

        $parts = parse_url($url);
        parse_str($parts['query'], $query);

        $response = $this->postJson(
            "/api/public/meetings/{$this->meeting->id}/walk-in?" . http_build_query($query),
            [
                'walk_in_name' => 'Peserta Walk-in',
                'walk_in_jabatan' => 'Guru',
                'walk_in_instansi' => 'MI Test',
                'walk_in_phone' => '081234567890',
            ]
        );

        $response->assertCreated();
        $this->assertDatabaseHas('meeting_attendances', [
            'meeting_id' => $this->meeting->id,
            'attendance_type' => 'qr_umum',
            'walk_in_name' => 'Peserta Walk-in',
        ]);
    }

    /**
     * Test walk-in validation requires all fields
     */
    public function test_walk_in_validation_requires_all_fields(): void
    {
        $url = URL::temporarySignedRoute(
            'public.meetings.walk-in.show',
            now()->addHours(25),
            [
                'meeting' => $this->meeting->id,
            ]
        );

        $parts = parse_url($url);
        parse_str($parts['query'], $query);

        $response = $this->postJson(
            "/api/public/meetings/{$this->meeting->id}/walk-in?" . http_build_query($query),
            [
                'walk_in_name' => 'Peserta Walk-in',
                // Missing other fields
            ]
        );

        $response->assertUnprocessable();
    }

    // ── Phone Number Normalization Tests ──────────────────────────────────────

    /**
     * Test phone number normalization in walk-in
     */
    public function test_phone_number_normalization_in_walk_in(): void
    {
        $url = URL::temporarySignedRoute(
            'public.meetings.walk-in.show',
            now()->addHours(25),
            [
                'meeting' => $this->meeting->id,
            ]
        );

        $parts = parse_url($url);
        parse_str($parts['query'], $query);

        $response = $this->postJson(
            "/api/public/meetings/{$this->meeting->id}/walk-in?" . http_build_query($query),
            [
                'walk_in_name' => 'Test',
                'walk_in_jabatan' => 'Test',
                'walk_in_instansi' => 'Test',
                'walk_in_phone' => '0812-3456-7890', // With dashes
            ]
        );

        $response->assertCreated();
        $this->assertDatabaseHas('meeting_attendances', [
            'walk_in_phone' => '6281234567890', // Normalized
        ]);
    }

    // ── Authentication Tests ──────────────────────────────────────────────────

    /**
     * Test check-in endpoint doesn't require authentication
     */
    public function test_check_in_endpoint_does_not_require_authentication(): void
    {
        $url = URL::temporarySignedRoute(
            'public.meetings.check-in.show',
            now()->addHours(25),
            [
                'meeting' => $this->meeting->id,
                'participant' => $this->participant->id,
            ]
        );

        $parts = parse_url($url);
        parse_str($parts['query'], $query);

        // No authentication token provided
        $response = $this->postJson(
            "/api/public/meetings/{$this->meeting->id}/check-in?" . http_build_query($query),
            [
                'is_delegation' => false,
            ]
        );

        // Should succeed (or fail for other reasons, but not 401)
        $this->assertNotEquals(401, $response->getStatusCode());
    }
}
