<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Services\MeetingReportService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * MeetingReportController
 *
 * Handles report generation and download (PDF and Excel).
 * Requires authentication and role-based authorization.
 *
 * Requirements: Req 10, 11
 */
class MeetingReportController extends Controller
{
    use ApiResponse;

    public function __construct(
        private MeetingReportService $reportService,
    ) {}

    /**
     * Download meeting attendance report as PDF.
     *
     * Only super_admin and admin_yayasan can download reports.
     *
     * @param Meeting $meeting
     * @param Request $request
     * @return StreamedResponse|JsonResponse
     */
    public function pdf(Meeting $meeting, Request $request): StreamedResponse|JsonResponse
    {
        try {
            $fileName = "Laporan_Kehadiran_{$meeting->title}_" . now()->format('Y-m-d_H-i-s') . '.pdf';

            $pdf = $this->reportService->generatePdf($meeting);

            return response()->streamDownload(
                function () use ($pdf) {
                    echo $pdf;
                },
                $fileName,
                [
                    'Content-Type' => 'application/pdf',
                    'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
                ]
            );
        } catch (\Exception $e) {
            \Log::error('Failed to generate PDF report', [
                'meeting_id' => $meeting->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->errorResponse('Gagal membuat laporan PDF. Silakan coba lagi.', null, 500);
        }
    }

    /**
     * Download meeting attendance report as Excel.
     *
     * Only super_admin and admin_yayasan can download reports.
     *
     * @param Meeting $meeting
     * @param Request $request
     * @return StreamedResponse|JsonResponse
     */
    public function excel(Meeting $meeting, Request $request): StreamedResponse|JsonResponse
    {
        try {
            $fileName = "Laporan_Kehadiran_{$meeting->title}_" . now()->format('Y-m-d_H-i-s') . '.xlsx';

            $excel = $this->reportService->generateExcel($meeting);

            return response()->streamDownload(
                function () use ($excel) {
                    echo $excel;
                },
                $fileName,
                [
                    'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
                ]
            );
        } catch (\Exception $e) {
            \Log::error('Failed to generate Excel report', [
                'meeting_id' => $meeting->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->errorResponse('Gagal membuat laporan Excel. Silakan coba lagi.', null, 500);
        }
    }
}
