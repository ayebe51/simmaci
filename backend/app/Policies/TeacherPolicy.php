<?php

namespace App\Policies;

use App\Models\Teacher;
use App\Models\User;

class TeacherPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        if ($user->role === 'super_admin') {
            return true;
        }
        
        if ($user->role === 'admin_yayasan') {
            // admin_yayasan dapat melihat, mengedit, dan menghapus data guru di semua sekolah
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
