<?php

namespace App\Repositories;

use App\Models\Student;
use App\Repositories\Contracts\StudentRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class StudentRepository extends BaseRepository implements StudentRepositoryInterface
{
    public function __construct()
    {
        parent::__construct(new Student());
    }

    public function findByNisn(string $nisn): ?Student
    {
        return Student::where('nisn', $nisn)->first();
    }

    public function findBySchool(int $schoolId): Collection
    {
        return Student::withoutTenantScope()
            ->where('school_id', $schoolId)
            ->get();
    }
}
