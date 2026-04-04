<?php

namespace App\Services;

use App\Models\Teacher;
use App\Repositories\Contracts\TeacherRepositoryInterface;

class TeacherService extends BaseService
{
    public function __construct(TeacherRepositoryInterface $repository)
    {
        parent::__construct($repository);
    }

    public function createTeacher(array $data): Teacher
    {
        /** @var Teacher */
        return $this->repository->create($data);
    }

    public function updateTeacher(Teacher $teacher, array $data): Teacher
    {
        /** @var Teacher */
        return $this->repository->update($teacher, $data);
    }
}
