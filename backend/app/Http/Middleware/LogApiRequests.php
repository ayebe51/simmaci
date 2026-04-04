<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Logs all incoming API requests and outgoing responses.
 *
 * Provides observability into API usage patterns, latency,
 * and error rates. Sensitive fields (password, token) are
 * automatically redacted from logs.
 */
class LogApiRequests
{
    /**
     * Fields to redact from request/response payloads.
     */
    private const REDACTED_FIELDS = [
        'password',
        'old_password',
        'new_password',
        'token',
        'authorization',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $startTime = microtime(true);

        // Process request
        $response = $next($request);

        $duration = round((microtime(true) - $startTime) * 1000, 2);
        $statusCode = $response->getStatusCode();

        // Build log context
        $context = [
            'method'      => $request->method(),
            'uri'         => $request->getRequestUri(),
            'status'      => $statusCode,
            'duration_ms' => $duration,
            'ip'          => $request->ip(),
            'user_id'     => $request->user()?->id,
            'user_agent'  => substr($request->userAgent() ?? '', 0, 100),
        ];

        // Add redacted request body for non-GET requests
        if (! $request->isMethod('GET') && $request->all()) {
            $context['body'] = $this->redact($request->all());
        }

        // Choose log level based on status code
        $message = "{$request->method()} {$request->getRequestUri()} → {$statusCode} ({$duration}ms)";

        if ($statusCode >= 500) {
            Log::channel('api')->error($message, $context);
        } elseif ($statusCode >= 400) {
            Log::channel('api')->warning($message, $context);
        } else {
            Log::channel('api')->info($message, $context);
        }

        return $response;
    }

    /**
     * Redact sensitive fields from the payload.
     */
    private function redact(array $data): array
    {
        foreach ($data as $key => $value) {
            if (in_array(strtolower($key), self::REDACTED_FIELDS)) {
                $data[$key] = '***REDACTED***';
            } elseif (is_array($value)) {
                $data[$key] = $this->redact($value);
            }
        }

        return $data;
    }
}
