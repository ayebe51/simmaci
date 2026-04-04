<?php

namespace App\Policies;

use App\Models\NuptkSubmission;
use App\Models\User;

class NuptkSubmissionPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }
        return null;
    }

    public function view(User $user, NuptkSubmission $nuptkSubmission): bool
    {
        return $user->school_id === $nuptkSubmission->school_id;
    }

    public function update(User $user, NuptkSubmission $nuptkSubmission): bool
    {
        return $user->school_id === $nuptkSubmission->school_id;
    }

    public function delete(User $user, NuptkSubmission $nuptkSubmission): bool
    {
        return $user->school_id === $nuptkSubmission->school_id;
    }
}
