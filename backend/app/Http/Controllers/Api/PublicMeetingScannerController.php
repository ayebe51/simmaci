<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\Setting;
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
     * This endpoint acts as a proxy — it validates the QR by matching against
     * the stored qr_token in the database, then records attendance.
     *
     * Security model:
     * - Scanner is protected by PIN (only panitia has access)
     * - QR is validated by matching against stored token in DB (tamper-proof)
     * - Time window is checked against meeting started_at/ended_at
     * - One-time use is enforced via pessimistic locking
     */
    public function scan(Request $request): JsonResponse
    {
        $request->validate([
            'pin'    => 'required|string',
            'qr_url' => 'required|string',
        ]);

        // Validate scanner PIN
        if (!$this->validatePin($request->pin)) {
            return $this->errorResponse('PIN tidak valid.', null, 401);
        }

        $qrUrl = trim($request->qr_url);

        \Log::info('MeetingScanner::scan received', [
            'qr_url' => substr($qrUrl, 0, 120),
        ]);

        // Parse the URL to extract meeting ID and participant ID
        $parsed = parse_url($qrUrl);
        if (!$parsed) {
            return $this->errorResponse('QR Code tidak valid.', null, 400);
        }

        $path = $parsed['path'] ?? '';
        parse_str($parsed['query'] ?? '', $queryParams);

        // Match /meetings/{id}/check-in pattern (handles both frontend and backend URL formats)
        if (!preg_match('#/meetings/(\d+)/check-in#', $path, $matches)) {
            return $this->errorResponse(
                'QR Code bukan untuk absensi rapat. Pastikan Anda scan QR undangan rapat.',
                null,
                400
            );
        }

        $meetingId     = (int) $matches[1];
        $participantId = $queryParams['participant'] ?? null;

        // Walk-in mode (no participant ID)
        if (!$participantId) {
            return $this->errorResponse(
                'QR ini adalah QR Umum (walk-in). Minta peserta mengisi data di halaman check-in mereka.',
                null,
                400
            );
        }

        // ── Lookup meeting and participant ──
        $meeting = Meeting::find($meetingId);
        if (!$meeting) {
            return $this->errorResponse('Rapat tidak ditemukan.', null, 404);
        }

        $participant = MeetingParticipant::find($participantId);
        if (!$participant || $participant->meeting_id !== $meeting->id) {
            return $this->errorResponse('Peserta tidak ditemukan dalam rapat ini.', null, 404);
        }

        // ── Validate QR token by matching against stored token in DB ──
        // This is more robust than signed URL validation which is fragile
        // across different URL formats (frontend vs backend, http vs https).
        // The scanner is already PIN-protected, so this is secure.
        if (!$this->isQrTokenValid($qrUrl, $participant)) {
            \Log::warning('MeetingScanner: QR token mismatch', [
                'meeting_id'     => $meetingId,
                'participant_id' => $participantId,
                'scanned_url'    => substr($qrUrl, 0, 120),
                'stored_token'   => substr($participant->qr_token ?? '', 0, 120),
            ]);

            return $this->errorResponse(
                'QR Code tidak valid. Pastikan peserta menunjukkan QR dari undangan rapat yang benar.',
                null,
                403
            );
        }

        // ── Check time window: H-2 to ended_at + 1 hour ──
        $now = now();
        $startWindow = $meeting->started_at->copy()->subHours(2);
        $endWindow   = $meeting->ended_at->copy()->addHour();

        if ($now->isBefore($startWindow)) {
            return $this->errorResponse(
                'Rapat belum dimulai. Check-in dibuka 2 jam sebelum rapat.',
                null,
                403
            );
        }

        if ($now->isAfter($endWindow)) {
            return $this->errorResponse(
                'QR Code sudah kadaluarsa. Waktu check-in telah berakhir.',
                null,
                410
            );
        }

        // ── Process check-in with pessimistic locking ──
        try {
            return \Illuminate\Support\Facades\DB::transaction(function () use ($meeting, $participant, $request) {
                // Lock participant record
                $locked = MeetingParticipant::lockForUpdate()->find($participant->id);

                // Check if token has been revoked
                if ($locked->token_revoked) {
                    return $this->errorResponse('QR Code sudah dicabut.', null, 410);
                }

                // Check if already checked in (one-time use)
                if ($locked->is_token_used) {
                    return $this->errorResponse(
                        "{$locked->name} sudah check-in sebelumnya.",
                        null,
                        409
                    );
                }

                // Create attendance record
                $attendance = \App\Models\MeetingAttendance::create([
                    'meeting_id'      => $meeting->id,
                    'participant_id'  => $participant->id,
                    'attendance_type' => 'qr_personal',
                    'is_delegation'   => false,
                    'checked_in_at'   => now(),
                    'ip_address'      => $request->ip(),
                ]);

                // Mark token as used
                $locked->update([
                    'is_token_used' => true,
                    'token_used_at' => now(),
                ]);

                return $this->successResponse([
                    'participant_name' => $locked->name,
                    'jabatan'          => $locked->jabatan,
                    'instansi'         => $locked->instansi,
                    'meeting_title'    => $meeting->title,
                    'checked_in_at'    => $attendance->checked_in_at,
                ], "Check-in {$locked->name} berhasil dicatat.", 201);
            });
        } catch (\Exception $e) {
            \Log::error('Meeting scanner check-in failed', [
                'meeting_id'     => $meetingId,
                'participant_id' => $participantId,
                'error'          => $e->getMessage(),
            ]);
            return $this->errorResponse('Gagal memproses QR. Silakan coba lagi.', null, 500);
        }
    }

    /**
     * Validate scanned QR URL against the stored token in the database.
     *
     * Compares the scanned URL with the participant's stored qr_token.
     * Uses a normalized comparison that strips the base URL and compares
     * only the path + query parameters (signature, expires, participant).
     */
    private function isQrTokenValid(string $scannedUrl, MeetingParticipant $participant): bool
    {
        $storedToken = $participant->qr_token;

        if (empty($storedToken)) {
            return false;
        }

        // Direct match (most common case)
        if ($scannedUrl === $storedToken) {
            return true;
        }

        // Normalized comparison: extract signature param from both URLs
        // If signatures match, the QR is authentic regardless of base URL differences
        $scannedSig = $this->extractSignature($scannedUrl);
        $storedSig  = $this->extractSignature($storedToken);

        if (!empty($scannedSig) && !empty($storedSig) && hash_equals($storedSig, $scannedSig)) {
            return true;
        }

        return false;
    }

    /**
     * Extract the 'signature' query parameter from a URL.
     */
    private function extractSignature(string $url): string
    {
        $parsed = parse_url($url);
        parse_str($parsed['query'] ?? '', $params);

        return $params['signature'] ?? '';
    }

    private function validatePin(string $pin): bool
    {
        $storedPin = Setting::getValue(self::PIN_SETTING_KEY);
        return $storedPin && $pin === $storedPin;
    }
}
