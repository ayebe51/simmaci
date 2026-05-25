<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Logs database queries that exceed a configurable threshold.
 *
 * Registers a DB::listen() callback at the start of the request
 * to capture slow queries. The request always completes normally
 * regardless of query duration — this middleware only observes and logs.
 */
class LogSlowQueries
{
    /**
     * Slow query threshold in milliseconds.
     */
    private const THRESHOLD_MS = 500;

    public function handle(Request $request, Closure $next): Response
    {
        DB::listen(function ($query) use ($request) {
            if ($query->time >= self::THRESHOLD_MS) {
                Log::warning('Slow query detected', [
                    'sql'         => $query->sql,
                    'duration_ms' => round($query->time, 2),
                    'bindings'    => $query->bindings,
                    'uri'         => $request->getRequestUri(),
                    'method'      => $request->method(),
                    'user_id'     => $request->user()?->id,
                ]);
            }
        });

        return $next($request);
    }
}
