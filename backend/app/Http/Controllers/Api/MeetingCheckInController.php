<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\AlreadyCheckedInException;
use App\Exceptions\InvalidQrSignatureException;
use App\Exceptions\OutsideGeofenceException;
use App\Exceptions\QrExpiredException;
use App\Exceptions\QrRevokedException;
use App\Exceptions\TooManyCheckInAttemptsException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Meeting\CheckInRequest;
use App\Http\Requests\Meeting\WalkInCheckInRequest;
use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Models\MeetingParticipant;
use App\Services\MeetingCheckInService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

/**
 * MeetingCheckInController
 *
 * Handles public check-in endpoints (no authentication required).
 * Protected by Laravel signed URLs.
 *
 * Requirements: Req 4, 5, 6, 25, 26, 27, 28, 29
 */
class MeetingCheckInController extends Controller
{
    use ApiResponse;

    public function __construct(
        private MeetingCheckInService $checkInService,
    ) {}

    /**
     * Show check-in page info (validate signed URL and return meeting/participant info).
     *
     * Public endpoint - no auth required.
     * Validates signed URL signature and expiry.
     *
     * @param Request $request
     * @param Meeting $meeting
     * @return JsonResponse
     */
    public function show(Request $request, Meeting $meeting): JsonResponse
    {
        // Validate signed URL signature
        if (!$request->hasValidSignature()) {
            return $this->errorResponse('QR Code tidak valid atau telah dimodifikasi.', null, 403);
        }

        // Check if this is a walk-in (no participant parameter) or personal QR
        $participantId = $request->query('participant');
        $isWalkIn = !$participantId;

        if ($isWalkIn) {
            // Walk-in mode - return meeting info only
            return $this->successResponse([
                'meeting' => $meeting,
                'mode' => 'walk_in',
                'geolocation_enabled' => $meeting->geolocation_enabled,
            ], 'Informasi rapat berhasil diambil.');
        }

        // Personal QR mode - return participant info
        $participant = MeetingParticipant::find($participantId);

        if (!$participant || $participant->meeting_id !== $meeting->id) {
            return $this->errorResponse('Peserta tidak ditemukan.', null, 404);
        }

        // Check if token is revoked
        if ($participant->token_revoked) {
            return $this->errorResponse('QR Code sudah tidak berlaku.', null, 410);
        }

        // Check if already checked in
        if ($participant->is_token_used) {
            return $this->successResponse([
                'already_checked_in' => true,
                'checked_in_at' => $participant->token_used_at,
            ], 'Anda sudah melakukan check-in.', 409);
        }

        return $this->successResponse([
            'meeting' => $meeting,
            'participant' => $participant,
            'mode' => 'personal',
            'geolocation_enabled' => $meeting->geolocation_enabled,
        ], 'Informasi rapat berhasil diambil.');
    }

    /**
     * Process QR_Personal check-in.
     *
     * Public endpoint - no auth required.
     * Validates signed URL, rate limiting, geolocation, and performs pessimistic locking.
     *
     * @param CheckInRequest $request
     * @param Meeting $meeting
     * @return JsonResponse
     */
    public function checkIn(CheckInRequest $request, Meeting $meeting): JsonResponse
    {
        try {
            $participantId = $request->query('participant');
            if (!$participantId) {
                return $this->errorResponse('Parameter peserta tidak ditemukan.', null, 400);
            }

            $participant = MeetingParticipant::find($participantId);
            if (!$participant || $participant->meeting_id !== $meeting->id) {
                return $this->errorResponse('Peserta tidak ditemukan.', null, 404);
            }

            // Process check-in with all validations (signature validated inside service)
            $attendance = $this->checkInService->processCheckIn(
                $meeting,
                $participant,
                $request,
                $request->validated()
            );

            return $this->successResponse([
                'attendance' => $attendance,
                'message' => 'Check-in berhasil dicatat.',
            ], 'Check-in berhasil.', 201);

        } catch (InvalidQrSignatureException $e) {
            return $this->errorResponse('QR Code tidak valid atau telah dimodifikasi.', null, 403);
        } catch (QrExpiredException $e) {
            return $this->errorResponse('QR Code sudah tidak berlaku.', null, 410);
        } catch (QrRevokedException $e) {
            return $this->errorResponse('QR Code sudah tidak berlaku.', null, 410);
        } catch (AlreadyCheckedInException $e) {
            return $this->errorResponse(
                $e->getMessage(),
                null,
                409
            );
        } catch (TooManyCheckInAttemptsException $e) {
            return $this->errorResponse(
                'Terlalu banyak percobaan check-in dari perangkat Anda. Silakan tunggu beberapa menit.',
                null,
                429
            );
        } catch (OutsideGeofenceException $e) {
            return $this->errorResponse($e->getMessage(), null, 422);
        } catch (\Exception $e) {
            \Log::error('Check-in failed', [
                'meeting_id' => $meeting->id,
                'participant_id' => $participantId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->errorResponse('Gagal melakukan check-in. Silakan coba lagi.', null, 500);
        }
    }

    /**
     * Process QR_Umum walk-in check-in.
     *
     * Public endpoint - no auth required.
     * Validates signed URL, rate limiting, geolocation, and creates walk-in attendance.
     *
     * @param WalkInCheckInRequest $request
     * @param Meeting $meeting
     * @return JsonResponse
     */
    public function walkIn(WalkInCheckInRequest $request, Meeting $meeting): JsonResponse
    {
        try {
            // Process walk-in check-in (signature validated inside service)
            $attendance = $this->checkInService->processWalkIn(
                $meeting,
                $request,
                $request->validated()
            );

            return $this->successResponse([
                'attendance' => $attendance,
                'message' => 'Check-in walk-in berhasil dicatat.',
            ], 'Check-in berhasil.', 201);

        } catch (InvalidQrSignatureException $e) {
            return $this->errorResponse('QR Code tidak valid atau telah dimodifikasi.', null, 403);
        } catch (QrExpiredException $e) {
            return $this->errorResponse('QR Code sudah tidak berlaku.', null, 410);
        } catch (TooManyCheckInAttemptsException $e) {
            return $this->errorResponse(
                'Terlalu banyak percobaan check-in dari perangkat Anda. Silakan tunggu beberapa menit.',
                null,
                429
            );
        } catch (OutsideGeofenceException $e) {
            return $this->errorResponse($e->getMessage(), null, 422);
        } catch (\Exception $e) {
            \Log::error('Walk-in check-in failed', [
                'meeting_id' => $meeting->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->errorResponse('Gagal melakukan check-in. Silakan coba lagi.', null, 500);
        }
    }
}
