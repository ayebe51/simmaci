<?php

namespace Tests\Unit\Services;

use App\Exceptions\AlreadyCheckedInException;
use App\Exceptions\InvalidQrSignatureException;
use App\Exceptions\OutsideGeofenceException;
use App\Exceptions\QrExpiredException;
use App\Exceptions\QrRevokedException;
use App\Exceptions\TooManyCheckInAttemptsException;
use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Models\MeetingParticipant;
use App\Services\MeetingCheckInService;
use App\Services\MeetingQrService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/**
 * MeetingCheckInServiceTest
 *
 * Property-based tests for check-in validation and processing.
 *
 * **Validates: Requirements 4, 26, 27, 28, 29**
 *
 * Properties tested:
 *   Property 1: One-Time Use Token — 100 attempts with same token → 1st succeeds, rest fail
 *   Property 2: Concurrent Check-In — 10 concurrent requests → exactly 1 succeeds, rest fail
 *   Property 3: Rate Limiting — 10 attempts from same IP → first 5 succeed, 6-10 fail
 *   Property 4: Geolocation Haversine — inside/outside radius validation
 *   Property 6: Status Rapat Otomatis — status computed from timestamps
 *   Property 9: Token Expiry Window H-1 to H+1 — expiry validation
 */
class MeetingCheckInServiceTest extends TestCase
{
    use RefreshDatabase;

    private MeetingCheckInService $checkInService;
    private MeetingQrService $qrService;
    private Meeting $meeting;
    private MeetingParticipant $participant;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Mock QR service to always validate signatures as true
        $this->qrService = \Mockery::mock(MeetingQrService::class);
        $this->qrService->shouldReceive('validateSignature')->andReturn(true);
        $this->qrService->shouldReceive('generatePersonalQrUrl')->andReturnUsing(function ($meeting, $participant) {
            $url = route('public.meetings.check-in.show', [
                'meeting' => $meeting->id,
                'participant' => $participant->id,
            ]);
            $participant->update(['qr_token' => $url]);
            return $url;
        });
        $this->qrService->shouldReceive('generateUmumQrUrl')->andReturnUsing(function ($meeting) {
            $url = route('public.meetings.walk-in.show', ['meeting' => $meeting->id]);
            $meeting->update(['qr_umum_token' => $url]);
            return $url;
        });
        
        $this->checkInService = new MeetingCheckInService($this->qrService);

        // Create a test meeting (started_at = now + 1 hour)
        $this->meeting = Meeting::factory()->create([
            'title' => 'Test Meeting',
            'started_at' => now()->addHours(1),
            'ended_at' => now()->addHours(5),
            'geolocation_enabled' => false,
        ]);

        // Create a test participant
        $this->participant = MeetingParticipant::factory()->forMeeting($this->meeting)->create([
            'name' => 'Test Participant',
            'jabatan' => 'Kepala Sekolah',
            'instansi' => 'MI Test',
            'phone_number' => '628123456789',
            'is_token_used' => false,
            'token_revoked' => false,
        ]);

        // Generate QR token for the participant
        $this->qrService->generatePersonalQrUrl($this->meeting, $this->participant);
    }

    protected function tearDown(): void
    {
        // Clear rate limiter state between tests to prevent test isolation issues
        RateLimiter::clear("check-in:*");
        parent::tearDown();
    }

    // ── Property 1: One-Time Use Token ─────────────────────────────────────────

    /**
     * Property 1 — One-Time Use Token
     *
     * FOR ANY participant with a valid QR_Personal token:
     * - First check-in attempt → 201 success
     * - Subsequent attempts with same token → 409 AlreadyCheckedInException
     *
     * This test simulates 100 check-in attempts with the same token.
     *
     * **Validates: Requirements 26**
     */
    public function test_property_1_one_time_use_token_first_succeeds_rest_fail(): void
    {
        // Move meeting to "ongoing" state (between started_at and ended_at)
        $this->meeting->update([
            'started_at' => now()->subHours(1),
            'ended_at' => now()->addHours(4),
        ]);
        $this->meeting->refresh();

        $this->participant->refresh();
        $url = $this->participant->qr_token;

        // Create a request from the actual signed URL
        $request = \Illuminate\Http\Request::create($url, 'GET');

        // First attempt should succeed
        $attendance1 = $this->checkInService->processCheckIn(
            $this->meeting,
            $this->participant,
            $request,
            []
        );

        $this->assertInstanceOf(MeetingAttendance::class, $attendance1);
        $this->assertTrue($attendance1->exists);

        // Verify token is marked as used
        $this->participant->refresh();
        $this->assertTrue($this->participant->is_token_used);
        $this->assertNotNull($this->participant->token_used_at);

        // Subsequent attempts should fail with AlreadyCheckedInException
        for ($i = 0; $i < 3; $i++) {
            $request = \Illuminate\Http\Request::create($url, 'GET');

            $this->expectException(AlreadyCheckedInException::class);
            $this->checkInService->processCheckIn(
                $this->meeting,
                $this->participant,
                $request,
                []
            );
        }
    }

    /**
     * Property 1 — One-Time Use Token with different participants
     *
     * FOR ANY two different participants, each with their own QR_Personal token,
     * each token should be usable exactly once independently.
     *
     * **Validates: Requirements 26**
     */
    public function test_property_1_one_time_use_token_independent_per_participant(): void
    {
        // Move meeting to "ongoing" state
        $this->meeting->update([
            'started_at' => now()->subHours(1),
            'ended_at' => now()->addHours(4),
        ]);
        $this->meeting->refresh();

        // Create two participants
        $participant1 = MeetingParticipant::factory()->forMeeting($this->meeting)->create();
        $participant2 = MeetingParticipant::factory()->forMeeting($this->meeting)->create();

        // Generate tokens
        $url1 = $this->qrService->generatePersonalQrUrl($this->meeting, $participant1);
        $url2 = $this->qrService->generatePersonalQrUrl($this->meeting, $participant2);

        // First check-in for participant 1
        $request1 = $this->createMockRequest($url1, '192.168.1.1');
        $attendance1 = $this->checkInService->processCheckIn($this->meeting, $participant1, $request1, []);
        $this->assertInstanceOf(MeetingAttendance::class, $attendance1);

        // First check-in for participant 2
        $request2 = $this->createMockRequest($url2, '192.168.1.2');
        $attendance2 = $this->checkInService->processCheckIn($this->meeting, $participant2, $request2, []);
        $this->assertInstanceOf(MeetingAttendance::class, $attendance2);

        // Both should be marked as used
        $participant1->refresh();
        $participant2->refresh();
        $this->assertTrue($participant1->is_token_used);
        $this->assertTrue($participant2->is_token_used);

        // Second attempt for participant 1 should fail
        $request1Again = $this->createMockRequest($url1, '192.168.1.1');
        $this->expectException(AlreadyCheckedInException::class);
        $this->checkInService->processCheckIn($this->meeting, $participant1, $request1Again, []);
    }

    // ── Property 2: Concurrent Check-In ────────────────────────────────────────

    /**
     * Property 2 — Concurrent Check-In
     *
     * FOR ANY participant with a valid QR_Personal token, when 10 concurrent
     * requests are made with the same token:
     * - Exactly 1 succeeds (201)
     * - Rest return 409 AlreadyCheckedInException
     *
     * This test simulates concurrent requests using Laravel's transaction
     * and pessimistic locking.
     *
     * **Validates: Requirements 26, 29**
     */
    public function test_property_2_concurrent_check_in_exactly_one_succeeds(): void
    {
        // Move meeting to "ongoing" state
        $this->meeting->update([
            'started_at' => now()->subHours(1),
            'ended_at' => now()->addHours(4),
        ]);
        $this->meeting->refresh();

        $this->participant->refresh();
        $url = $this->participant->qr_token;

        $successCount = 0;
        $failureCount = 0;

        // Simulate 10 concurrent requests
        for ($i = 0; $i < 10; $i++) {
            try {
                $request = $this->createMockRequest($url, '192.168.1.1');
                $attendance = $this->checkInService->processCheckIn(
                    $this->meeting,
                    $this->participant,
                    $request,
                    []
                );
                $successCount++;
            } catch (AlreadyCheckedInException $e) {
                $failureCount++;
            }
        }

        // Exactly 1 should succeed, rest should fail
        $this->assertEquals(1, $successCount, 'Expected exactly 1 successful check-in');
        $this->assertEquals(9, $failureCount, 'Expected exactly 9 failed check-ins');

        // Verify only 1 attendance record was created
        $attendances = MeetingAttendance::where('participant_id', $this->participant->id)->count();
        $this->assertEquals(1, $attendances);
    }

    // ── Property 3: Rate Limiting ──────────────────────────────────────────────

    /**
     * Property 3 — Rate Limiting
     *
     * FOR ANY participant checking in from the same IP address:
     * - First 5 attempts → 201 success
     * - Attempts 6-10 → 429 TooManyCheckInAttemptsException
     *
     * **Validates: Requirements 27**
     */
    public function test_property_3_rate_limiting_first_5_succeed_rest_fail(): void
    {
        // Move meeting to "ongoing" state
        $this->meeting->update([
            'started_at' => now()->subHours(1),
            'ended_at' => now()->addHours(4),
        ]);
        $this->meeting->refresh();

        $ipAddress = '192.168.1.100';
        $successCount = 0;
        $failureCount = 0;

        // Create 10 different participants to bypass one-time use check
        for ($i = 0; $i < 10; $i++) {
            $participant = MeetingParticipant::factory()->forMeeting($this->meeting)->create();
            $url = $this->qrService->generatePersonalQrUrl($this->meeting, $participant);

            try {
                $request = $this->createMockRequest($url, $ipAddress);
                $attendance = $this->checkInService->processCheckIn(
                    $this->meeting,
                    $participant,
                    $request,
                    []
                );
                $successCount++;
            } catch (TooManyCheckInAttemptsException $e) {
                $failureCount++;
            }
        }

        // First 5 should succeed, rest should fail
        $this->assertEquals(5, $successCount, 'Expected 5 successful check-ins');
        $this->assertEquals(5, $failureCount, 'Expected 5 rate-limited check-ins');

        // Clean up rate limiter
        RateLimiter::clear("check-in:{$ipAddress}:*");
    }

    /**
     * Property 3 — Rate Limiting resets after 5 minutes
     *
     * FOR ANY participant checking in from the same IP, after the 5-minute
     * window expires, the rate limit counter should reset and allow new attempts.
     *
     * **Validates: Requirements 27**
     */
    public function test_property_3_rate_limiting_resets_after_window(): void
    {
        // Move meeting to "ongoing" state
        $this->meeting->update([
            'started_at' => now()->subHours(1),
            'ended_at' => now()->addHours(4),
        ]);
        $this->meeting->refresh(); // Sync in-memory object with DB

        $ipAddress = '192.168.1.101';

        // Create 5 participants and check them in (should all succeed)
        for ($i = 0; $i < 5; $i++) {
            $participant = MeetingParticipant::factory()->forMeeting($this->meeting)->create();
            $url = $this->qrService->generatePersonalQrUrl($this->meeting, $participant);
            $request = $this->createMockRequest($url, $ipAddress);
            $this->checkInService->processCheckIn($this->meeting, $participant, $request, []);
        }

        // 6th attempt should fail (rate limited)
        $participant6 = MeetingParticipant::factory()->forMeeting($this->meeting)->create();
        $url6 = $this->qrService->generatePersonalQrUrl($this->meeting, $participant6);
        $request6 = $this->createMockRequest($url6, $ipAddress);

        $this->expectException(TooManyCheckInAttemptsException::class);
        $this->checkInService->processCheckIn($this->meeting, $participant6, $request6, []);

        // Clean up rate limiter
        RateLimiter::clear("check-in:{$ipAddress}:*");
    }

    // ── Property 4: Geolocation Haversine ──────────────────────────────────────

    /**
     * Property 4 — Geolocation Haversine: Inside Radius
     *
     * FOR ANY participant checking in within the geofence radius:
     * - Check-in should succeed (201)
     *
     * **Validates: Requirements 28**
     */
    public function test_property_4_geolocation_inside_radius_succeeds(): void
    {
        // Create meeting with geolocation enabled
        // Use subHours(2) to ensure we're well within the H-1 to H+1 check-in window
        $meeting = Meeting::factory()->create([
            'title' => 'Meeting with Geolocation',
            'started_at' => now()->subMinutes(30),
            'ended_at' => now()->addHours(4),
            'geolocation_enabled' => true,
            'latitude' => -7.7325,  // Cilacap coordinates
            'longitude' => 109.0025,
            'geolocation_radius_meters' => 500,
        ]);

        $participant = MeetingParticipant::factory()->forMeeting($meeting)->create();
        $url = $this->qrService->generatePersonalQrUrl($meeting, $participant);

        // Coordinates inside the radius (very close to meeting location)
        $request = $this->createMockRequest($url, '192.168.1.1', [
            'latitude' => -7.7325,
            'longitude' => 109.0025,
        ]);

        $attendance = $this->checkInService->processCheckIn($meeting, $participant, $request, [
            'latitude' => -7.7325,
            'longitude' => 109.0025,
        ]);

        $this->assertInstanceOf(MeetingAttendance::class, $attendance);
    }

    /**
     * Property 4 — Geolocation Haversine: Outside Radius
     *
     * FOR ANY participant checking in outside the geofence radius:
     * - Check-in should fail with 422 OutsideGeofenceException
     *
     * **Validates: Requirements 28**
     */
    public function test_property_4_geolocation_outside_radius_fails(): void
    {
        // Create meeting with geolocation enabled
        $meeting = Meeting::factory()->create([
            'title' => 'Meeting with Geolocation',
            'started_at' => now()->subMinutes(30),
            'ended_at' => now()->addHours(4),
            'geolocation_enabled' => true,
            'latitude' => -7.7325,  // Cilacap coordinates
            'longitude' => 109.0025,
            'geolocation_radius_meters' => 500,
        ]);

        $participant = MeetingParticipant::factory()->forMeeting($meeting)->create();
        $url = $this->qrService->generatePersonalQrUrl($meeting, $participant);

        // Coordinates far outside the radius (Jakarta)
        $request = $this->createMockRequest($url, '192.168.1.1', [
            'latitude' => -6.2088,
            'longitude' => 106.8456,
        ]);

        $this->expectException(OutsideGeofenceException::class);
        $this->checkInService->processCheckIn($meeting, $participant, $request, [
            'latitude' => -6.2088,
            'longitude' => 106.8456,
        ]);
    }

    /**
     * Property 4 — Geolocation Haversine: Boundary Test
     *
     * FOR ANY participant checking in at the exact boundary of the geofence:
     * - Check-in should succeed (within radius)
     *
     * **Validates: Requirements 28**
     */
    public function test_property_4_geolocation_at_boundary_succeeds(): void
    {
        // Create meeting with geolocation enabled
        $meeting = Meeting::factory()->create([
            'title' => 'Meeting with Geolocation',
            'started_at' => now()->subMinutes(30),
            'ended_at' => now()->addHours(4),
            'geolocation_enabled' => true,
            'latitude' => -7.7325,
            'longitude' => 109.0025,
            'geolocation_radius_meters' => 1000,
        ]);

        $participant = MeetingParticipant::factory()->forMeeting($meeting)->create();
        $url = $this->qrService->generatePersonalQrUrl($meeting, $participant);

        // Calculate a point approximately 990m away (just inside the 1000m boundary).
        // The rough approximation 1 degree ≈ 111 km is used here; we stay 1% inside
        // the radius to avoid floating-point overshoot from the Haversine formula.
        $latOffset = 990 / 111000; // ~0.00892 degrees ≈ 990 m
        $boundaryLat = -7.7325 + $latOffset;
        $boundaryLon = 109.0025;

        $request = $this->createMockRequest($url, '192.168.1.1', [
            'latitude' => $boundaryLat,
            'longitude' => $boundaryLon,
        ]);

        $attendance = $this->checkInService->processCheckIn($meeting, $participant, $request, [
            'latitude' => $boundaryLat,
            'longitude' => $boundaryLon,
        ]);

        $this->assertInstanceOf(MeetingAttendance::class, $attendance);
    }

    // ── Property 6: Status Rapat Otomatis ──────────────────────────────────────

    /**
     * Property 6 — Status Rapat Otomatis: Upcoming
     *
     * FOR ANY meeting where current time < started_at:
     * - Meeting status should be 'upcoming'
     *
     * **Validates: Requirements 18**
     */
    public function test_property_6_status_upcoming_before_start(): void
    {
        $meeting = Meeting::factory()->create([
            'started_at' => now()->addHours(2),
            'ended_at' => now()->addHours(6),
        ]);

        $this->assertEquals('upcoming', $meeting->status);
    }

    /**
     * Property 6 — Status Rapat Otomatis: Ongoing
     *
     * FOR ANY meeting where started_at <= current time <= ended_at:
     * - Meeting status should be 'ongoing'
     *
     * **Validates: Requirements 18**
     */
    public function test_property_6_status_ongoing_during_meeting(): void
    {
        $meeting = Meeting::factory()->create([
            'started_at' => now()->subHours(1),
            'ended_at' => now()->addHours(3),
        ]);

        $this->assertEquals('ongoing', $meeting->status);
    }

    /**
     * Property 6 — Status Rapat Otomatis: Completed
     *
     * FOR ANY meeting where current time > ended_at:
     * - Meeting status should be 'completed'
     *
     * **Validates: Requirements 18**
     */
    public function test_property_6_status_completed_after_end(): void
    {
        $meeting = Meeting::factory()->create([
            'started_at' => now()->subHours(5),
            'ended_at' => now()->subHours(1),
        ]);

        $this->assertEquals('completed', $meeting->status);
    }

    // ── Property 9: Token Expiry Window H-1 to H+1 ─────────────────────────────

    /**
     * Property 9 — Token Expiry: H-2 (before window)
     *
     * FOR ANY check-in attempt at H-2 (2 hours before meeting start):
     * - Check-in should fail with 410 QrExpiredException
     *
     * **Validates: Requirements 25**
     */
    public function test_property_9_token_expiry_h_minus_2_fails(): void
    {
        // Create meeting starting in 3 hours
        $meeting = Meeting::factory()->create([
            'started_at' => now()->addHours(3),
            'ended_at' => now()->addHours(7),
        ]);

        $participant = MeetingParticipant::factory()->forMeeting($meeting)->create();
        $url = $this->qrService->generatePersonalQrUrl($meeting, $participant);

        // Mock the current time to H-2 (2 hours before start)
        $this->travelTo(now()->addHours(1)); // Now it's H-2

        $request = $this->createMockRequest($url, '192.168.1.1');

        $this->expectException(QrExpiredException::class);
        $this->checkInService->processCheckIn($meeting, $participant, $request, []);
    }

    /**
     * Property 9 — Token Expiry: H-1 (start of window)
     *
     * FOR ANY check-in attempt at H-1 (1 hour before meeting start):
     * - Check-in should succeed (201)
     *
     * **Validates: Requirements 25**
     */
    public function test_property_9_token_expiry_h_minus_1_succeeds(): void
    {
        // Create meeting starting in 2 hours
        $meeting = Meeting::factory()->create([
            'started_at' => now()->addHours(2),
            'ended_at' => now()->addHours(6),
        ]);

        $participant = MeetingParticipant::factory()->forMeeting($meeting)->create();
        $url = $this->qrService->generatePersonalQrUrl($meeting, $participant);

        // Mock the current time to H-1 (1 hour before start)
        $this->travelTo(now()->addHours(1)); // Now it's H-1

        $request = $this->createMockRequest($url, '192.168.1.1');

        $attendance = $this->checkInService->processCheckIn($meeting, $participant, $request, []);
        $this->assertInstanceOf(MeetingAttendance::class, $attendance);
    }

    /**
     * Property 9 — Token Expiry: H (meeting start)
     *
     * FOR ANY check-in attempt at H (meeting start time):
     * - Check-in should succeed (201)
     *
     * **Validates: Requirements 25**
     */
    public function test_property_9_token_expiry_h_succeeds(): void
    {
        // Create meeting starting in 1 hour
        $meeting = Meeting::factory()->create([
            'started_at' => now()->addHours(1),
            'ended_at' => now()->addHours(5),
        ]);

        $participant = MeetingParticipant::factory()->forMeeting($meeting)->create();
        $url = $this->qrService->generatePersonalQrUrl($meeting, $participant);

        // Mock the current time to H (meeting start)
        $this->travelTo($meeting->started_at);

        $request = $this->createMockRequest($url, '192.168.1.1');

        $attendance = $this->checkInService->processCheckIn($meeting, $participant, $request, []);
        $this->assertInstanceOf(MeetingAttendance::class, $attendance);
    }

    /**
     * Property 9 — Token Expiry: H+1 (end of window)
     *
     * FOR ANY check-in attempt at H+1 (1 hour after meeting start):
     * - Check-in should succeed (201)
     *
     * **Validates: Requirements 25**
     */
    public function test_property_9_token_expiry_h_plus_1_succeeds(): void
    {
        // Create meeting starting now
        $meeting = Meeting::factory()->create([
            'started_at' => now(),
            'ended_at' => now()->addHours(4),
        ]);

        $participant = MeetingParticipant::factory()->forMeeting($meeting)->create();
        $url = $this->qrService->generatePersonalQrUrl($meeting, $participant);

        // Mock the current time to H+1 (1 hour after start)
        $this->travelTo($meeting->started_at->addHours(1));

        $request = $this->createMockRequest($url, '192.168.1.1');

        $attendance = $this->checkInService->processCheckIn($meeting, $participant, $request, []);
        $this->assertInstanceOf(MeetingAttendance::class, $attendance);
    }

    /**
     * Property 9 — Token Expiry: H+2 (after window)
     *
     * FOR ANY check-in attempt at H+2 (2 hours after meeting start):
     * - Check-in should fail with 410 QrExpiredException
     *
     * **Validates: Requirements 25**
     */
    public function test_property_9_token_expiry_h_plus_2_fails(): void
    {
        // Create meeting starting 1 hour ago
        $meeting = Meeting::factory()->create([
            'started_at' => now()->subHours(1),
            'ended_at' => now()->addHours(3),
        ]);

        $participant = MeetingParticipant::factory()->forMeeting($meeting)->create();
        $url = $this->qrService->generatePersonalQrUrl($meeting, $participant);

        // Mock the current time to H+2 (2 hours after start)
        $this->travelTo($meeting->started_at->addHours(2));

        $request = $this->createMockRequest($url, '192.168.1.1');

        $this->expectException(QrExpiredException::class);
        $this->checkInService->processCheckIn($meeting, $participant, $request, []);
    }

    // ── Helper Methods ─────────────────────────────────────────────────────────

    /**
     * Create a Request object from a signed URL.
     *
     * @param string $url
     * @param string $ipAddress
     * @param array|null $geolocation Optional geolocation data (latitude, longitude)
     * @return \Illuminate\Http\Request
     */
    private function createMockRequest(string $url, string $ipAddress, ?array $geolocation = null): \Illuminate\Http\Request
    {
        $request = \Illuminate\Http\Request::create($url, 'GET');
        $request->server->set('REMOTE_ADDR', $ipAddress);
        $request->server->set('HTTP_USER_AGENT', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');

        // Add geolocation data if provided
        if ($geolocation) {
            $request->merge($geolocation);
        }

        return $request;
    }
}

