<?php

namespace App\Services;

use App\Models\Student;
use App\Repositories\Contracts\StudentRepositoryInterface;

class StudentService extends BaseService
{
    public function __construct(StudentRepositoryInterface $repository)
    {
        parent::__construct($repository);
    }

    public function createStudent(array $data): Student
    {
        /** @var Student */
        return $this->repository->create($data);
    }

    public function updateStudent(Student $student, array $data): Student
    {
        /** @var Student */
        return $this->repository->update($student, $data);
    }
}
