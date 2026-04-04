<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Teacher;
use App\Models\TeacherMutation;
use App\Models\School;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TeacherMutationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = TeacherMutation::with('teacher');

        return response()->json($query->orderByDesc('created_at')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'teacher_id' => 'required|exists:teachers,id',
            'to_school_id' => 'required|exists:schools,id',
            'sk_number' => 'required|string',
            'reason' => 'nullable|string',
            'effective_date' => 'required|date',
        ]);

        $teacher = Teacher::findOrFail($request->teacher_id);
        $toSchool = School::findOrFail($request->to_school_id);
        
        $fromUnit = $teacher->school?->nama ?? 'Akses Global';

        DB::transaction(function () use ($request, $teacher, $toSchool, $fromUnit) {
            // Log the mutation
            TeacherMutation::create([
                'teacher_id' => $teacher->id,
                'from_unit' => $fromUnit,
                'to_unit' => $toSchool->nama,
                'reason' => $request->reason,
                'sk_number' => $request->sk_number,
                'effective_date' => $request->effective_date,
                'performed_by' => $request->user()->name,
            ]);

            // Update teacher's school
            $teacher->update([
                'school_id' => $toSchool->id,
                'unit_kerja' => $toSchool->nama
            ]);
        });

        return response()->json(['success' => true]);
    }
}
