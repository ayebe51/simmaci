<?php

namespace App\Repositories;

use App\Models\Teacher;
use App\Repositories\Contracts\TeacherRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class TeacherRepository extends BaseRepository implements TeacherRepositoryInterface
{
    public function __construct()
    {
        parent::__construct(new Teacher());
    }

    public function findByNuptk(string $nuptk): ?Teacher
    {
        return Teacher::where('nuptk', $nuptk)->first();
    }

    public function findBySchool(int $schoolId): Collection
    {
        return Teacher::withoutTenantScope()
            ->where('school_id', $schoolId)
            ->get();
    }
}
