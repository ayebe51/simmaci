<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * AlreadyCheckedInException
 *
 * Thrown when participant has already checked in (one-time token already used).
 * HTTP Status: 409 Conflict
 */
class AlreadyCheckedInException extends Exception
{
    protected $code = 409;

    public function __construct(string $message = 'Anda sudah melakukan check-in')
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
