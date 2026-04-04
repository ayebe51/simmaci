<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Teacher;
use App\Models\School;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Carbon\Carbon;

class DataAuditController extends Controller
{
    public function runHealthCheck(Request $request): JsonResponse
    {
        $isOperator = $request->user()->isOperator();
        $schoolId = $request->user()->school_id;

        $query = Teacher::with('school');
        if ($isOperator) {
            $query->forSchool($schoolId);
        }

        $teachers = $query->get();
        $issues = [];

        // 1. Check for Duplicate NUPTK
        $nuptks = $teachers->pluck('nuptk')->filter()->values();
        $duplicates = $nuptks->duplicates();
        foreach ($duplicates as $nuptk) {
            $matching = $teachers->where('nuptk', $nuptk);
            foreach ($matching as $t) {
                $issues[] = [
                    'type' => 'DUPLICATE_NUPTK',
                    'message' => "NUPTK Terdeteksi Ganda: {$nuptk}",
                    'name' => $t->nama,
                    'school' => $t->school?->nama ?? 'Akses Global',
                    'severity' => 'high'
                ];
            }
        }

        // 2. Check for missing birth dates
        foreach ($teachers as $t) {
            if (empty($t->tanggal_lahir)) {
                $issues[] = [
                    'type' => 'MISSING_BIRTHDATE',
                    'message' => "Data Tanggal Lahir Kosong",
                    'name' => $t->nama,
                    'school' => $t->school?->nama ?? 'Akses Global',
                    'severity' => 'medium'
                ];
            }

            // 3. Check for unrealistic age
            if (!empty($t->tanggal_lahir)) {
                try {
                    $age = Carbon::parse($t->tanggal_lahir)->age;
                    if ($age < 18 || $age > 75) {
                        $issues[] = [
                            'type' => 'UNUSUAL_AGE',
                            'message' => "Umur Tidak Wajar: {$age} Tahun",
                            'name' => $t->nama,
                            'school' => $t->school?->nama ?? 'Akses Global',
                            'severity' => 'medium'
                        ];
                    }
                } catch (\Exception $e) {}
            }
        }

        return response()->json($issues);
    }
}
