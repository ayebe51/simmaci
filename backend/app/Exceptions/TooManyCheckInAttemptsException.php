<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * TooManyCheckInAttemptsException
 *
 * Thrown when rate limiting is exceeded (more than 5 check-in attempts in 5 minutes).
 * HTTP Status: 429 Too Many Requests
 */
class TooManyCheckInAttemptsException extends Exception
{
    protected $code = 429;

    public function __construct(string $message = 'Terlalu banyak percobaan check-in dari perangkat Anda. Silakan tunggu beberapa menit.')
    {
        parent::__construct($message);
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $this->message,
            'data' => null,
        ], $this->code);
    }
}
