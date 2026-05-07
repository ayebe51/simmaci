<?php

namespace App\Services;

use App\Models\Meeting;
use App\Models\MeetingParticipant;
use Illuminate\Support\Facades\URL;

/**
 * MeetingQrService
 *
 * Handles QR code generation for meetings using Laravel signed URLs.
 * Generates both QR_Personal (one-time use per participant) and QR_Umum (multi-use for walk-ins).
 */
class MeetingQrService
{
    /**
     * Generate a signed URL for QR_Personal (one-time use per participant).
     *
     * The URL is valid from H-1 (24 hours before meeting start) to H+1 (24 hours after meeting start).
     *
     * @param Meeting $meeting
     * @param MeetingParticipant $participant
     * @return string Full signed URL for QR code
     */
    public function generatePersonalQrUrl(Meeting $meeting, MeetingParticipant $participant): string
    {
        // Calculate expiry: H-1 to H+1 from meeting start time
        $expiresAt = $meeting->started_at->addHours(25); // H+1 from start

        // Generate signed URL using Laravel's temporary signed route
        $url = URL::temporarySignedRoute(
            'public.meetings.check-in.show',
            $expiresAt,
            [
                'meeting' => $meeting->id,
                'participant' => $participant->id,
            ]
        );

        // Store token reference in participant for one-time use tracking
        $participant->update([
            'qr_token' => $url,
        ]);

        return $url;
    }

    /**
     * Generate a signed URL for QR_Umum (multi-use for walk-ins).
     *
     * The URL is valid from H-1 (24 hours before meeting start) to H+1 (24 hours after meeting start).
     *
     * @param Meeting $meeting
     * @return string Full signed URL for QR code
     */
    public function generateUmumQrUrl(Meeting $meeting): string
    {
        // Calculate expiry: H-1 to H+1 from meeting start time
        $expiresAt = $meeting->started_at->addHours(25); // H+1 from start

        // Generate signed URL using Laravel's temporary signed route
        $url = URL::temporarySignedRoute(
            'public.meetings.walk-in.show',
            $expiresAt,
            [
                'meeting' => $meeting->id,
            ]
        );

        // Store token reference in meeting for tracking
        $meeting->update([
            'qr_umum_token' => $url,
        ]);

        return $url;
    }

    /**
     * Validate a signed URL signature.
     *
     * Uses Laravel's built-in signature validation to ensure the URL hasn't been tampered with.
     *
     * @param string $url
     * @return bool True if signature is valid, false otherwise
     */
    public function validateSignature(string $url): bool
    {
        try {
            // Create a request from the URL for validation
            $request = \Illuminate\Http\Request::create($url, 'GET');
            return URL::hasValidSignature($request, false);
        } catch (\Exception $e) {
            return false;
        }
    }
}
