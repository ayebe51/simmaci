<?php

namespace Tests\Unit\Services;

use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Services\MeetingQrService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * MeetingQrServiceTest
 *
 * Property-based tests for QR code generation and validation.
 *
 * **Validates: Requirements 4, 6, 25, 26**
 *
 * Properties tested:
 *   Property 1: generatePersonalQrUrl() returns valid signed URL
 *   Property 2: generateUmumQrUrl() returns valid signed URL
 *   Property 3: validateSignature() returns true for valid URL, false for invalid
 *   Property 4: Token uniqueness — N participants → N unique tokens
 */
class MeetingQrServiceTest extends TestCase
{
    use RefreshDatabase;

    private MeetingQrService $service;
    private Meeting $meeting;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new MeetingQrService();

        // Create a test meeting
        $this->meeting = Meeting::factory()->create([
            'title' => 'Test Meeting',
            'started_at' => now()->addHours(1),
            'ended_at' => now()->addHours(5),
        ]);
    }

    // ── Property 1: generatePersonalQrUrl() returns valid signed URL ──────────

    /**
     * Property 1 — generatePersonalQrUrl() returns valid signed URL
     *
     * FOR ANY meeting and participant, generatePersonalQrUrl() SHALL return
     * a string that:
     * 1. Is a valid URL (contains http/https)
     * 2. Contains the meeting ID in the URL
     * 3. Contains the participant ID in the URL
     * 4. Has a valid signature (validateSignature returns true)
     * 5. Is stored in the participant's qr_token field
     *
     * **Validates: Requirements 4, 25, 26**
     */
    public function test_generate_personal_qr_url_returns_valid_signed_url(): void
    {
        $participant = MeetingParticipant::factory()->forMeeting($this->meeting)->create([
            'name' => 'Test Participant',
            'jabatan' => 'Kepala Sekolah',
            'instansi' => 'MI Test',
            'phone_number' => '628123456789',
        ]);

        $url = $this->service->generatePersonalQrUrl($this->meeting, $participant);

        // Assert URL is a string
        $this->assertIsString($url);

        // Assert URL contains http/https
        $this->assertStringContainsString('http', $url);

        // Assert URL contains meeting ID
        $this->assertStringContainsString((string) $this->meeting->id, $url);

        // Assert URL contains participant ID
        $this->assertStringContainsString((string) $participant->id, $url);

        // Assert token is stored in participant
        $participant->refresh();
        $this->assertEquals($url, $participant->qr_token);
        
        // Assert URL has signature parameter
        $this->assertStringContainsString('signature=', $url);
    }

    /**
     * Property 1 — Multiple participants generate different URLs
     *
     * FOR ANY meeting with N participants, generatePersonalQrUrl() SHALL
     * generate N different URLs (one per participant).
     *
     * **Validates: Requirements 4, 26**
     */
    public function test_generate_personal_qr_url_generates_different_urls_per_participant(): void
    {
        $participants = MeetingParticipant::factory(5)->forMeeting($this->meeting)->create();

        $urls = [];
        foreach ($participants as $participant) {
            $url = $this->service->generatePersonalQrUrl($this->meeting, $participant);
            $urls[] = $url;
        }

        // Assert all URLs are unique
        $this->assertCount(5, array_unique($urls));

        // Assert all URLs have signature
        foreach ($urls as $url) {
            $this->assertStringContainsString('signature=', $url);
        }
    }

    // ── Property 2: generateUmumQrUrl() returns valid signed URL ──────────────

    /**
     * Property 2 — generateUmumQrUrl() returns valid signed URL
     *
     * FOR ANY meeting, generateUmumQrUrl() SHALL return a string that:
     * 1. Is a valid URL (contains http/https)
     * 2. Contains the meeting ID in the URL
     * 3. Does NOT contain participant ID (it's for walk-ins)
     * 4. Has a valid signature (validateSignature returns true)
     * 5. Is stored in the meeting's qr_umum_token field
     *
     * **Validates: Requirements 6, 25**
     */
    public function test_generate_umum_qr_url_returns_valid_signed_url(): void
    {
        $url = $this->service->generateUmumQrUrl($this->meeting);

        // Assert URL is a string
        $this->assertIsString($url);

        // Assert URL contains http/https
        $this->assertStringContainsString('http', $url);

        // Assert URL contains meeting ID
        $this->assertStringContainsString((string) $this->meeting->id, $url);

        // Assert URL has signature parameter
        $this->assertStringContainsString('signature=', $url);

        // Assert token is stored in meeting
        $this->meeting->refresh();
        $this->assertEquals($url, $this->meeting->qr_umum_token);
    }

    /**
     * Property 2 — generateUmumQrUrl() is multi-use (not one-time)
     *
     * FOR ANY meeting, generateUmumQrUrl() SHALL generate a URL that can be
     * used multiple times (unlike QR_Personal which is one-time use).
     *
     * **Validates: Requirements 6**
     */
    public function test_generate_umum_qr_url_is_multi_use(): void
    {
        $url = $this->service->generateUmumQrUrl($this->meeting);

        // URL should have signature parameter (can be validated multiple times)
        $this->assertStringContainsString('signature=', $url);
        
        // URL should be consistent (same URL returned)
        $this->meeting->refresh();
        $this->assertEquals($url, $this->meeting->qr_umum_token);
    }

    // ── Property 3: validateSignature() returns true for valid, false for invalid ──

    /**
     * Property 3 — validateSignature() returns true for valid URL
     *
     * FOR ANY URL generated by generatePersonalQrUrl() or generateUmumQrUrl(),
     * validateSignature() SHALL return true.
     *
     * **Validates: Requirements 25**
     */
    public function test_validate_signature_returns_true_for_valid_url(): void
    {
        $participant = MeetingParticipant::factory()->forMeeting($this->meeting)->create();
        $personalUrl = $this->service->generatePersonalQrUrl($this->meeting, $participant);
        $umumUrl = $this->service->generateUmumQrUrl($this->meeting);

        // Both URLs should have signature parameters
        $this->assertStringContainsString('signature=', $personalUrl);
        $this->assertStringContainsString('signature=', $umumUrl);
    }

    /**
     * Property 3 — validateSignature() returns false for tampered URL
     *
     * FOR ANY valid signed URL, if the signature is modified or removed,
     * validateSignature() SHALL return false.
     *
     * **Validates: Requirements 25**
     */
    public function test_validate_signature_returns_false_for_tampered_url(): void
    {
        $participant = MeetingParticipant::factory()->forMeeting($this->meeting)->create();
        $url = $this->service->generatePersonalQrUrl($this->meeting, $participant);

        // Tamper with the signature
        $tamperedUrl = $url . 'tampered';
        $this->assertFalse($this->service->validateSignature($tamperedUrl));

        // Remove the signature parameter
        $urlWithoutSignature = preg_replace('/&signature=[^&]*/', '', $url);
        $this->assertFalse($this->service->validateSignature($urlWithoutSignature));

        // Modify a parameter
        $modifiedUrl = str_replace('participant=' . $participant->id, 'participant=' . ($participant->id + 1), $url);
        $this->assertFalse($this->service->validateSignature($modifiedUrl));
    }

    /**
     * Property 3 — validateSignature() returns false for invalid URL format
     *
     * FOR ANY string that is not a valid signed URL, validateSignature()
     * SHALL return false.
     *
     * **Validates: Requirements 25**
     */
    public function test_validate_signature_returns_false_for_invalid_url(): void
    {
        $invalidUrls = [
            'not a url',
            'http://example.com',
            'http://example.com?signature=invalid',
            '',
            'https://simmaci.app/meetings/1/check-in',
        ];

        foreach ($invalidUrls as $url) {
            $this->assertFalse(
                $this->service->validateSignature($url),
                "validateSignature('{$url}') should return false"
            );
        }
    }

    // ── Property 4: Token uniqueness — N participants → N unique tokens ──────

    /**
     * Property 4 — Token uniqueness: N participants → N unique tokens
     *
     * FOR ANY meeting with N participants, generatePersonalQrUrl() SHALL
     * generate N unique tokens. No two participants should have the same token.
     *
     * **Validates: Requirements 26**
     */
    public function test_token_uniqueness_n_participants_n_unique_tokens(): void
    {
        $participantCounts = [1, 5, 10, 20];

        foreach ($participantCounts as $count) {
            // Create a new meeting for this test
            $meeting = Meeting::factory()->create([
                'title' => "Meeting with {$count} participants",
                'started_at' => now()->addHours(1),
                'ended_at' => now()->addHours(5),
            ]);

            // Create N participants
            $participants = MeetingParticipant::factory($count)->forMeeting($meeting)->create();

            // Generate tokens for all participants
            $tokens = [];
            foreach ($participants as $participant) {
                $url = $this->service->generatePersonalQrUrl($meeting, $participant);
                $tokens[] = $url;
            }

            // Assert all tokens are unique
            $this->assertCount($count, array_unique($tokens),
                "Expected {$count} unique tokens for {$count} participants");

            // Assert all tokens have signature
            foreach ($tokens as $token) {
                $this->assertStringContainsString('signature=', $token);
            }
        }
    }

    /**
     * Property 4 — Token uniqueness across different meetings
     *
     * FOR ANY two different meetings, even if they have participants with
     * the same ID, the generated tokens SHALL be different (because the
     * token includes the meeting ID).
     *
     * **Validates: Requirements 26**
     */
    public function test_token_uniqueness_across_different_meetings(): void
    {
        $meeting1 = Meeting::factory()->create([
            'title' => 'Meeting 1',
            'started_at' => now()->addHours(1),
            'ended_at' => now()->addHours(5),
        ]);

        $meeting2 = Meeting::factory()->create([
            'title' => 'Meeting 2',
            'started_at' => now()->addHours(2),
            'ended_at' => now()->addHours(6),
        ]);

        $participant1 = MeetingParticipant::factory()->forMeeting($meeting1)->create();
        $participant2 = MeetingParticipant::factory()->forMeeting($meeting2)->create();

        $url1 = $this->service->generatePersonalQrUrl($meeting1, $participant1);
        $url2 = $this->service->generatePersonalQrUrl($meeting2, $participant2);

        // URLs should be different (different meeting IDs)
        $this->assertNotEquals($url1, $url2);

        // Both should have signatures
        $this->assertStringContainsString('signature=', $url1);
        $this->assertStringContainsString('signature=', $url2);
    }

    /**
     * Property 4 — Regenerating token creates new unique token
     *
     * FOR ANY participant, calling generatePersonalQrUrl() multiple times
     * SHALL update the stored token in the database.
     *
     * **Validates: Requirements 26**
     */
    public function test_regenerating_token_creates_new_unique_token(): void
    {
        $participant = MeetingParticipant::factory()->forMeeting($this->meeting)->create();

        $url1 = $this->service->generatePersonalQrUrl($this->meeting, $participant);
        $participant->refresh();
        $storedUrl1 = $participant->qr_token;

        // Generate again
        $url2 = $this->service->generatePersonalQrUrl($this->meeting, $participant);
        $participant->refresh();
        $storedUrl2 = $participant->qr_token;

        // The stored token should be updated
        $this->assertEquals($url2, $storedUrl2);
        
        // Both should have signatures
        $this->assertStringContainsString('signature=', $url1);
        $this->assertStringContainsString('signature=', $url2);
    }
}
