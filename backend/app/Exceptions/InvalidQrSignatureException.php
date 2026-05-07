<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * InvalidQrSignatureException
 *
 * Thrown when QR code signature validation fails.
 * HTTP Status: 403 Forbidden
 */
class InvalidQrSignatureException extends Exception
{
    protected $code = 403;

    public function __construct(string $message = 'QR Code tidak valid atau telah dimodifikasi')
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
