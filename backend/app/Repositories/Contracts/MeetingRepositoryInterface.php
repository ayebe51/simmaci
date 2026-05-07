<?php

namespace App\Repositories\Contracts;

use App\Models\Meeting;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;

interface MeetingRepositoryInterface extends BaseRepositoryInterface
{
    /**
     * Paginate meetings with optional filters.
     * For operators, filter by school_ids to show only meetings involving their school.
     *
     * @param int $perPage
     * @param array $filters
     * @return LengthAwarePaginator
     */
    public function paginate(int $perPage = 25, array $filters = []): LengthAwarePaginator;

    /**
     * Find a meeting by ID with eager loaded relationships.
     *
     * @param int $id
     * @return Meeting|null
     */
    public function findById(int $id): ?Meeting;

    /**
     * Find meetings by school ID.
     *
     * @param int $schoolId
     * @return Collection
     */
    public function findBySchoolId(int $schoolId): Collection;

    /**
     * Create a new meeting with relationships.
     *
     * @param array $data
     * @return Meeting
     */
    public function create(array $data): Meeting;

    /**
     * Update a meeting.
     *
     * @param Meeting $meeting
     * @param array $data
     * @return Meeting
     */
    public function update(Meeting $meeting, array $data): Meeting;

    /**
     * Delete a meeting (soft delete).
     *
     * @param Meeting $meeting
     * @return bool
     */
    public function delete(Meeting $meeting): bool;
}
