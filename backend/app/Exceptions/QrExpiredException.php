<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * QrExpiredException
 *
 * Thrown when QR code has expired (outside H-1 to H+1 window).
 * HTTP Status: 410 Gone
 */
class QrExpiredException extends Exception
{
    protected $code = 410;

    public function __construct(string $message = 'QR Code sudah tidak berlaku')
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
