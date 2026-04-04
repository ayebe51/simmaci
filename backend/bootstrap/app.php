<?php

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withProviders([
        \App\Providers\AuthServiceProvider::class,
    ])
    ->withMiddleware(function (Middleware $middleware): void {
        // CORS + API observability for all API routes
        $middleware->api(prepend: [
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);

        $middleware->api(append: [
            \App\Http\Middleware\LogApiRequests::class,
        ]);

        $middleware->alias([
            'tenant' => \App\Http\Middleware\EnsureTenantIsValid::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (ValidationException $e, Request $request) {
            return response()->json([
                'success' => false,
                'message' => 'Data tidak valid.',
                'errors'  => $e->errors(),
            ], 422);
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
                'errors'  => null,
            ], 401);
        });

        $exceptions->render(function (AuthorizationException $e, Request $request) {
            return response()->json([
                'success' => false,
                'message' => 'Aksi ini tidak diizinkan.',
                'errors'  => null,
            ], 403);
        });

        $exceptions->render(function (ModelNotFoundException $e, Request $request) {
            return response()->json([
                'success' => false,
                'message' => 'Data tidak ditemukan.',
                'errors'  => null,
            ], 404);
        });

        $exceptions->render(function (\Throwable $e, Request $request) {
            Log::error('Unhandled exception', [
                'tenant_id'       => $request->user()?->school_id,
                'user_id'         => $request->user()?->id,
                'url'             => $request->fullUrl(),
                'method'          => $request->method(),
                'exception_class' => get_class($e),
                'message'         => $e->getMessage(),
                'stack_trace'     => $e->getTraceAsString(),
            ]);

            $response = [
                'success' => false,
                'message' => 'Terjadi kesalahan pada server.',
                'errors'  => null,
            ];

            if (! app()->isProduction()) {
                $response['debug'] = [
                    'exception' => get_class($e),
                    'message'   => $e->getMessage(),
                    'trace'     => explode("\n", $e->getTraceAsString()),
                ];
            }

            return response()->json($response, 500);
        });
    })->create();
