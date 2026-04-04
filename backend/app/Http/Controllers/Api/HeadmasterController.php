<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HeadmasterTenure;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HeadmasterController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = HeadmasterTenure::with(['teacher', 'school']);

        if ($request->status) {
            $query->byStatus($request->status);
        }
        if ($request->user()->isOperator()) {
            $query->where('school_id', $request->user()->school_id);
        }

        return response()->json(
            $query->orderByDesc('created_at')->paginate($request->integer('per_page', 25))
        );
    }

    public function show(HeadmasterTenure $headmasterTenure): JsonResponse
    {
        return response()->json($headmasterTenure->load('teacher', 'school'));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'teacher_id' => 'required|exists:teachers,id',
            'teacher_name' => 'required|string',
            'school_id' => 'required|exists:schools,id',
            'school_name' => 'required|string',
            'periode' => 'required|string',
            'start_date' => 'required|string',
            'end_date' => 'required|string',
            'nomor_sk' => 'nullable|string',
        ]);

        $data['status'] = 'pending';
        $data['created_by'] = $request->user()->email;

        return response()->json(HeadmasterTenure::create($data), 201);
    }

    public function approve(Request $request, HeadmasterTenure $headmasterTenure): JsonResponse
    {
        $headmasterTenure->update([
            'status' => 'active',
            'approved_by' => $request->user()->name,
            'approved_at' => now(),
            'nomor_sk' => $request->nomor_sk,
            'sk_url' => $request->sk_url,
        ]);

        return response()->json($headmasterTenure->fresh());
    }

    public function expiring(Request $request): JsonResponse
    {
        $tenures = HeadmasterTenure::where('status', 'active')
            ->with(['teacher', 'school'])
            ->get()
            ->filter(function ($t) {
                $end = strtotime($t->end_date);
                return $end && $end <= strtotime('+90 days');
            })
            ->sortBy(fn($t) => strtotime($t->end_date))
            ->values();

        return response()->json($tenures);
    }
}
