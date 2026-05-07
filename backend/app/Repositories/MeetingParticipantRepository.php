<?php

namespace App\Repositories;

use App\Models\MeetingParticipant;
use App\Repositories\Contracts\MeetingParticipantRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class MeetingParticipantRepository extends BaseRepository implements MeetingParticipantRepositoryInterface
{
    public function __construct()
    {
        parent::__construct(new MeetingParticipant());
    }

    /**
     * Find all participants for a specific meeting.
     *
     * @param int $meetingId
     * @return Collection
     */
    public function findByMeeting(int $meetingId): Collection
    {
        return $this->model
            ->where('meeting_id', $meetingId)
            ->get();
    }

    /**
     * Create a new participant.
     *
     * @param array $data
     * @return MeetingParticipant
     */
    public function create(array $data): MeetingParticipant
    {
        return $this->model->create($data);
    }

    /**
     * Create multiple participants for a meeting.
     *
     * @param int $meetingId
     * @param array $participantsData
     * @return Collection
     */
    public function createMany(int $meetingId, array $participantsData): Collection
    {
        $participants = collect();

        foreach ($participantsData as $data) {
            $data['meeting_id'] = $meetingId;
            $participants->push($this->create($data));
        }

        return $participants;
    }

    /**
     * Lock a participant for update (pessimistic locking).
     * Used to prevent race conditions during concurrent check-in.
     *
     * @param int $id
     * @return MeetingParticipant|null
     */
    public function lockForUpdate(int $id): ?MeetingParticipant
    {
        return $this->model
            ->lockForUpdate()
            ->find($id);
    }

    /**
     * Mark a participant's token as used.
     *
     * @param int $id
     * @param string $timestamp
     * @return bool
     */
    public function updateTokenUsed(int $id, string $timestamp): bool
    {
        $participant = $this->model->find($id);

        if (!$participant) {
            return false;
        }

        return (bool) $participant->update([
            'is_token_used' => true,
            'token_used_at' => $timestamp,
        ]);
    }

    /**
     * Reset a participant's token (mark as unused).
     * Used when admin resets check-in.
     *
     * @param int $id
     * @return bool
     */
    public function resetToken(int $id): bool
    {
        $participant = $this->model->find($id);

        if (!$participant) {
            return false;
        }

        return (bool) $participant->update([
            'is_token_used' => false,
            'token_used_at' => null,
        ]);
    }

    /**
     * Revoke a participant's token.
     * Used when QR code is regenerated.
     *
     * @param int $id
     * @return bool
     */
    public function revokeToken(int $id): bool
    {
        $participant = $this->model->find($id);

        if (!$participant) {
            return false;
        }

        return (bool) $participant->update([
            'token_revoked' => true,
        ]);
    }
}
