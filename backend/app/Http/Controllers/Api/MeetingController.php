<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Meeting\StoreMeetingRequest;
use App\Http\Requests\Meeting\UpdateMeetingRequest;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Services\MeetingService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * MeetingController
 *
 * Handles CRUD operations for meetings and participant management.
 * Requires authentication and role-based authorization.
 *
 * Requirements: Req 1, 2, 3, 7, 15, 16, 20, 21
 */
class MeetingController extends Controller
{
    use ApiResponse;

    public function __construct(
        private MeetingService $meetingService,
    ) {}

    /**
     * Get headmaster participants from selected school IDs.
     * Used to auto-populate meeting participants from school data.
     *
     * POST /api/meetings/participants-from-schools
     * Body: { school_ids: number[] }
     */
    public function participantsFromSchools(Request $request): JsonResponse
    {
        $request->validate([
            'school_ids'   => 'required|array|min:1',
            'school_ids.*' => 'integer|exists:schools,id',
        ]);

        $schools = \App\Models\School::whereIn('id', $request->school_ids)
            ->whereNotNull('kepala_madrasah')
            ->where('kepala_madrasah', '!=', '')
            ->get(['id', 'nama', 'jenjang', 'kepala_madrasah', 'kepala_whatsapp']);

        $participants = $schools->map(function ($school) {
            return [
                'participant_type' => 'headmaster',
                'participant_id'   => null,
                'name'             => $school->kepala_madrasah,
                'jabatan'          => 'Kepala ' . ($school->jenjang ?? 'Madrasah'),
                'instansi'         => $school->nama,
                'phone_number'     => $school->kepala_whatsapp ?? '',
                'school_id'        => $school->id,
            ];
        });

        $skippedCount = count($request->school_ids) - $schools->count();

        return $this->successResponse([
            'participants'  => $participants,
            'imported_count' => $participants->count(),
            'skipped_count'  => $skippedCount,
        ], 'Data peserta dari sekolah berhasil diambil.');
    }

    /**
     * Get paginated list of meetings with optional filters.
     *
     * For operators, only shows meetings involving their school.
     * For admin_yayasan and super_admin, shows all meetings.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $filters = [];

        // Apply school filter for operators
        $user = $request->user();
        if ($user->role === 'operator' && $user->school_id) {
            $filters['school_ids'] = [$user->school_id];
        } elseif ($request->has('school_id')) {
            $filters['school_ids'] = [$request->integer('school_id')];
        }

        // Apply date range filter
        if ($request->has('date_from')) {
            $filters['started_at'] = ['>=', $request->date('date_from')];
        }
        if ($request->has('date_to')) {
            $filters['ended_at'] = ['<=', $request->date('date_to')];
        }

        // Apply search filter
        if ($request->has('search')) {
            $filters['title'] = $request->string('search');
        }

        $perPage = $request->integer('per_page', 20);
        $paginated = $this->meetingService->getMeetings($perPage, $filters);

        // Filter by status in memory (since it's a computed property)
        if ($request->has('status') && $request->status !== 'all') {
            $paginated->getCollection()->transform(function ($meeting) use ($request) {
                if ($meeting->status === $request->status) {
                    return $meeting;
                }
                return null;
            })->filter();
        }

        return $this->paginatedResponse($paginated, 'Daftar rapat berhasil diambil.');
    }

    /**
     * Get a single meeting by ID.
     *
     * @param Meeting $meeting
     * @param Request $request
     * @return JsonResponse
     */
    public function show(Meeting $meeting, Request $request): JsonResponse
    {
        // Check access for operators
        $user = $request->user();
        if ($user->role === 'operator' && $user->school_id) {
            $hasAccess = $meeting->schools()->where('school_id', $user->school_id)->exists();
            if (!$hasAccess) {
                return $this->errorResponse('Anda tidak memiliki akses ke rapat ini.', null, 403);
            }
        }

        $meeting = $this->meetingService->getMeeting($meeting->id);
        $stats = $this->meetingService->getAttendanceStats($meeting);

        return $this->successResponse([
            'meeting' => $meeting,
            'attendance_stats' => $stats,
        ], 'Detail rapat berhasil diambil.');
    }

    /**
     * Create a new meeting.
     *
     * Only super_admin and admin_yayasan can create meetings.
     *
     * @param StoreMeetingRequest $request
     * @return JsonResponse
     */
    public function store(StoreMeetingRequest $request): JsonResponse
    {
        try {
            $meeting = $this->meetingService->createMeeting(
                $request->validated(),
                $request->user()
            );

            return $this->successResponse($meeting, 'Rapat berhasil dibuat.', 201);
        } catch (ValidationException $e) {
            return $this->validationErrorResponse($e->errors());
        } catch (\Exception $e) {
            \Log::error('Failed to create meeting', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->errorResponse('Gagal membuat rapat. Silakan coba lagi.', null, 500);
        }
    }

    /**
     * Update an existing meeting.
     *
     * Only super_admin and admin_yayasan can update meetings.
     * Date/time changes are disabled if meeting is ongoing or completed.
     *
     * @param UpdateMeetingRequest $request
     * @param Meeting $meeting
     * @return JsonResponse
     */
    public function update(UpdateMeetingRequest $request, Meeting $meeting): JsonResponse
    {
        try {
            $meeting = $this->meetingService->updateMeeting(
                $meeting,
                $request->validated()
            );

            return $this->successResponse($meeting, 'Rapat berhasil diperbarui.');
        } catch (ValidationException $e) {
            return $this->validationErrorResponse($e->errors());
        } catch (\Exception $e) {
            \Log::error('Failed to update meeting', [
                'meeting_id' => $meeting->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->errorResponse('Gagal memperbarui rapat. Silakan coba lagi.', null, 500);
        }
    }

    /**
     * Delete a meeting (soft delete).
     *
     * Only super_admin and admin_yayasan can delete meetings.
     *
     * @param Meeting $meeting
     * @return JsonResponse
     */
    public function destroy(Meeting $meeting): JsonResponse
    {
        try {
            $this->meetingService->deleteMeeting($meeting);

            return $this->successResponse(null, 'Rapat berhasil dihapus.');
        } catch (\Exception $e) {
            \Log::error('Failed to delete meeting', [
                'meeting_id' => $meeting->id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Gagal menghapus rapat. Silakan coba lagi.', null, 500);
        }
    }

    /**
     * Perform manual check-in for a participant.
     *
     * Only super_admin and admin_yayasan can perform manual check-in.
     *
     * @param Request $request
     * @param Meeting $meeting
     * @param MeetingParticipant $participant
     * @return JsonResponse
     */
    public function manualCheckIn(Request $request, Meeting $meeting, MeetingParticipant $participant): JsonResponse
    {
        try {
            $attendance = $this->meetingService->manualCheckIn(
                $meeting,
                $participant,
                $request->user()
            );

            return $this->successResponse($attendance, 'Check-in manual berhasil dicatat.', 201);
        } catch (ValidationException $e) {
            return $this->validationErrorResponse($e->errors());
        } catch (\Exception $e) {
            \Log::error('Failed to perform manual check-in', [
                'meeting_id' => $meeting->id,
                'participant_id' => $participant->id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Gagal melakukan check-in manual. Silakan coba lagi.', null, 500);
        }
    }

    /**
     * Reset check-in for a participant.
     *
     * Only super_admin and admin_yayasan can reset check-in.
     *
     * @param Meeting $meeting
     * @param MeetingParticipant $participant
     * @return JsonResponse
     */
    public function resetCheckIn(Meeting $meeting, MeetingParticipant $participant): JsonResponse
    {
        try {
            $this->meetingService->resetCheckIn($meeting, $participant);

            return $this->successResponse(null, 'Check-in berhasil direset.');
        } catch (\Exception $e) {
            \Log::error('Failed to reset check-in', [
                'meeting_id' => $meeting->id,
                'participant_id' => $participant->id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Gagal mereset check-in. Silakan coba lagi.', null, 500);
        }
    }

    /**
     * Regenerate QR code for a participant.
     *
     * Only super_admin and admin_yayasan can regenerate QR.
     *
     * @param Meeting $meeting
     * @param MeetingParticipant $participant
     * @return JsonResponse
     */
    public function regenerateQr(Meeting $meeting, MeetingParticipant $participant): JsonResponse
    {
        try {
            $qrUrl = $this->meetingService->regenerateQr($meeting, $participant);

            return $this->successResponse([
                'qr_url' => $qrUrl,
            ], 'QR code berhasil diperbarui.');
        } catch (\Exception $e) {
            \Log::error('Failed to regenerate QR', [
                'meeting_id' => $meeting->id,
                'participant_id' => $participant->id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Gagal memperbarui QR code. Silakan coba lagi.', null, 500);
        }
    }
}
