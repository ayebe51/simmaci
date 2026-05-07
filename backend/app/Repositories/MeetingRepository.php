<?php

namespace App\Repositories;

use App\Models\Meeting;
use App\Repositories\Contracts\MeetingRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;

class MeetingRepository extends BaseRepository implements MeetingRepositoryInterface
{
    public function __construct()
    {
        parent::__construct(new Meeting());
    }

    /**
     * Paginate meetings with optional filters.
     * For operators, filter by school_ids to show only meetings involving their school.
     *
     * @param int $perPage
     * @param array $filters
     * @return LengthAwarePaginator
     */
    public function paginate(int $perPage = 25, array $filters = []): LengthAwarePaginator
    {
        $query = $this->model->newQuery();

        // Apply filters
        foreach ($filters as $column => $value) {
            if ($column === 'school_ids' && is_array($value)) {
                // Filter by school_ids for operators
                $query->whereHas('schools', function ($q) use ($value) {
                    $q->whereIn('school_id', $value);
                });
            } elseif ($column === 'status' && $value) {
                // Status is a computed property, filter in memory after fetching
                // This will be handled in the controller/service layer
            } elseif ($value !== null) {
                $query->where($column, $value);
            }
        }

        // Eager load relationships
        $query->with([
            'schools',
            'participants',
            'attendances',
            'creator',
        ]);

        // Order by started_at descending
        $query->orderBy('started_at', 'desc');

        return $query->paginate($perPage);
    }

    /**
     * Find a meeting by ID with eager loaded relationships.
     *
     * @param int $id
     * @return Meeting|null
     */
    public function findById(int $id): ?Meeting
    {
        return $this->model
            ->with([
                'schools',
                'participants',
                'attendances',
                'creator',
            ])
            ->find($id);
    }

    /**
     * Find meetings by school ID.
     *
     * @param int $schoolId
     * @return Collection
     */
    public function findBySchoolId(int $schoolId): Collection
    {
        return $this->model
            ->with([
                'schools',
                'participants',
                'attendances',
            ])
            ->whereHas('schools', function ($query) use ($schoolId) {
                $query->where('school_id', $schoolId);
            })
            ->get();
    }

    /**
     * Create a new meeting with relationships.
     *
     * @param array $data
     * @return Meeting
     */
    public function create(array $data): Meeting
    {
        return $this->model->create($data);
    }

    /**
     * Update a meeting.
     *
     * @param Meeting $meeting
     * @param array $data
     * @return Meeting
     */
    public function update(Meeting $meeting, array $data): Meeting
    {
        $meeting->update($data);
        return $meeting->fresh([
            'schools',
            'participants',
            'attendances',
            'creator',
        ]);
    }

    /**
     * Delete a meeting (soft delete).
     *
     * @param Meeting $meeting
     * @return bool
     */
    public function delete(Meeting $meeting): bool
    {
        return (bool) $meeting->delete();
    }
}
