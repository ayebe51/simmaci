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

        if (! hash_equals((string) $storedPin, (string) $request->pin)) {
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
            'pin'           => 'required|string',
            'qr_url'        => 'required|string',
            'checked_in_at' => 'nullable|string',
        ]);

        if (!$this->validatePin($request->pin)) {
            return $this->errorResponse('PIN tidak valid.', null, 401);
        }

        $result = $this->processSingleScan($request->qr_url, $request->input('checked_in_at'), $request->ip());

        if ($result['code'] === 201) {
            return $this->successResponse($result['data'], $result['message'], 201);
        }

        return $this->errorResponse($result['message'], $result['data'] ?? null, $result['code']);
    }

    /**
     * Batch process scanned QR codes for offline queue synchronization.
     *
     * POST /api/public/meetings/batch-sync
     * Body: {
     *   pin: string,
     *   items: array of { client_id: string, qr_url: string, checked_in_at?: string }
     * }
     */
    public function batchSync(Request $request): JsonResponse
    {
        $request->validate([
            'pin'                   => 'required|string',
            'items'                 => 'required|array|min:1|max:100',
            'items.*.qr_url'        => 'required|string',
            'items.*.client_id'     => 'nullable|string',
            'items.*.checked_in_at' => 'nullable|string',
        ]);

        if (!$this->validatePin($request->pin)) {
            return $this->errorResponse('PIN tidak valid.', null, 401);
        }

        $results = [];
        $syncedCount = 0;
        $duplicateCount = 0;
        $failedCount = 0;

        foreach ($request->items as $item) {
            $clientId = $item['client_id'] ?? null;
            $qrUrl = trim($item['qr_url']);
            $customCheckedInAt = $item['checked_in_at'] ?? null;

            $scanResult = $this->processSingleScan($qrUrl, $customCheckedInAt, $request->ip());

            $results[] = [
                'client_id' => $clientId,
                'qr_url'    => $qrUrl,
                'status'    => $scanResult['status'],
                'message'   => $scanResult['message'],
                'data'      => $scanResult['data'] ?? null,
            ];

            if ($scanResult['status'] === 'synced') {
                $syncedCount++;
            } elseif ($scanResult['status'] === 'already_checked_in') {
                $duplicateCount++;
            } else {
                $failedCount++;
            }
        }

        return $this->successResponse([
            'total'           => count($request->items),
            'synced_count'    => $syncedCount,
            'duplicate_count' => $duplicateCount,
            'failed_count'    => $failedCount,
            'items'           => $results,
        ], "Sinkronisasi selesai: {$syncedCount} berhasil, {$duplicateCount} sudah tercatat, {$failedCount} gagal.");
    }

    /**
     * Process a single scanned QR code.
     */
    public function processSingleScan(string $qrUrl, ?string $customCheckedInAt = null, ?string $ip = null): array
    {
        $qrUrl = trim($qrUrl);

        $parsed = parse_url($qrUrl);
        if (!$parsed) {
            return [
                'status'  => 'invalid_qr',
                'code'    => 400,
                'message' => 'QR Code tidak valid.',
            ];
        }

        $path = $parsed['path'] ?? '';
        parse_str($parsed['query'] ?? '', $queryParams);

        if (!preg_match('#/meetings/(\d+)/check-in#', $path, $matches)) {
            return [
                'status'  => 'invalid_qr',
                'code'    => 400,
                'message' => 'QR Code bukan untuk absensi rapat. Pastikan Anda scan QR undangan rapat.',
            ];
        }

        $meetingId     = (int) $matches[1];
        $participantId = $queryParams['participant'] ?? null;

        if (!$participantId) {
            return [
                'status'  => 'walk_in',
                'code'    => 400,
                'message' => 'QR ini adalah QR Umum (walk-in). Minta peserta mengisi data di halaman check-in mereka.',
            ];
        }

        $meeting = Meeting::find($meetingId);
        if (!$meeting) {
            return [
                'status'  => 'not_found',
                'code'    => 404,
                'message' => 'Rapat tidak ditemukan.',
            ];
        }

        $participant = MeetingParticipant::find($participantId);
        if (!$participant || $participant->meeting_id !== $meeting->id) {
            return [
                'status'  => 'not_found',
                'code'    => 404,
                'message' => 'Peserta tidak ditemukan dalam rapat ini.',
            ];
        }

        if (!$this->isQrTokenValid($qrUrl, $participant)) {
            \Log::warning('MeetingScanner: QR token mismatch', [
                'meeting_id'     => $meetingId,
                'participant_id' => $participantId,
                'scanned_url'    => substr($qrUrl, 0, 120),
                'stored_token'   => substr($participant->qr_token ?? '', 0, 120),
            ]);

            return [
                'status'  => 'token_mismatch',
                'code'    => 403,
                'message' => 'QR Code tidak valid. Pastikan peserta menunjukkan QR dari undangan rapat yang benar.',
            ];
        }

        $now = now();
        $startWindow = $meeting->started_at->copy()->subHours(24);
        $endWindow   = $meeting->ended_at->copy()->addHours(48);

        if ($now->isBefore($startWindow)) {
            return [
                'status'  => 'outside_window',
                'code'    => 403,
                'message' => 'Check-in dibuka 24 jam sebelum rapat dimulai.',
            ];
        }

        if ($now->isAfter($endWindow)) {
            return [
                'status'  => 'outside_window',
                'code'    => 410,
                'message' => 'Waktu check-in telah berakhir (lebih dari 48 jam setelah rapat selesai).',
            ];
        }

        try {
            return \Illuminate\Support\Facades\DB::transaction(function () use ($meeting, $participant, $customCheckedInAt, $startWindow, $ip) {
                $locked = MeetingParticipant::lockForUpdate()->find($participant->id);

                if ($locked->token_revoked) {
                    return [
                        'status'  => 'token_revoked',
                        'code'    => 410,
                        'message' => 'QR Code sudah dicabut.',
                    ];
                }

                if ($locked->is_token_used) {
                    return [
                        'status'  => 'already_checked_in',
                        'code'    => 409,
                        'message' => "{$locked->name} sudah check-in sebelumnya.",
                        'data'    => [
                            'participant_name' => $locked->name,
                            'jabatan'          => $locked->jabatan,
                            'instansi'         => $locked->instansi,
                            'meeting_title'    => $meeting->title,
                        ],
                    ];
                }

                $checkedInTime = now();
                if ($customCheckedInAt) {
                    try {
                        $parsedTime = \Carbon\Carbon::parse($customCheckedInAt);
                        if ($parsedTime->isBefore(now()->addMinutes(10)) && $parsedTime->isAfter($startWindow)) {
                            $checkedInTime = $parsedTime;
                        }
                    } catch (\Throwable $e) {}
                }

                $attendance = \App\Models\MeetingAttendance::create([
                    'meeting_id'      => $meeting->id,
                    'participant_id'  => $participant->id,
                    'attendance_type' => 'qr_personal',
                    'is_delegation'   => false,
                    'checked_in_at'   => $checkedInTime,
                    'ip_address'      => $ip,
                ]);

                $locked->update([
                    'is_token_used' => true,
                    'token_used_at' => $checkedInTime,
                ]);

                return [
                    'status'  => 'synced',
                    'code'    => 201,
                    'message' => "Check-in {$locked->name} berhasil dicatat.",
                    'data'    => [
                        'participant_name' => $locked->name,
                        'jabatan'          => $locked->jabatan,
                        'instansi'         => $locked->instansi,
                        'meeting_title'    => $meeting->title,
                        'checked_in_at'    => $attendance->checked_in_at,
                    ],
                ];
            });
        } catch (\Throwable $e) {
            \Log::error('Meeting scanner check-in failed', [
                'meeting_id'     => $meetingId,
                'participant_id' => $participantId,
                'error'          => $e->getMessage(),
            ]);

            return [
                'status'  => 'server_error',
                'code'    => 500,
                'message' => 'Gagal memproses QR. Silakan coba lagi.',
            ];
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
        return $storedPin && hash_equals((string) $storedPin, (string) $pin);
    }
}
