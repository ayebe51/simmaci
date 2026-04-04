<?php

namespace App\Policies;

use App\Models\Event;
use App\Models\User;

class EventPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }
        return null;
    }

    public function view(User $user, Event $event): bool
    {
        return $user->school_id === $event->school_id;
    }

    public function update(User $user, Event $event): bool
    {
        return $user->school_id === $event->school_id;
    }

    public function delete(User $user, Event $event): bool
    {
        return $user->school_id === $event->school_id;
    }
}
