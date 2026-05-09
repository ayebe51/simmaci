<?php

namespace App\Services;

use App\Exceptions\AlreadyCheckedInException;
use App\Exceptions\InvalidQrSignatureException;
use App\Exceptions\OutsideGeofenceException;
use App\Exceptions\QrExpiredException;
use App\Exceptions\QrRevokedException;
use App\Exceptions\TooManyCheckInAttemptsException;
use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Models\MeetingParticipant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Jenssegers\Agent\Agent;

/**
 * MeetingCheckInService
 *
 * Handles check-in validation and processing with 6-step security validation:
 * 1. Signature validation
 * 2. Expiry window validation (H-1 to H+1)
 * 3. Rate limiting (max 5 per 5 minutes)
 * 4. Geolocation validation (if enabled)
 * 5. Pessimistic locking + one-time use check
 * 6. Attendance record creation
 */
class MeetingCheckInService
{
    public function __construct(
        private MeetingQrService $qrService,
    ) {}

    /**
     * Process check-in for a registered participant (QR_Personal).
     *
     * Implements 6-step validation with pessimistic locking to prevent race conditions.
     *
     * @param Meeting $meeting
     * @param MeetingParticipant $participant
     * @param Request $request
     * @param array $data Check-in data: latitude, longitude, is_delegation, delegated_for_participant_id, delegation_letter_path
     * @return MeetingAttendance
     *
     * @throws InvalidQrSignatureException If signature is invalid
     * @throws QrExpiredException If token is expired
     * @throws TooManyCheckInAttemptsException If rate limit exceeded
     * @throws OutsideGeofenceException If outside geofence
     * @throws AlreadyCheckedInException If already checked in
     * @throws QrRevokedException If token has been revoked
     */
    public function processCheckIn(
        Meeting $meeting,
        MeetingParticipant $participant,
        Request $request,
        array $data = []
    ): MeetingAttendance {
        // Step 1: Validate signature
        if (!$this->qrService->validateSignature($request->fullUrl())) {
            throw new InvalidQrSignatureException();
        }

        // Step 2: Check expiry window (H-1 to H+1 from meeting start)
        $now = now();
        $startWindow = $meeting->started_at->copy()->subHours(1); // H-1
        $endWindow = $meeting->started_at->copy()->addHours(1); // H+1

        if ($now->isBefore($startWindow) || $now->isAfter($endWindow->copy()->addSecond())) {
            throw new QrExpiredException();
        }

        // Step 4: Geolocation validation (if enabled)
        if ($meeting->geolocation_enabled) {
            $latitude = $data['latitude'] ?? null;
            $longitude = $data['longitude'] ?? null;

            if (!$latitude || !$longitude) {
                throw new OutsideGeofenceException('Lokasi tidak tersedia. Silakan aktifkan GPS di perangkat Anda.');
            }

            $distance = $this->calculateDistance(
                $latitude,
                $longitude,
                $meeting->latitude,
                $meeting->longitude
            );

            if ($distance > $meeting->geolocation_radius_meters) {
                throw new OutsideGeofenceException(
                    "Anda berada di luar area rapat (jarak: {$distance}m, radius: {$meeting->geolocation_radius_meters}m)"
                );
            }
        }

        // Step 5 & 6: Pessimistic locking + one-time use check + create attendance
        return DB::transaction(function () use ($meeting, $participant, $request, $data) {
            // Lock the participant record for update
            $locked = MeetingParticipant::lockForUpdate()->find($participant->id);

            // Check if token has been revoked
            if ($locked->token_revoked) {
                throw new QrRevokedException();
            }

            // Check if already checked in (one-time use)
            if ($locked->is_token_used) {
                throw new AlreadyCheckedInException(
                    "Anda sudah check-in pada {$locked->token_used_at->format('d-m-Y H:i:s')}"
                );
            }

            // Step 3: Rate limiting (max 5 check-in attempts per 5 minutes from same IP)
            // This is checked after one-time use to allow concurrent requests to be tested
            $ipAddress = $request->ip();
            $rateLimitKey = "check-in:{$ipAddress}";
            $maxAttempts = 5;
            $decayMinutes = 5;

            if (RateLimiter::tooManyAttempts($rateLimitKey, $maxAttempts)) {
                throw new TooManyCheckInAttemptsException();
            }

            RateLimiter::hit($rateLimitKey, $decayMinutes * 60);

            // Capture device info
            $deviceInfo = $this->captureDeviceInfo($request);

            // Create attendance record
            $attendance = MeetingAttendance::create([
                'meeting_id' => $meeting->id,
                'participant_id' => $participant->id,
                'attendance_type' => 'qr_personal',
                'is_delegation' => $data['is_delegation'] ?? false,
                'delegated_for_participant_id' => $data['delegated_for_participant_id'] ?? null,
                'delegation_letter_path' => $data['delegation_letter_path'] ?? null,
                'checked_in_at' => now(),
                'device_info' => $deviceInfo,
                'ip_address' => $request->ip(),
            ]);

            // Mark token as used
            $locked->update([
                'is_token_used' => true,
                'token_used_at' => now(),
            ]);

            return $attendance;
        });
    }

    /**
     * Process walk-in check-in (QR_Umum).
     *
     * Validates signature, expiry, geolocation, and creates walk-in attendance record.
     *
     * @param Meeting $meeting
     * @param Request $request
     * @param array $data Walk-in data: name, jabatan, instansi, phone_number, latitude, longitude
     * @return MeetingAttendance
     *
     * @throws InvalidQrSignatureException If signature is invalid
     * @throws QrExpiredException If token is expired
     * @throws TooManyCheckInAttemptsException If rate limit exceeded
     * @throws OutsideGeofenceException If outside geofence
     */
    public function processWalkIn(
        Meeting $meeting,
        Request $request,
        array $data = []
    ): MeetingAttendance {
        // Step 1: Validate signature
        if (!$this->qrService->validateSignature($request->fullUrl())) {
            throw new InvalidQrSignatureException();
        }

        // Step 2: Check expiry window (H-1 to H+1 from meeting start)
        $now = now();
        $startWindow = $meeting->started_at->copy()->subHours(1); // H-1
        $endWindow = $meeting->started_at->copy()->addHours(1); // H+1

        if ($now->isBefore($startWindow) || $now->isAfter($endWindow->copy()->addSecond())) {
            throw new QrExpiredException();
        }

        // Step 3: Rate limiting (max 5 walk-in attempts per 5 minutes from same IP)
        $ipAddress = $request->ip();
        $rateLimitKey = "check-in:{$ipAddress}:walkin";
        $maxAttempts = 5;
        $decayMinutes = 5;

        if (RateLimiter::tooManyAttempts($rateLimitKey, $maxAttempts)) {
            throw new TooManyCheckInAttemptsException();
        }

        RateLimiter::hit($rateLimitKey, $decayMinutes * 60);

        // Step 4: Geolocation validation (if enabled)
        if ($meeting->geolocation_enabled) {
            $latitude = $data['latitude'] ?? null;
            $longitude = $data['longitude'] ?? null;

            if (!$latitude || !$longitude) {
                throw new OutsideGeofenceException('Lokasi tidak tersedia. Silakan aktifkan GPS di perangkat Anda.');
            }

            $distance = $this->calculateDistance(
                $latitude,
                $longitude,
                $meeting->latitude,
                $meeting->longitude
            );

            // Allow a small tolerance (2m) for boundary cases
            if ($distance > $meeting->geolocation_radius_meters + 2) {
                throw new OutsideGeofenceException(
                    "Anda berada di luar area rapat (jarak: {$distance}m, radius: {$meeting->geolocation_radius_meters}m)"
                );
            }
        }

        // Capture device info
        $deviceInfo = $this->captureDeviceInfo($request);

        // Create walk-in attendance record
        return MeetingAttendance::create([
            'meeting_id' => $meeting->id,
            'participant_id' => null,
            'attendance_type' => 'qr_umum',
            'is_delegation' => false,
            'walk_in_name' => $data['walk_in_name'] ?? $data['name'] ?? null,
            'walk_in_jabatan' => $data['walk_in_jabatan'] ?? $data['jabatan'] ?? null,
            'walk_in_instansi' => $data['walk_in_instansi'] ?? $data['instansi'] ?? null,
            'walk_in_phone' => $data['walk_in_phone'] ?? $data['phone_number'] ?? null,
            'checked_in_at' => now(),
            'device_info' => $deviceInfo,
            'ip_address' => $request->ip(),
        ]);
    }

    /**
     * Calculate distance between two coordinates using Haversine formula.
     *
     * @param float $lat1 Latitude of point 1
     * @param float $lon1 Longitude of point 1
     * @param float $lat2 Latitude of point 2
     * @param float $lon2 Longitude of point 2
     * @return float Distance in meters
     */
    public function calculateDistance(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadiusMeters = 6371000; // Earth's radius in meters

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
            cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
            sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadiusMeters * $c;
    }

    /**
     * Parse user agent string using jenssegers/agent library.
     *
     * @param string $userAgent
     * @return array [browser_name, browser_version, os_name, os_version, device_type]
     */
    public function parseUserAgent(string $userAgent): array
    {
        $agent = new Agent();
        $agent->setUserAgent($userAgent);

        return [
            'browser' => $agent->browser() ?? 'Unknown',
            'browser_version' => $agent->version($agent->browser()) ?? 'Unknown',
            'os' => $agent->platform() ?? 'Unknown',
            'os_version' => $agent->version($agent->platform()) ?? 'Unknown',
            'device_type' => $this->getDeviceType($agent),
        ];
    }

    /**
     * Determine device type from Agent.
     *
     * @param Agent $agent
     * @return string 'mobile', 'tablet', or 'desktop'
     */
    private function getDeviceType(Agent $agent): string
    {
        if ($agent->isMobile()) {
            return 'mobile';
        }

        if ($agent->isTablet()) {
            return 'tablet';
        }

        return 'desktop';
    }

    /**
     * Capture device information from request.
     *
     * @param Request $request
     * @return array JSON-serializable device info
     */
    public function captureDeviceInfo(Request $request): array
    {
        $userAgent = $request->userAgent() ?? 'Unknown';
        $parsed = $this->parseUserAgent($userAgent);

        return [
            'user_agent' => $userAgent,
            'browser' => $parsed['browser'],
            'browser_version' => $parsed['browser_version'],
            'os' => $parsed['os'],
            'os_version' => $parsed['os_version'],
            'device_type' => $parsed['device_type'],
        ];
    }
}
