<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HeadmasterTenure;
use App\Models\Notification;
use App\Models\School;
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
            'surat_permohonan_number' => 'nullable|string',
            'surat_permohonan_date' => 'nullable|string',
            'keterangan' => 'nullable|string',
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
        $limit = strtotime('+180 days'); // 6 bulan sebelum berakhir
        $user = $request->user();

        // 1. Data from formal tenures (SK)
        $tenureQuery = HeadmasterTenure::where('status', 'active')->with(['teacher', 'school']);
        if ($user->isOperator()) {
            $tenureQuery->where('school_id', $user->school_id);
        }

        $tenures = $tenureQuery->get()->filter(function ($t) {
            $end = strtotime($t->end_date);
            return $end && $end <= strtotime('+180 days'); // 6 bulan
        });

        // 2. Data from School Profiles (Manual detect)
        $schoolQuery = School::whereNotNull('kepala_jabatan_selesai');
        if ($user->isOperator()) {
            $schoolQuery->where('id', $user->school_id);
        }

        $schoolStats = $schoolQuery->get()->filter(function ($s) use ($limit) {
            $end = strtotime($s->kepala_jabatan_selesai);
            return $end && $end <= $limit;
        })->map(function ($s) {
            return [
                'id' => 'legacy-' . $s->id,
                'teacher_name' => $s->kepala_madrasah . ' (Profil Lembaga)',
                'school_name' => $s->nama,
                'periode' => 'Masa Jabatan Aktif',
                'start_date' => $s->kepala_jabatan_mulai,
                'end_date' => $s->kepala_jabatan_selesai,
                'status' => 'active',
                'source' => 'profile'
            ];
        });

        $combined = collect($tenures)->merge($schoolStats)->sortBy(fn($t) => is_array($t) ? strtotime($t['end_date']) : strtotime($t->end_date))->values();

        return response()->json($combined);
    }
}
