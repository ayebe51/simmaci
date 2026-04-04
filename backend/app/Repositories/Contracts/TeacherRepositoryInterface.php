<?php

namespace App\Repositories\Contracts;

use App\Models\Teacher;
use Illuminate\Database\Eloquent\Collection;

interface TeacherRepositoryInterface extends BaseRepositoryInterface
{
    public function findByNuptk(string $nuptk): ?Teacher;

    public function findBySchool(int $schoolId): Collection;
}
