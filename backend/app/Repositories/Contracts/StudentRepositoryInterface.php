<?php

namespace App\Repositories\Contracts;

use App\Models\Student;
use Illuminate\Database\Eloquent\Collection;

interface StudentRepositoryInterface extends BaseRepositoryInterface
{
    public function findByNisn(string $nisn): ?Student;

    public function findBySchool(int $schoolId): Collection;
}
