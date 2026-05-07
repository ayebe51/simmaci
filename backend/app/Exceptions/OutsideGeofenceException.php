<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * OutsideGeofenceException
 *
 * Thrown when participant's geolocation is outside the allowed radius.
 * HTTP Status: 422 Unprocessable Entity
 */
class OutsideGeofenceException extends Exception
{
    protected $code = 422;

    public function __construct(string $message = 'Anda berada di luar area rapat')
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
