<?php

namespace App\Repositories;

use App\Models\MeetingAttendance;
use App\Repositories\Contracts\MeetingAttendanceRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class MeetingAttendanceRepository extends BaseRepository implements MeetingAttendanceRepositoryInterface
{
    public function __construct()
    {
        parent::__construct(new MeetingAttendance());
    }

    /**
     * Find all attendance records for a specific meeting.
     *
     * @param int $meetingId
     * @return Collection
     */
    public function findByMeeting(int $meetingId): Collection
    {
        return $this->model
            ->where('meeting_id', $meetingId)
            ->with([
                'participant',
                'delegatedForParticipant',
                'checkedInByAdmin',
            ])
            ->get();
    }

    /**
     * Find attendance record for a specific participant in a meeting.
     *
     * @param int $participantId
     * @param int $meetingId
     * @return MeetingAttendance|null
     */
    public function findByParticipantAndMeeting(int $participantId, int $meetingId): ?MeetingAttendance
    {
        return $this->model
            ->where('participant_id', $participantId)
            ->where('meeting_id', $meetingId)
            ->first();
    }

    /**
     * Create a new attendance record.
     *
     * @param array $data
     * @return MeetingAttendance
     */
    public function create(array $data): MeetingAttendance
    {
        return $this->model->create($data);
    }

    /**
     * Get attendance statistics for a meeting.
     * Returns: total, present, absent, delegation, walk_in, percentage.
     *
     * @param int $meetingId
     * @return array
     */
    public function getStats(int $meetingId): array
    {
        $attendances = $this->model
            ->where('meeting_id', $meetingId)
            ->get();

        $total = $attendances->count();
        $present = $attendances->where('attendance_type', 'qr_personal')->count();
        $walkIn = $attendances->where('attendance_type', 'qr_umum')->count();
        $manual = $attendances->where('attendance_type', 'manual')->count();
        $delegation = $attendances->where('is_delegation', true)->count();

        // Get total participants for this meeting
        $totalParticipants = $this->model->newQuery()
            ->from('meeting_participants')
            ->where('meeting_id', $meetingId)
            ->count();

        $absent = $totalParticipants - $total;
        $percentage = $totalParticipants > 0 ? round(($total / $totalParticipants) * 100, 2) : 0;

        return [
            'total' => $total,
            'present' => $present,
            'absent' => $absent,
            'delegation' => $delegation,
            'walk_in' => $walkIn,
            'manual' => $manual,
            'percentage' => $percentage,
        ];
    }

    /**
     * Soft delete all attendance records for a meeting.
     *
     * @param int $meetingId
     * @return int Number of records deleted
     */
    public function softDeleteByMeeting(int $meetingId): int
    {
        return $this->model
            ->where('meeting_id', $meetingId)
            ->delete();
    }
}
