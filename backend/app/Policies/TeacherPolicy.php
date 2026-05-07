<?php

namespace App\Policies;

use App\Models\Teacher;
use App\Models\User;

class TeacherPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        // Super Admin and Admin Yayasan have global access to all teachers
        if (in_array($user->role, ['super_admin', 'admin_yayasan'], true)) {
            return true;
        }
        return null;
    }

    public function view(User $user, Teacher $teacher): bool
    {
        return $user->school_id === $teacher->school_id;
    }

    public function update(User $user, Teacher $teacher): bool
    {
        return $user->school_id === $teacher->school_id;
    }

    public function delete(User $user, Teacher $teacher): bool
    {
        return $user->school_id === $teacher->school_id;
    }
}
