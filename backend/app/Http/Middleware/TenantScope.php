<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Sets PostgreSQL RLS variable for tenant isolation.
 * Super admins bypass RLS (no school_id set).
 * Operators have their school_id injected into the DB session.
 */
class TenantScope
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($user && $user->isOperator() && $user->school_id) {
            DB::statement("SET app.current_school_id = '{$user->school_id}'");
        } else {
            // Super admin / no user: clear the variable so RLS USING clause passes all rows
            DB::statement("SET app.current_school_id = ''");
        }

        return $next($request);
    }
}
