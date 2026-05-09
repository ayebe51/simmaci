<?php

namespace App\Policies;

use App\Models\SkDocument;
use App\Models\User;

class SkDocumentPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }
        return null;
    }

    public function view(User $user, SkDocument $skDocument): bool
    {
        return $user->school_id === $skDocument->school_id;
    }

    public function update(User $user, SkDocument $skDocument): bool
    {
        return $user->school_id === $skDocument->school_id;
    }

    /**
     * Only super_admin and admin_yayasan can approve or reject SK documents.
     * Operators are not allowed to change status to approved/rejected.
     */
    public function approve(User $user, SkDocument $skDocument): bool
    {
        return in_array($user->role, ['super_admin', 'admin_yayasan']);
    }

    public function delete(User $user, SkDocument $skDocument): bool
    {
        return $user->school_id === $skDocument->school_id;
    }
}
