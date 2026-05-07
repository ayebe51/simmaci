<?php

namespace App\Repositories\Contracts;

use App\Models\MeetingAttendance;
use Illuminate\Database\Eloquent\Collection;

interface MeetingAttendanceRepositoryInterface extends BaseRepositoryInterface
{
    /**
     * Find all attendance records for a specific meeting.
     *
     * @param int $meetingId
     * @return Collection
     */
    public function findByMeeting(int $meetingId): Collection;

    /**
     * Create a new attendance record.
     *
     * @param array $data
     * @return MeetingAttendance
     */
    public function create(array $data): MeetingAttendance;

    /**
     * Get attendance statistics for a meeting.
     * Returns: total, present, absent, delegation, walk_in, percentage.
     *
     * @param int $meetingId
     * @return array
     */
    public function getStats(int $meetingId): array;

    /**
     * Soft delete all attendance records for a meeting.
     *
     * @param int $meetingId
     * @return int Number of records deleted
     */
    public function softDeleteByMeeting(int $meetingId): int;
}
