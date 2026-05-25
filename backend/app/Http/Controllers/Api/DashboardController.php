<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardCacheService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(
        private readonly DashboardCacheService $cacheService
    ) {}

    /**
     * GET /api/dashboard/stats — Super admin global stats
     */
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $this->cacheService->getStats($user);

        return $this->successResponse($data);
    }

    /**
     * GET /api/dashboard/school-stats — Operator school-specific stats
     */
    public function schoolStats(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! in_array($user->role, ['operator', 'admin_yayasan']) || ! $user->school_id) {
            return response()->json(['error' => 'Not an operator or no school assigned'], 403);
        }

        $data = $this->cacheService->getSchoolStats($user);

        return $this->successResponse($data);
    }

    /**
     * GET /api/dashboard/school-statistics
     * Returns school statistics by affiliation and jenjang
     */
    public function getSchoolStatistics(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $data = $this->cacheService->getSchoolStatistics($user);

            return $this->successResponse($data, 'Statistik sekolah berhasil diambil');
        } catch (\Exception $e) {
            \Log::error('Failed to get school statistics', [
                'error' => $e->getMessage(),
                'user_id' => $request->user()->id,
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->errorResponse(
                'Gagal mengambil statistik sekolah',
                $e->getMessage(),
                500
            );
        }
    }

    /**
     * GET /api/dashboard/charts
     */
    public function charts(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $this->cacheService->getCharts($user);

        return $this->successResponse($data);
    }

    /**
     * GET /api/dashboard/sk-statistics
     */
    public function skStatistics(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $this->cacheService->getSkStatistics($user);

        return $this->successResponse($data);
    }

    /**
     * GET /api/dashboard/sk-trend
     */
    public function skTrend(Request $request): JsonResponse
    {
        $user = $request->user();
        $months = $request->integer('months', 6);
        $data = $this->cacheService->getSkTrend($user, $months);

        return $this->successResponse($data);
    }

    /**
     * GET /api/dashboard/school-breakdown
     */
    public function schoolBreakdown(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $this->cacheService->getSchoolBreakdown($user);

        return $this->successResponse($data);
    }
}
