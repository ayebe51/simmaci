<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Meeting\StoreMinutesRequest;
use App\Http\Requests\Meeting\UpdateMinutesRequest;
use App\Models\Meeting;
use App\Models\MeetingMinutes;
use App\Services\MeetingMinutesService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * MeetingMinutesController
 *
 * Handles REST API endpoints for meeting minutes management.
 * Provides endpoints for creating, updating, viewing, and deleting meeting minutes.
 *
 * **Validates: Requirements 33**
 */
class MeetingMinutesController extends Controller
{
    use ApiResponse;

    public function __construct(
        private MeetingMinutesService $minutesService,
    ) {}

    /**
     * Get minutes for a specific meeting.
     *
     * Retrieves the minutes record for a meeting with related user information.
     * Returns 404 if no minutes exist for the meeting.
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

        $minutes = $this->minutesService->getMinutes($meeting);

        if (!$minutes) {
            return $this->errorResponse('Notulensi untuk rapat ini belum ada.', null, 404);
        }

        return $this->successResponse($minutes, 'Notulensi berhasil diambil.');
    }

    /**
     * Create new meeting minutes.
     *
     * Only super_admin and admin_yayasan can create minutes.
     *
     * @param StoreMinutesRequest $request
     * @param Meeting $meeting
     * @return JsonResponse
     */
    public function store(StoreMinutesRequest $request, Meeting $meeting): JsonResponse
    {
        try {
            $minutes = $this->minutesService->createMinutes(
                $meeting,
                $request->validated(),
                $request->user()
            );

            return $this->successResponse($minutes, 'Notulensi berhasil dibuat.', 201);
        } catch (\Exception $e) {
            \Log::error('Failed to create meeting minutes', [
                'meeting_id' => $meeting->id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse($e->getMessage(), null, 400);
        }
    }

    /**
     * Update existing meeting minutes.
     *
     * Only super_admin and admin_yayasan can update minutes.
     *
     * @param UpdateMinutesRequest $request
     * @param Meeting $meeting
     * @param MeetingMinutes $minutes
     * @return JsonResponse
     */
    public function update(UpdateMinutesRequest $request, Meeting $meeting, MeetingMinutes $minutes): JsonResponse
    {
        // Verify minutes belong to the meeting
        if ($minutes->meeting_id !== $meeting->id) {
            return $this->errorResponse('Notulensi tidak ditemukan untuk rapat ini.', null, 404);
        }

        try {
            $minutes = $this->minutesService->updateMinutes(
                $minutes,
                $request->validated(),
                $request->user()
            );

            return $this->successResponse($minutes, 'Notulensi berhasil diperbarui.');
        } catch (\Exception $e) {
            \Log::error('Failed to update meeting minutes', [
                'meeting_id' => $meeting->id,
                'minutes_id' => $minutes->id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Gagal memperbarui notulensi. Silakan coba lagi.', null, 500);
        }
    }

    /**
     * Delete meeting minutes.
     *
     * Only super_admin and admin_yayasan can delete minutes.
     *
     * @param Meeting $meeting
     * @param MeetingMinutes $minutes
     * @return JsonResponse
     */
    public function destroy(Meeting $meeting, MeetingMinutes $minutes): JsonResponse
    {
        // Verify minutes belong to the meeting
        if ($minutes->meeting_id !== $meeting->id) {
            return $this->errorResponse('Notulensi tidak ditemukan untuk rapat ini.', null, 404);
        }

        try {
            $this->minutesService->deleteMinutes($minutes);

            return $this->successResponse(null, 'Notulensi berhasil dihapus.');
        } catch (\Exception $e) {
            \Log::error('Failed to delete meeting minutes', [
                'meeting_id' => $meeting->id,
                'minutes_id' => $minutes->id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Gagal menghapus notulensi. Silakan coba lagi.', null, 500);
        }
    }
}
