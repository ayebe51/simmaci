<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\School;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SchoolController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = School::query();

        if ($request->search) {
            $query->where('nama', 'ilike', "%{$request->search}%");
        }
        if ($request->kecamatan) {
            $query->byKecamatan($request->kecamatan);
        }

        $schools = $query->orderBy('nama')->paginate($request->integer('per_page', 25));

        // Sanitize output to prevent UTF-8 errors
        $schools->getCollection()->transform(function ($school) {
            foreach ($school->getAttributes() as $key => $value) {
                if (is_string($value)) {
                    $school->$key = htmlspecialchars_decode(htmlspecialchars($value, ENT_SUBSTITUTE, 'UTF-8'));
                }
            }
            return $school;
        });

        return response()->json($schools);
    }

    public function show(School $school): JsonResponse
    {
        return response()->json($school->loadCount(['teachers', 'students', 'skDocuments']));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nsm' => 'nullable|string|unique:schools,nsm',
            'npsn' => 'nullable|string|unique:schools,npsn',
            'nama' => 'required|string|max:255',
            'alamat' => 'nullable|string',
            'kecamatan' => 'nullable|string',
            'telepon' => 'nullable|string',
            'email' => 'nullable|email',
            'kepala_madrasah' => 'nullable|string',
            'akreditasi' => 'nullable|string',
            'status' => 'nullable|string',
            'status_jamiyyah' => 'nullable|string',
            'provinsi' => 'nullable|string',
            'kabupaten' => 'nullable|string',
            'kelurahan' => 'nullable|string',
        ]);

        return response()->json(School::create($data), 201);
    }

    public function update(Request $request, School $school): JsonResponse
    {
        $school->update($request->only([
            'nsm', 'npsn', 'nama', 'alamat', 'provinsi', 'kabupaten',
            'kecamatan', 'kelurahan', 'telepon', 'email',
            'kepala_madrasah', 'akreditasi', 'status_jamiyyah',
        ]));

        return response()->json($school->fresh());
    }

    public function destroy(School $school): JsonResponse
    {
        $school->delete();
        return response()->json(['success' => true]);
    }

    /**
     * POST /api/schools/import
     */
    public function import(Request $request): JsonResponse
    {
        try {
            $request->validate(['schools' => 'required|array']);

            $created = 0;
            $errors = [];

            // Whitelist of fields allowed in the schools table
            $allowedFields = [
                'nsm', 'npsn', 'nama', 'alamat', 'provinsi', 'kabupaten', 'kecamatan', 
                'kelurahan', 'telepon', 'email', 'kepala_madrasah', 'akreditasi', 
                'status', 'status_jamiyyah', 'npsm_nu'
            ];

            foreach ($request->schools as $index => $row) {
                try {
                    // Normalize keys: trim, lowercase, replace non-alphanumeric with underscore
                    $normalizedRow = [];
                    foreach ($row as $key => $value) {
                        $cleanKey = preg_replace('/[^a-z0-9]/', '_', trim(strtolower($key)));
                        $cleanKey = preg_replace('/_+/', '_', $cleanKey);
                        $cleanKey = trim($cleanKey, '_');
                        
                        // Sanitize value for UTF-8
                        if (is_string($value)) {
                            $value = htmlspecialchars_decode(htmlspecialchars($value, ENT_SUBSTITUTE, 'UTF-8'));
                        }
                        $normalizedRow[$cleanKey] = $value;
                    }

                    // NSM Selection with Aliases
                    $nsm = $normalizedRow['nsm'] 
                        ?? $normalizedRow['nsm_nss']
                        ?? $normalizedRow['nomor_statistik'] 
                        ?? $normalizedRow['no_statistik'] 
                        ?? $normalizedRow['n_s_m']
                        ?? null;
                    
                    $nsm = $nsm ? trim((string)$nsm) : null;
                    $npsn = isset($normalizedRow['npsn']) ? trim((string)$normalizedRow['npsn']) : null;

                    // Filter row to only include allowed fields
                    $dataToSave = [];
                    foreach ($allowedFields as $field) {
                        if (isset($normalizedRow[$field])) {
                            $dataToSave[$field] = $normalizedRow[$field];
                        }
                    }

                    // Special Mapping for Aliases
                    if (empty($dataToSave['nama'])) {
                        $dataToSave['nama'] = $normalizedRow['nama_satuan_pendidikan'] 
                            ?? $normalizedRow['nama_sekolah'] 
                            ?? $normalizedRow['nama_madrasah'] 
                            ?? $normalizedRow['nama_lembaga'] 
                            ?? $normalizedRow['madrasah']
                            ?? null;
                    }

                    if (empty($dataToSave['nama'])) {
                        // If everything is empty, this might be a blank row trailing at the end of excel
                        if (empty(array_filter($normalizedRow))) {
                            continue; 
                        }
                        $dataToSave['nama'] = "Sekolah Baru (Harap lengkapi)";
                    }

                    if (empty($dataToSave['kepala_madrasah'])) {
                        $dataToSave['kepala_madrasah'] = $normalizedRow['nama_kepala_madrasah'] ?? null;
                    }

                    if (empty($dataToSave['telepon'])) {
                        $dataToSave['telepon'] = $normalizedRow['nomor_hp'] ?? $normalizedRow['no_hp'] ?? null;
                    }

                    if (empty($dataToSave['status_jamiyyah'])) {
                        $dataToSave['status_jamiyyah'] = $normalizedRow['status_jam_iyyah_jama_ah'] ?? null;
                    }

                    // Decide how to save: update by NSM, by NPSN, or just create
                    if ($nsm) {
                        School::updateOrCreate(['nsm' => $nsm], array_filter($dataToSave, fn($v) => !is_null($v)));
                    } elseif ($npsn) {
                        School::updateOrCreate(['npsn' => $npsn], array_filter($dataToSave, fn($v) => !is_null($v)));
                    } else {
                        School::create(array_filter($dataToSave, fn($v) => !is_null($v)));
                    }
                    $created++;
                } catch (\Throwable $e) {
                    // Return more detail for debugging
                    $errors[] = [
                        'row' => $index + 1,
                        'nsm' => (string)($row['nsm'] ?? $row['NSM'] ?? $row['nsm_nss'] ?? 'empty'), 
                        'error' => $e->getMessage()
                    ];
                }
            }

            return response()->json([
                'created' => $created, 
                'errors' => $errors,
                'summary' => "Berhasil: $created, Gagal: " . count($errors)
            ]);
        } catch (\Throwable $e) {
            \Log::error("Import schools crash: " . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'error' => 'Fatal error during import: ' . $e->getMessage(),
                'trace' => config('app.debug') ? $e->getTraceAsString() : null
            ], 500);
        }
    }

    /**
     * GET /api/schools/profile — Operator's own school
     */
    public function profile(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->school_id) {
            return response()->json(['error' => 'No school assigned'], 404);
        }

        $school = School::withCount(['teachers', 'students', 'skDocuments'])
            ->findOrFail($user->school_id);

        return response()->json($school);
    }
}
