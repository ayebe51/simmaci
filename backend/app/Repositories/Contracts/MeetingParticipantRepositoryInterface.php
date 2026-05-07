<?php

namespace App\Repositories\Contracts;

use App\Models\MeetingParticipant;
use Illuminate\Database\Eloquent\Collection;

interface MeetingParticipantRepositoryInterface extends BaseRepositoryInterface
{
    /**
     * Find all participants for a specific meeting.
     *
     * @param int $meetingId
     * @return Collection
     */
    public function findByMeeting(int $meetingId): Collection;

    /**
     * Create a new participant.
     *
     * @param array $data
     * @return MeetingParticipant
     */
    public function create(array $data): MeetingParticipant;

    /**
     * Create multiple participants for a meeting.
     *
     * @param int $meetingId
     * @param array $participantsData
     * @return Collection
     */
    public function createMany(int $meetingId, array $participantsData): Collection;

    /**
     * Lock a participant for update (pessimistic locking).
     * Used to prevent race conditions during concurrent check-in.
     *
     * @param int $id
     * @return MeetingParticipant|null
     */
    public function lockForUpdate(int $id): ?MeetingParticipant;

    /**
     * Mark a participant's token as used.
     *
     * @param int $id
     * @param string $timestamp
     * @return bool
     */
    public function updateTokenUsed(int $id, string $timestamp): bool;

    /**
     * Reset a participant's token (mark as unused).
     * Used when admin resets check-in.
     *
     * @param int $id
     * @return bool
     */
    public function resetToken(int $id): bool;

    /**
     * Revoke a participant's token.
     * Used when QR code is regenerated.
     *
     * @param int $id
     * @return bool
     */
    public function revokeToken(int $id): bool;
}
