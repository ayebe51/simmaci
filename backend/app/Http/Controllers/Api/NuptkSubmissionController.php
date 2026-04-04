<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NuptkSubmission;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NuptkSubmissionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = NuptkSubmission::with(['teacher', 'school']);

        if ($request->user()->isOperator()) {
            $query->where('school_id', $request->user()->school_id);
        }
        if ($request->status) {
            $query->byStatus($request->status);
        }

        return response()->json(
            $query->orderByDesc('submitted_at')->paginate($request->integer('per_page', 25))
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'teacher_id' => 'required|exists:teachers,id',
            'school_id' => 'required|exists:schools,id',
            'dokumen_ktp_id' => 'nullable|string',
            'dokumen_ijazah_id' => 'nullable|string',
            'dokumen_pengangkatan_id' => 'nullable|string',
            'dokumen_penugasan_id' => 'nullable|string',
        ]);

        $data['status'] = 'Pending';
        $data['submitted_at'] = now();

        return response()->json(NuptkSubmission::create($data), 201);
    }

    public function approve(Request $request, NuptkSubmission $nuptkSubmission): JsonResponse
    {
        $request->validate([
            'nomor_surat_rekomendasi' => 'required|string',
            'tanggal_surat_rekomendasi' => 'required|string',
        ]);

        $nuptkSubmission->update([
            'status' => 'Approved',
            'approved_at' => now(),
            'approver_id' => (string) $request->user()->id,
            'nomor_surat_rekomendasi' => $request->nomor_surat_rekomendasi,
            'tanggal_surat_rekomendasi' => $request->tanggal_surat_rekomendasi,
        ]);

        return response()->json($nuptkSubmission->fresh()->load('teacher', 'school'));
    }

    public function reject(Request $request, NuptkSubmission $nuptkSubmission): JsonResponse
    {
        $request->validate(['rejection_reason' => 'required|string']);

        $nuptkSubmission->update([
            'status' => 'Rejected',
            'rejection_reason' => $request->rejection_reason,
            'approver_id' => (string) $request->user()->id,
        ]);

        return response()->json($nuptkSubmission->fresh());
    }
}
