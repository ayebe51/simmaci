<?php

namespace App\Policies;

use App\Models\Student;
use App\Models\User;

class StudentPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }
        return null;
    }

    public function view(User $user, Student $student): bool
    {
        return $user->school_id === $student->school_id;
    }

    public function update(User $user, Student $student): bool
    {
        return $user->school_id === $student->school_id;
    }

    public function delete(User $user, Student $student): bool
    {
        return $user->school_id === $student->school_id;
    }
}
