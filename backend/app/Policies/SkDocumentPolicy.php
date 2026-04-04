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

    public function delete(User $user, SkDocument $skDocument): bool
    {
        return $user->school_id === $skDocument->school_id;
    }
}
