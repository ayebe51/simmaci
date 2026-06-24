<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HeadmasterRecommendation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HeadmasterRecommendationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = HeadmasterRecommendation::with(['teacher', 'school']);

        // Operator only sees their own school
        if ($request->user()->isOperator()) {
            $query->where('school_id', $request->user()->school_id);
        }

        if ($request->status) {
            $query->byStatus($request->status);
        }

        if ($request->search) {
            $search = $request->search;
            $query->whereHas('teacher', function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%");
            });
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
            'is_reappointment' => 'boolean',
            'documents' => 'required|array',
            'documents.cv' => 'nullable|string',
            'documents.kartu_ptk' => 'nullable|string',
            'documents.ijazah_s1' => 'nullable|string',
            'documents.sertifikat_pendidik' => 'nullable|string',
            'documents.sk_guru' => 'nullable|string',
            'documents.sk_pns' => 'nullable|string',
            'documents.pengalaman_manajerial' => 'nullable|string',
            'documents.masa_kerja' => 'nullable|string',
            'documents.form_a09' => 'nullable|string',
            'documents.keterangan_sehat' => 'nullable|string',
            'documents.bebas_hukuman' => 'nullable|string',
            'documents.bebas_pidana' => 'nullable|string',
            'documents.pk_guru' => 'nullable|string',
            'documents.pk_kepala' => 'nullable|string',
            'documents.ktp' => 'nullable|string',
            'documents.rekomendasi' => 'nullable|string',
        ]);

        $data['status'] = 'Pending';
        $data['submitted_at'] = now();
        $data['is_reappointment'] = $request->boolean('is_reappointment');

        $recommendation = HeadmasterRecommendation::create($data);

        return response()->json($recommendation, 201);
    }

    public function show(Request $request, HeadmasterRecommendation $headmasterRecommendation): JsonResponse
    {
        if ($request->user()->isOperator() && $headmasterRecommendation->school_id !== $request->user()->school_id) {
            abort(403, 'Unauthorized access.');
        }

        return response()->json($headmasterRecommendation->load(['teacher', 'school', 'approver']));
    }

    public function approve(Request $request, HeadmasterRecommendation $headmasterRecommendation): JsonResponse
    {
        if (! in_array($request->user()->role, ['super_admin', 'admin_yayasan'], true)) {
            abort(403, 'Hanya Admin Yayasan dan Super Admin yang dapat menyetujui.');
        }

        $headmasterRecommendation->update([
            'status' => 'Approved',
            'approved_at' => now(),
            'approver_id' => $request->user()->id,
        ]);

        return response()->json($headmasterRecommendation->fresh()->load('teacher', 'school', 'approver'));
    }

    public function reject(Request $request, HeadmasterRecommendation $headmasterRecommendation): JsonResponse
    {
        if (! in_array($request->user()->role, ['super_admin', 'admin_yayasan'], true)) {
            abort(403, 'Hanya Admin Yayasan dan Super Admin yang dapat menolak.');
        }

        $request->validate(['rejection_reason' => 'required|string']);

        $headmasterRecommendation->update([
            'status' => 'Rejected',
            'rejection_reason' => $request->rejection_reason,
            'approver_id' => $request->user()->id,
        ]);

        return response()->json($headmasterRecommendation->fresh()->load('teacher', 'school', 'approver'));
    }
}
