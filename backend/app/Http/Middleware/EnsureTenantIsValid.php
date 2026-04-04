<?php

namespace App\Http\Middleware;

use App\Models\School;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantIsValid
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // Super Admin bypasses tenant validation
        if ($user && $user->isSuperAdmin()) {
            return $next($request);
        }

        // Operator must have a valid, active school
        if (! $user || is_null($user->school_id)) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant tidak valid atau tidak aktif.',
                'errors'  => null,
            ], 403);
        }

        $school = School::find($user->school_id);

        if (! $school || $school->status !== 'Aktif') {
            return response()->json([
                'success' => false,
                'message' => 'Tenant tidak valid atau tidak aktif.',
                'errors'  => null,
            ], 403);
        }

        return $next($request);
    }
}
