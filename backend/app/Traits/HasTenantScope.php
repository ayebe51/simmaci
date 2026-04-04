<?php

namespace App\Traits;

use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Builder;

trait HasTenantScope
{
    /**
     * Boot the trait — register TenantScope as a Global Scope and
     * auto-fill school_id on the creating event for Operators.
     */
    public static function bootHasTenantScope(): void
    {
        static::addGlobalScope(new TenantScope());

        static::creating(function ($model) {
            $user = auth()->user();

            if (! $user) {
                return;
            }

            // Only auto-fill for Operators (non-super-admin) when school_id is not already set
            if (
                ! in_array($user->role, ['super_admin', 'admin_yayasan'], true)
                && is_null($model->school_id)
                && ! is_null($user->school_id)
            ) {
                $model->school_id = $user->school_id;
            }
        });
    }

    /**
     * Return a query builder with TenantScope removed,
     * allowing cross-tenant queries (for Super Admin / Jobs).
     */
    public static function withoutTenantScope(): Builder
    {
        return static::withoutGlobalScope(TenantScope::class);
    }
}
