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

        // Skip PostgreSQL-specific SET commands for non-PostgreSQL databases (SQLite in tests, etc.)
        $driver = config('database.default');
        $connection = DB::connection();
        
        // Double-check: use both config and actual connection driver
        if ($driver !== 'pgsql' && $connection->getDriverName() !== 'pgsql') {
            return $next($request);
        }

        // Additional safety: skip if we're in testing environment with SQLite
        if (app()->environment('testing') && $connection->getDriverName() === 'sqlite') {
            return $next($request);
        }

        if ($user && $user->isOperator()) {
            if ($user->school_id) {
                DB::statement("SET app.current_school_id = '{$user->school_id}'");
            } else {
                // Orphaned operator: allow seeing all schools temporarily so auto-heal can find them.
                // This is safe now because migrations fixed the ::bigint crash.
                DB::statement("SET app.current_school_id = ''");
            }
        } else {
            // Super Admin or anonymous: bypass RLS
            DB::statement("SET app.current_school_id TO DEFAULT");
        }

        return $next($request);
    }
}
