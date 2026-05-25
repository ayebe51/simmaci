<?php

namespace Tests\Unit;

use App\Http\Middleware\LogSlowQueries;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class LogSlowQueriesMiddlewareTest extends TestCase
{
    /**
     * Test that the middleware registers a DB listener and the request completes normally.
     * Requirements: 2.4
     */
    public function test_request_completes_normally_with_middleware(): void
    {
        $middleware = new LogSlowQueries();
        $request = Request::create('/api/sk-documents', 'GET');

        $response = $middleware->handle($request, function () {
            return new Response('OK', 200);
        });

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertEquals('OK', $response->getContent());
    }

    /**
     * Test that slow queries (>=500ms) are logged.
     * Requirements: 2.4
     */
    public function test_slow_query_is_logged(): void
    {
        Log::shouldReceive('warning')
            ->once()
            ->withArgs(function ($message, $context) {
                return $message === 'Slow query detected'
                    && $context['duration_ms'] >= 500
                    && isset($context['sql'])
                    && isset($context['uri']);
            });

        $middleware = new LogSlowQueries();
        $request = Request::create('/api/sk-documents', 'GET');

        $middleware->handle($request, function () {
            // Simulate a slow query event by firing the DB event manually
            $event = new \Illuminate\Database\Events\QueryExecuted(
                'SELECT * FROM sk_documents WHERE school_id = ?',
                [1],
                600.0, // 600ms — exceeds 500ms threshold
                DB::connection()
            );
            event($event);

            return new Response('OK', 200);
        });
    }

    /**
     * Test that fast queries (<500ms) are NOT logged.
     * Requirements: 2.4
     */
    public function test_fast_query_is_not_logged(): void
    {
        Log::shouldReceive('warning')->never();

        $middleware = new LogSlowQueries();
        $request = Request::create('/api/sk-documents', 'GET');

        $middleware->handle($request, function () {
            // Simulate a fast query event
            $event = new \Illuminate\Database\Events\QueryExecuted(
                'SELECT * FROM sk_documents WHERE school_id = ?',
                [1],
                50.0, // 50ms — well below 500ms threshold
                DB::connection()
            );
            event($event);

            return new Response('OK', 200);
        });
    }

    /**
     * Test that the middleware does not interfere with the response even if a slow query occurs.
     * Requirements: 2.4
     */
    public function test_response_is_not_affected_by_slow_queries(): void
    {
        Log::shouldReceive('warning')->once()->withAnyArgs();

        $middleware = new LogSlowQueries();
        $request = Request::create('/api/sk-documents', 'GET');

        $expectedBody = json_encode(['data' => [['id' => 1, 'nama' => 'Test SK']]]);

        $response = $middleware->handle($request, function () use ($expectedBody) {
            // Simulate a slow query
            $event = new \Illuminate\Database\Events\QueryExecuted(
                'SELECT * FROM sk_documents',
                [],
                750.0,
                DB::connection()
            );
            event($event);

            return new Response($expectedBody, 200, ['Content-Type' => 'application/json']);
        });

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertEquals($expectedBody, $response->getContent());
    }
}
