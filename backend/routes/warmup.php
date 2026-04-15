<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

/*
|--------------------------------------------------------------------------
| Warmup Routes
|--------------------------------------------------------------------------
|
| These routes are used to warm up the application after idle periods
| to prevent gateway timeouts on first request.
|
*/

// Simple health check (no DB, no cache)
Route::get('/health', function () {
    return response()->json(['status' => 'ok'], 200);
});

// Deep health check (with DB and cache)
Route::get('/health/deep', function () {
    try {
        // Test database connection
        DB::connection()->getPdo();
        $dbStatus = 'ok';
    } catch (\Exception $e) {
        $dbStatus = 'error: ' . $e->getMessage();
    }

    try {
        // Test cache connection
        Cache::get('health_check');
        $cacheStatus = 'ok';
    } catch (\Exception $e) {
        $cacheStatus = 'error: ' . $e->getMessage();
    }

    return response()->json([
        'status' => 'ok',
        'database' => $dbStatus,
        'cache' => $cacheStatus,
        'timestamp' => now()->toIso8601String(),
    ], 200);
});

// Warmup endpoint - preloads connections
Route::get('/warmup', function () {
    try {
        // Warm up database connection
        DB::connection()->getPdo();
        
        // Warm up cache connection
        Cache::remember('warmup_check', 60, fn() => now()->timestamp);
        
        // Warm up config cache
        config('app.name');
        
        return response()->json([
            'status' => 'warmed_up',
            'timestamp' => now()->toIso8601String(),
        ], 200);
    } catch (\Exception $e) {
        return response()->json([
            'status' => 'error',
            'message' => $e->getMessage(),
        ], 500);
    }
});
