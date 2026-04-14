<?php

namespace App\Models\Scopes;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

class TenantScope implements Scope
{
    /**
     * Super Admin roles that bypass tenant filtering.
     */
    private const SUPER_ADMIN_ROLES = ['super_admin', 'admin_yayasan'];

    /**
     * Apply the scope to a given Eloquent query builder.
     *
     * @throws AuthorizationException
     */
    public function apply(Builder $builder, Model $model): void
    {
        $user = auth()->user();

        // No authenticated user — let auth middleware handle it
        if (! $user) {
            return;
        }

        // Super Admin bypasses tenant filter entirely
        if (in_array($user->role, self::SUPER_ADMIN_ROLES, true)) {
            return;
        }

        // Operator without a valid school_id — reject with clear message
        if (is_null($user->school_id)) {
            throw new AuthorizationException('Akun operator belum terhubung ke sekolah. Hubungi administrator.');
        }

        // Operator — filter by their school_id
        $builder->where($model->getTable() . '.school_id', $user->school_id);
    }
}
