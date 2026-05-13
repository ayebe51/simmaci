<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\AlreadyCheckedInException;
use App\Exceptions\InvalidQrSignatureException;
use App\Exceptions\OutsideGeofenceException;
use App\Exceptions\QrExpiredException;
use App\Exceptions\QrRevokedException;
use App\Exceptions\TooManyCheckInAttemptsException;
use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\Setting;
use App\Services\MeetingCheckInService;
use App\Services\MeetingQrService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * PublicMeetingScannerController
 *
 * Endpoints for the panitia (committee) QR scanner at /scan.
 * Protected by a global meeting scanner PIN stored in settings.
 *
 * Flow:
 * 1. POST /api/public/meetings/verify-pin  — validate PIN, return session token
 * 2. GET  /api/public/meetings/active      — list ongoing/upcoming meetings
 * 3. POST /api/public/meetings/scan        — process a scanned QR URL
 */
class PublicMeetingScannerController extends Controller
{
    use ApiResponse;

    private const PIN_SETTING_KEY = 'meeting_scanner_pin';

    public function __construct(
        private MeetingCheckInService $checkInService,
        private MeetingQrService $qrService,
    ) {}

    /**
     * Verify the meeting scanner PIN.
     *
     * POST /api/public/meetings/verify-pin
     * Body: { pin: string }
     */
    public function verifyPin(Request $request): JsonResponse
    {
        $request->validate(['pin' => 'required|string']);

        $storedPin = Setting::getValue(self::PIN_SETTING_KEY);

        if (!$storedPin) {
            return $this->errorResponse(
                'PIN scanner rapat belum dikonfigurasi. Hubungi super admin untuk mengatur PIN di Settings.',
                null,
                400
            );
        }

        if ($request->pin !== $storedPin) {
            return $this->errorResponse('PIN salah. Coba lagi.', null, 401);
        }

        return $this->successResponse(
            ['role' => 'meeting_scanner'],
            'PIN valid. Selamat datang, Panitia Rapat.'
        );
    }

    /**
     * List active (ongoing or upcoming within 2 hours) meetings.
     *
     * GET /api/public/meetings/active
     * Query: { pin: string }
     */
    public function activeList(Request $request): JsonResponse
    {
        $request->validate(['pin' => 'required|string']);

        if (!$this->validatePin($request->pin)) {
            return $this->errorResponse('PIN tidak valid.', null, 401);
        }

        $meetings = Meeting::with(['schools:id,nama'])
            ->where(function ($q) {
                // Ongoing: started but not ended
                $q->where('started_at', '<=', now())
                  ->where('ended_at', '>=', now());
            })
            ->orWhere(function ($q) {
                // Upcoming within 2 hours (allow early check-in)
                $q->where('started_at', '>', now())
                  ->where('started_at', '<=', now()->addHours(2));
            })
            ->orderBy('started_at')
            ->get(['id', 'title', 'location', 'started_at', 'ended_at']);

        return $this->successResponse($meetings, 'Daftar rapat aktif berhasil diambil.');
    }

    /**
     * Process a scanned QR code (signed URL from participant's WA message).
     *
     * POST /api/public/meetings/scan
     * Body: { pin: string, qr_url: string }
     *
     * The qr_url is the full signed URL from the participant's QR code.
     * This endpoint acts as a proxy — it validates the signed URL and
     * records attendance on behalf of the panitia scanner.
     */
    public function scan(Request $request): JsonResponse
    {
        $request->validate([
            'pin'    => 'required|string',
            'qr_url' => 'required|string|url',
        ]);

        // Validate scanner PIN
        if (!$this->validatePin($request->pin)) {
            return $this->errorResponse('PIN tidak valid.', null, 401);
        }

        $qrUrl = $request->qr_url;

        \Log::info('MeetingScanner::scan received', [
            'qr_url' => $qrUrl,
        ]);

        // Parse the signed URL to extract meeting ID and participant ID
        $parsed = parse_url($qrUrl);
        if (!$parsed) {
            return $this->errorResponse('QR Code tidak valid.', null, 400);
        }

        // Extract path segments: /meetings/{meetingId}/check-in or /api/public/meetings/{meetingId}/check-in
        $path = $parsed['path'] ?? '';
        parse_str($parsed['query'] ?? '', $queryParams);

        // Match /meetings/{id}/check-in pattern
        if (!preg_match('#/meetings/(\d+)/check-in#', $path, $matches)) {
            return $this->errorResponse(
                'QR Code bukan untuk absensi rapat. Pastikan Anda scan QR undangan rapat.',
                null,
                400
            );
        }

        $meetingId   = (int) $matches[1];
        $participantId = $queryParams['participant'] ?? null;

        $meeting = Meeting::find($meetingId);
        if (!$meeting) {
            return $this->errorResponse('Rapat tidak ditemukan.', null, 404);
        }

        // Validate the signed URL signature — use MeetingQrService to handle
        // frontend URL → backend URL conversion before validating.
        if (!$this->qrService->validateSignature($qrUrl)) {
            return $this->errorResponse('QR Code tidak valid atau sudah kadaluarsa.', [
                'debug' => 'signature_invalid | url=' . substr($qrUrl, 0, 80),
            ], 403);
        }

        // Build a fake request from the QR URL for passing to processCheckIn()
        // (service needs a Request object to re-validate signature internally)
        $fakeRequest = \Illuminate\Http\Request::create($qrUrl, 'GET');

        // Walk-in mode (no participant ID)
        if (!$participantId) {
            return $this->errorResponse(
                'QR ini adalah QR Umum (walk-in). Minta peserta mengisi data di halaman check-in mereka.',
                null,
                400
            );
        }

        $participant = MeetingParticipant::find($participantId);
        if (!$participant || $participant->meeting_id !== $meeting->id) {
            return $this->errorResponse('Peserta tidak ditemukan.', null, 404);
        }

        // Process check-in using the existing service
        // We create a fake request with the signed URL for signature validation
        try {
            $attendance = $this->checkInService->processCheckIn(
                $meeting,
                $participant,
                $fakeRequest,
                [] // no geolocation data from scanner
            );

            return $this->successResponse([
                'participant_name' => $participant->name,
                'jabatan'          => $participant->jabatan,
                'instansi'         => $participant->instansi,
                'meeting_title'    => $meeting->title,
                'checked_in_at'    => $attendance->checked_in_at,
            ], "Check-in {$participant->name} berhasil dicatat.", 201);

        } catch (AlreadyCheckedInException $e) {
            return $this->errorResponse(
                "{$participant->name} sudah check-in sebelumnya.",
                null,
                409
            );
        } catch (QrExpiredException $e) {
            return $this->errorResponse('QR Code sudah kadaluarsa.', null, 410);
        } catch (QrRevokedException $e) {
            return $this->errorResponse('QR Code sudah dicabut.', null, 410);
        } catch (InvalidQrSignatureException $e) {
            return $this->errorResponse('QR Code tidak valid.', null, 403);
        } catch (TooManyCheckInAttemptsException $e) {
            return $this->errorResponse('Terlalu banyak percobaan. Tunggu beberapa menit.', null, 429);
        } catch (OutsideGeofenceException $e) {
            // Scanner panitia bypass geofence — catat tetap berhasil
            // Panitia hadir di lokasi, jadi geofence tidak relevan
            try {
                // Re-process without geofence check by marking directly
                $attendance = \App\Models\MeetingAttendance::create([
                    'meeting_id'           => $meeting->id,
                    'participant_id'       => $participant->id,
                    'attendance_type'      => 'manual',
                    'is_delegation'        => false,
                    'checked_in_at'        => now(),
                    'checked_in_by_admin_id' => null,
                    'ip_address'           => $request->ip(),
                ]);
                $participant->update(['is_token_used' => true, 'token_used_at' => now()]);

                return $this->successResponse([
                    'participant_name' => $participant->name,
                    'jabatan'          => $participant->jabatan,
                    'instansi'         => $participant->instansi,
                    'meeting_title'    => $meeting->title,
                    'checked_in_at'    => $attendance->checked_in_at,
                ], "Check-in {$participant->name} berhasil dicatat (oleh panitia).", 201);
            } catch (\Exception $inner) {
                return $this->errorResponse('Gagal mencatat kehadiran.', null, 500);
            }
        } catch (\Exception $e) {
            \Log::error('Meeting scanner check-in failed', [
                'meeting_id'     => $meetingId,
                'participant_id' => $participantId,
                'error'          => $e->getMessage(),
            ]);
            return $this->errorResponse('Gagal memproses QR. Silakan coba lagi.', null, 500);
        }
    }

    private function validatePin(string $pin): bool
    {
        $storedPin = Setting::getValue(self::PIN_SETTING_KEY);
        return $storedPin && $pin === $storedPin;
    }
}
