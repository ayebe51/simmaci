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
     * Find meetings by school ID.
     *
     * @param int $schoolId
     * @return Collection
     */
    public function findBySchoolId(int $schoolId): Collection;
}
