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

// Version endpoint - returns safe build metadata
Route::get('/version', function () {
    return response()->json([
        'version'     => config('app.version', '1.0.0'),
        'build'       => env('APP_BUILD_ID', 'production'),
        'environment' => app()->environment(),
        'timestamp'   => now()->toIso8601String(),
    ], 200, [
        'Cache-Control' => 'no-cache, no-store, must-revalidate',
    ]);
});

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
        \Illuminate\Support\Facades\Log::error('[HealthCheck] DB connection failed', ['error' => $e->getMessage()]);
        $dbStatus = app()->isProduction() ? 'unavailable' : ('error: ' . $e->getMessage());
    }

    try {
        // Test cache connection
        Cache::get('health_check');
        $cacheStatus = 'ok';
    } catch (\Exception $e) {
        \Illuminate\Support\Facades\Log::error('[HealthCheck] Cache connection failed', ['error' => $e->getMessage()]);
        $cacheStatus = app()->isProduction() ? 'unavailable' : ('error: ' . $e->getMessage());
    }

    $isHealthy = ($dbStatus === 'ok' && $cacheStatus === 'ok');

    return response()->json([
        'status' => $isHealthy ? 'ok' : 'degraded',
        'database' => $dbStatus,
        'cache' => $cacheStatus,
        'timestamp' => now()->toIso8601String(),
    ], $isHealthy ? 200 : 503);
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
        \Illuminate\Support\Facades\Log::error('[Warmup] Warmup failed', ['error' => $e->getMessage()]);
        return response()->json([
            'status' => 'error',
            'message' => app()->isProduction() ? 'Gagal memproses pemanasan koneksi.' : $e->getMessage(),
        ], 500);
    }
});

