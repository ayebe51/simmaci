<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            // Register warmup routes (health checks and connection warming)
            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/warmup.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Note: NOT using EnsureFrontendRequestsAreStateful because
        // this app uses token-based auth (Bearer), not cookie/session auth.
        // Adding it causes "CSRF token mismatch" errors on login.

        $middleware->alias([
            'verified'     => \App\Http\Middleware\EnsureEmailIsVerified::class,
            'tenant'       => \App\Http\Middleware\TenantScope::class,
            'valid_tenant' => \App\Http\Middleware\EnsureTenantIsValid::class,
            'role'         => \App\Http\Middleware\CheckRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();

// Compatibility Bridge for Legacy Packages/Middlewares
$app->instance('env', 'local');

return $app;
