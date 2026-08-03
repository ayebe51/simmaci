<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Pagination\LengthAwarePaginator;

abstract class Controller
{
    use AuthorizesRequests;

    // ── Standard JSON response helpers ────────────────────────────────────────
    // Inlined here (not via trait) so OPcache issues don't affect new controllers.

    protected function success(mixed $data, string $message = 'Berhasil.', int $status = 200): JsonResponse
    {
        $body = ['success' => true, 'data' => $data];
        if ($message !== 'Berhasil.') {
            $body['message'] = $message;
        }
        return response()->json($body, $status);
    }

    protected function error(string $message, mixed $errors = null, int $status = 400): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'errors'  => $errors,
        ], $status);
    }

    protected function successResponse(mixed $data, string $message = 'Berhasil.', int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data'    => $data,
        ], $status);
    }

    protected function errorResponse(string $message, mixed $errors = null, int $status = 400): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'errors'  => $errors,
        ], $status);
    }

    protected function validationErrorResponse(array $errors): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Data tidak valid.',
            'errors'  => $errors,
        ], 422);
    }

    protected function paginatedResponse(LengthAwarePaginator $paginator, string $message = 'Berhasil.'): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data'    => [
                'items' => $paginator->items(),
                'meta'  => [
                    'currentPage' => $paginator->currentPage(),
                    'lastPage'    => $paginator->lastPage(),
                    'perPage'     => $paginator->perPage(),
                    'total'       => $paginator->total(),
                ],
            ],
        ]);
    }
}
