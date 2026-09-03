<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PpdbPeriod;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PpdbPeriodController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = PpdbPeriod::with('school:id,nama,npsn,jenjang')
            ->withCount('registrations');

        if (!in_array($user->role, ['super_admin', 'admin_yayasan'], true)) {
            $query->where('school_id', $user->school_id);
        } elseif ($request->filled('school_id')) {
            $query->where('school_id', $request->school_id);
        }

        if ($request->filled('academic_year')) {
            $query->where('academic_year', $request->academic_year);
        }

        $periods = $query->orderBy('created_at', 'desc')->paginate($request->input('per_page', 20));

        return $this->paginatedResponse($periods);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'school_id'               => 'nullable|exists:schools,id',
            'academic_year'           => 'required|string|max:20',
            'wave_name'               => 'required|string|max:100',
            'description'             => 'nullable|string',
            'start_date'              => 'required|date',
            'end_date'                => 'required|date|after_or_equal:start_date',
            'announcement_date'       => 'nullable|date|after_or_equal:end_date',
            'reregistration_end_date' => 'nullable|date|after_or_equal:announcement_date',
            'quota'                   => 'required|integer|min:0',
            'is_active'               => 'boolean',
            'available_tracks'        => 'nullable|array',
            'required_documents'      => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors()->toArray());
        }

        $data = $validator->validated();
        if (!in_array($user->role, ['super_admin', 'admin_yayasan'], true)) {
            $data['school_id'] = $user->school_id;
        }

        $period = PpdbPeriod::create($data);

        return $this->successResponse($period, 'Gelombang PPDB berhasil dibuat.', 201);
    }

    public function show(int $id): JsonResponse
    {
        $period = PpdbPeriod::with('school:id,nama,npsn,jenjang')
            ->withCount('registrations')
            ->findOrFail($id);

        return $this->successResponse($period);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $period = PpdbPeriod::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'academic_year'           => 'sometimes|required|string|max:20',
            'wave_name'               => 'sometimes|required|string|max:100',
            'description'             => 'nullable|string',
            'start_date'              => 'sometimes|required|date',
            'end_date'                => 'sometimes|required|date|after_or_equal:start_date',
            'announcement_date'       => 'nullable|date',
            'reregistration_end_date' => 'nullable|date',
            'quota'                   => 'sometimes|required|integer|min:0',
            'is_active'               => 'boolean',
            'available_tracks'        => 'nullable|array',
            'required_documents'      => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors()->toArray());
        }

        $period->update($validator->validated());

        return $this->successResponse($period, 'Gelombang PPDB berhasil diperbarui.');
    }

    public function destroy(int $id): JsonResponse
    {
        $period = PpdbPeriod::findOrFail($id);
        if ($period->registrations()->count() > 0) {
            return $this->errorResponse('Gelombang ini tidak dapat dihapus karena sudah memiliki data pendaftar.', null, 422);
        }

        $period->delete();

        return $this->successResponse(null, 'Gelombang PPDB berhasil dihapus.');
    }
}
