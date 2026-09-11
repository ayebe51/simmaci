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

        if ($request->user()->isOperator()) {
            $data['school_id'] = $request->user()->school_id;
            $teacher = \App\Models\Teacher::find($data['teacher_id']);
            if (! $teacher || (int) $teacher->school_id !== (int) $request->user()->school_id) {
                abort(403, 'Guru yang dipilih bukan dari sekolah Anda.');
            }
        }

        $data['status'] = 'Pending';
        $data['submitted_at'] = now();

        return response()->json(NuptkSubmission::create($data), 201);
    }

    public function approve(Request $request, NuptkSubmission $nuptkSubmission): JsonResponse
    {
        if (! in_array($request->user()?->role, ['super_admin', 'admin_yayasan'], true)) {
            abort(403, 'Hanya Super Admin / Admin Yayasan yang berwenang menyetujui pengajuan NUPTK.');
        }

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
        if (! in_array($request->user()?->role, ['super_admin', 'admin_yayasan'], true)) {
            abort(403, 'Hanya Super Admin / Admin Yayasan yang berwenang menolak pengajuan NUPTK.');
        }

        $request->validate(['rejection_reason' => 'required|string']);

        $nuptkSubmission->update([
            'status' => 'Rejected',
            'rejection_reason' => $request->rejection_reason,
            'approver_id' => (string) $request->user()->id,
        ]);

        return response()->json($nuptkSubmission->fresh());
    }
}
