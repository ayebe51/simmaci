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
        // QR valid until meeting ends + 1 hour buffer (not just H+1 from start)
        $expiresAt = $meeting->ended_at->copy()->addHour();

        // Generate signed URL using Laravel's temporary signed route
        $backendUrl = URL::temporarySignedRoute(
            'public.meetings.check-in.show',
            $expiresAt,
            [
                'meeting' => $meeting->id,
                'participant' => $participant->id,
            ]
        );

        // Build frontend URL: replace backend base with FRONTEND_URL
        // Extract only the path + query from the signed URL, prepend frontend base
        $url = $this->buildFrontendUrl($backendUrl);

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
        // QR valid until meeting ends + 1 hour buffer
        $expiresAt = $meeting->ended_at->copy()->addHour();

        // Generate signed URL using Laravel's temporary signed route
        $backendUrl = URL::temporarySignedRoute(
            'public.meetings.walk-in.show',
            $expiresAt,
            [
                'meeting' => $meeting->id,
            ]
        );

        // Build frontend URL
        $url = $this->buildFrontendUrl($backendUrl);

        // Store token reference in meeting for tracking
        $meeting->update([
            'qr_umum_token' => $url,
        ]);

        return $url;
    }

    /**
     * Build a frontend URL from a backend signed URL.
     *
     * Extracts the path + query string from the backend signed URL,
     * then prepends the FRONTEND_URL. This is robust regardless of
     * what APP_URL is set to in the backend.
     *
     * Example:
     *   backend: https://api.simmaci.com/api/public/meetings/8/check-in?expires=...&signature=...
     *   frontend: https://simmaci.com/meetings/8/check-in?expires=...&signature=...
     */
    private function buildFrontendUrl(string $backendSignedUrl): string
    {
        $frontendBase = rtrim(config('app.frontend_url', env('FRONTEND_URL', '')), '/');

        // If FRONTEND_URL not set, return as-is
        if (empty($frontendBase)) {
            return $backendSignedUrl;
        }

        // Parse the backend URL to get path + query
        $parsed = parse_url($backendSignedUrl);
        $path   = $parsed['path'] ?? '';
        $query  = isset($parsed['query']) ? '?' . $parsed['query'] : '';

        // The backend route path is /api/public/meetings/{id}/check-in
        // The frontend route path is /meetings/{id}/check-in
        // Strip the /api/public prefix
        $frontendPath = preg_replace('#^/api/public#', '', $path);

        return $frontendBase . $frontendPath . $query;
    }

    /**
     * Validate a signed URL signature.
     *
     * Handles both frontend URLs (simmaci.com/meetings/...) and
     * backend URLs (api.simmaci.com/api/public/meetings/...).
     * Converts frontend URL back to backend URL for signature validation.
     */
    public function validateSignature(string $url): bool
    {
        try {
            $frontendBase = rtrim(config('app.frontend_url', env('FRONTEND_URL', '')), '/');
            $backendBase  = rtrim(config('app.url'), '/');

            $originalUrl = $url;

            // If URL is a frontend URL, convert back to backend URL for validation
            if (!empty($frontendBase) && str_starts_with($url, $frontendBase)) {
                $parsed = parse_url($url);
                $path   = $parsed['path'] ?? '';
                $query  = isset($parsed['query']) ? '?' . $parsed['query'] : '';

                // Restore /api/public prefix
                $backendPath = '/api/public' . $path;
                $url = $backendBase . $backendPath . $query;
            } elseif (!empty($backendBase) && !str_starts_with($url, $backendBase)) {
                // URL doesn't match frontend or backend base — try to detect
                // if it's a frontend-style URL (contains /meetings/{id}/check-in without /api/public prefix)
                $parsed = parse_url($url);
                $path   = $parsed['path'] ?? '';

                if (preg_match('#^/meetings/\d+/(check-in|walk-in)#', $path)) {
                    $query = isset($parsed['query']) ? '?' . $parsed['query'] : '';
                    $backendPath = '/api/public' . $path;
                    $url = $backendBase . $backendPath . $query;

                    \Log::info('MeetingQrService::validateSignature - URL base mismatch, reconstructed from path', [
                        'original_url' => $originalUrl,
                        'reconstructed_url' => $url,
                    ]);
                }
            }

            // Create a request from the URL for validation
            $request = \Illuminate\Http\Request::create($url, 'GET');
            $result = URL::hasValidSignature($request, true);

            if (!$result) {
                // Check if it's an expiration issue vs signature mismatch
                $hasCorrectSignature = URL::hasCorrectSignature($request, true);
                $isExpired = $this->isUrlExpired($url);

                \Log::warning('MeetingQrService::validateSignature failed', [
                    'original_url'         => $originalUrl,
                    'converted_url'        => $url,
                    'frontend_base'        => $frontendBase,
                    'backend_base'         => $backendBase,
                    'app_key_set'          => !empty(config('app.key')),
                    'has_correct_signature' => $hasCorrectSignature,
                    'is_expired'           => $isExpired,
                ]);
            }

            return $result;
        } catch (\Exception $e) {
            \Log::error('MeetingQrService::validateSignature exception', [
                'url'   => $url,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Check if a signed URL has expired based on its 'expires' query parameter.
     */
    private function isUrlExpired(string $url): bool
    {
        $parsed = parse_url($url);
        parse_str($parsed['query'] ?? '', $params);

        if (!isset($params['expires'])) {
            return false;
        }

        return now()->getTimestamp() > (int) $params['expires'];
    }
}
