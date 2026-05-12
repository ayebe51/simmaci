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
        // This creates the signature — we then replace the base URL with the frontend URL
        $backendUrl = URL::temporarySignedRoute(
            'public.meetings.check-in.show',
            $expiresAt,
            [
                'meeting' => $meeting->id,
                'participant' => $participant->id,
            ]
        );

        // Replace backend URL with frontend URL so the link opens the React app
        $frontendUrl = env('FRONTEND_URL', config('app.url'));
        $url = $this->replaceBaseUrl($backendUrl, $frontendUrl);

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
        $backendUrl = URL::temporarySignedRoute(
            'public.meetings.walk-in.show',
            $expiresAt,
            [
                'meeting' => $meeting->id,
            ]
        );

        // Replace backend URL with frontend URL
        $frontendUrl = env('FRONTEND_URL', config('app.url'));
        $url = $this->replaceBaseUrl($backendUrl, $frontendUrl);

        // Store token reference in meeting for tracking
        $meeting->update([
            'qr_umum_token' => $url,
        ]);

        return $url;
    }

    /**
     * Validate a signed URL signature.
     *
     * Handles both frontend URLs (simmaci.com/meetings/...) and
     * backend URLs (api.simmaci.com/api/public/meetings/...).
     * Converts frontend URL back to backend URL for signature validation.
     *
     * @param string $url
     * @return bool True if signature is valid, false otherwise
     */
    public function validateSignature(string $url): bool
    {
        try {
            // If URL is a frontend URL, convert back to backend URL for validation
            $frontendUrl = rtrim(env('FRONTEND_URL', config('app.url')), '/');
            $backendUrl  = rtrim(config('app.url'), '/');

            if ($frontendUrl !== $backendUrl && str_starts_with($url, $frontendUrl)) {
                $url = $backendUrl . substr($url, strlen($frontendUrl));
            }

            // Create a request from the URL for validation
            $request = \Illuminate\Http\Request::create($url, 'GET');
            return URL::hasValidSignature($request, true);
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Replace the base URL of a signed URL with the frontend URL.
     * Preserves the path, query string, and signature.
     */
    private function replaceBaseUrl(string $signedUrl, string $frontendBase): string
    {
        $backendBase = rtrim(config('app.url'), '/');
        $frontendBase = rtrim($frontendBase, '/');

        if ($backendBase === $frontendBase) {
            return $signedUrl;
        }

        // Replace only the base URL, keep path + query string intact
        if (str_starts_with($signedUrl, $backendBase)) {
            return $frontendBase . substr($signedUrl, strlen($backendBase));
        }

        return $signedUrl;
    }
