<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    /**
     * GET /api/reports/sk — SK summary report
     */
    public function skReport(Request $request): JsonResponse
    {
        $query = SkDocument::with('teacher');

        if ($request->user()->isOperator()) {
            $query->forSchool($request->user()->school_id);
        } elseif ($request->school_id) {
            $query->forSchool($request->school_id);
        }

        if ($request->jenis_sk) $query->byJenis($request->jenis_sk);
        if ($request->status) $query->byStatus($request->status);
        if ($request->start_date) $query->where('created_at', '>=', $request->start_date);
        if ($request->end_date) $query->where('created_at', '<=', $request->end_date);

        $sks = $query->orderByDesc('created_at')->get();

        return response()->json([
            'total' => $sks->count(),
            'by_status' => $sks->groupBy('status')->map->count(),
            'by_jenis' => $sks->groupBy('jenis_sk')->map->count(),
            'data' => $sks,
        ]);
    }

    /**
     * GET /api/reports/teachers — Teacher summary report
     */
    public function teacherReport(Request $request): JsonResponse
    {
        $query = Teacher::with('school');

        if ($request->user()->isOperator()) {
            $query->forSchool($request->user()->school_id);
        }

        $teachers = $query->where('is_active', true)->get();

        $byStatus = $teachers->groupBy('status')->map->count();
        $byCertification = [
            'Sudah Sertifikasi' => $teachers->where('is_certified', true)->count(),
            'Belum Sertifikasi' => $teachers->where('is_certified', false)->count(),
        ];
        $bySchool = $teachers->groupBy(fn($t) => $t->unit_kerja ?? 'Unknown')->map->count()->sortDesc()->take(20);

        return response()->json([
            'total' => $teachers->count(),
            'by_status' => $byStatus,
            'by_certification' => $byCertification,
            'by_school' => $bySchool,
            'data' => $teachers,
        ]);
    }

    /**
     * GET /api/reports/summary — Overall system summary
     */
    public function summary(): JsonResponse
    {
        return response()->json([
            'schools' => School::count(),
            'teachers' => Teacher::where('is_active', true)->count(),
            'students' => Student::where('status', 'Aktif')->count(),
            'sk_total' => SkDocument::count(),
            'sk_active' => SkDocument::whereIn('status', ['active', 'approved'])->count(),
            'sk_pending' => SkDocument::where('status', 'draft')->count(),
        ]);
    }
}
