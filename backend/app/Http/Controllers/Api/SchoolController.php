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
            'kepala_nim', 'kepala_nuptk', 'kepala_whatsapp',
            'kepala_jabatan_mulai', 'kepala_jabatan_selesai'
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
            $updated = 0;
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
                        
                        // Sanitize value for UTF-8 and basic TRIM
                        if (is_string($value)) {
                            $value = trim(htmlspecialchars_decode(htmlspecialchars($value, ENT_SUBSTITUTE, 'UTF-8')));
                        }
                        $normalizedRow[$cleanKey] = $value;
                    }

                    // Identifier Selection with Aliases
                    $nsm = $normalizedRow['nsm'] 
                        ?? $normalizedRow['nsm_nss']
                        ?? $normalizedRow['nomor_statistik'] 
                        ?? $normalizedRow['no_statistik'] 
                        ?? $normalizedRow['n_s_m']
                        ?? null;
                    
                    $npsn = $normalizedRow['npsn'] ?? null;
                    $npsmNu = $normalizedRow['npsm_nu'] ?? $normalizedRow['no_maarif'] ?? null;

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
                        if (empty(array_filter($normalizedRow))) continue; 
                        $dataToSave['nama'] = "Sekolah Baru (Harap lengkapi)";
                    }

                    if (empty($dataToSave['kepala_madrasah'])) {
                        $dataToSave['kepala_madrasah'] = $normalizedRow['nama_kepala_madrasah'] ?? null;
                    }

                    if (empty($dataToSave['telepon'])) {
                        $dataToSave['telepon'] = $normalizedRow['no_telepon'] ?? $normalizedRow['nomor_hp'] ?? $normalizedRow['no_hp'] ?? null;
                    }

                    if (empty($dataToSave['status_jamiyyah'])) {
                        $dataToSave['status_jamiyyah'] = $normalizedRow['status_jam_iyyah_jama_ah'] 
                            ?? $normalizedRow['status_afiliasi']
                            ?? $normalizedRow['afiliasi']
                            ?? $normalizedRow['kategori']
                            ?? null;
                    }

                    // Content-based detection for "Jam'iyyah" / "Jama'ah"
                    $statusVal = $dataToSave['status'] ?? $normalizedRow['status'] ?? '';
                    if (is_string($statusVal) && (str_contains(strtolower($statusVal), 'jam') || str_contains(strtolower($statusVal), 'afiliasi'))) {
                        $dataToSave['status_jamiyyah'] = $statusVal;
                        // If it was in the generic 'status', we might want to clear it if it's not a real status
                        if (isset($dataToSave['status']) && $dataToSave['status'] === $statusVal) {
                            // Only clear if it looks like it belongs ONLY to jamiyyah
                            if (!in_array(strtolower($statusVal), ['aktif', 'pasif', 'tutup'])) {
                                unset($dataToSave['status']);
                            }
                        }
                    }

                    if (empty($dataToSave['npsm_nu'])) {
                        $dataToSave['npsm_nu'] = $npsmNu;
                    }

                    // Check for existing school to prevent unique constraints
                    $school = null;
                    if ($nsm) {
                        $school = School::where('nsm', $nsm)->first();
                    }
                    if (!$school && $npsn) {
                        $school = School::where('npsn', $npsn)->first();
                    }
                    if (!$school && $npsmNu) {
                        $school = School::where('npsm_nu', $npsmNu)->first();
                    }

                    $saveData = array_filter($dataToSave, fn($v) => !is_null($v));

                    if ($school) {
                        $school->update($saveData);
                        $updated++;
                    } else {
                        School::create($saveData);
                        $created++;
                    }

                } catch (\Throwable $e) {
                    $errors[] = [
                        'row' => $index + 1,
                        'name' => (string)($row['nama_sekolah'] ?? $row['nama'] ?? 'Unknown'), 
                        'identifier' => "NSM: ".($nsm ?? '-').", NPSN: ".($npsn ?? '-'),
                        'error' => $e->getMessage()
                    ];
                }
            }

            return response()->json([
                'created' => $created, 
                'updated' => $updated,
                'errors' => $errors,
                'summary' => "Selesai: Simpan Baru $created, Update $updated, Gagal " . count($errors)
            ]);
        } catch (\Throwable $e) {
            \Log::error("Import schools crash: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'error' => 'Fatal error: ' . $e->getMessage(),
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
            // Auto-heal orphaned operator accounts by matching name
            // Uses trimmed case-insensitive match
            $targetName = trim($user->name);
            $school = School::where('nama', 'ilike', $targetName)->first();
            
            if ($school) {
                $user->update(['school_id' => $school->id]);
                Log::info("Auto-heal: Linked User ID {$user->id} to School ID {$school->id} via name match.");
            } else {
                Log::error("Auto-heal failed: No school found matching user name '{$targetName}' for User ID {$user->id}.");
                return response()->json([
                    'error' => 'Profil Madrasah belum dihubungkan dengan akun Anda.',
                    'details' => 'Nama akun ' . $targetName . ' tidak ditemukan di daftar madrasah.',
                    'contact' => 'Silakan hubungi Admin Kabupaten.'
                ], 404);
            }
        }

        $school = School::withCount(['teachers', 'students', 'skDocuments'])
            ->findOrFail($user->school_id);

        return response()->json($school);
    }

    /**
     * DELETE /api/schools/delete-all
     */
    public function deleteAll(): JsonResponse
    {
        $count = School::count();
        School::query()->delete();

        return response()->json([
            'success' => true,
            'message' => "Berhasil menghapus $count data lembaga.",
            'deleted' => $count,
        ]);
    }

    /**
     * POST /api/schools/generate-accounts
     * Username: {nsm}@maarif.nu, Password: nsm plain
     */
    public function generateAccounts(): JsonResponse
    {
        $schools = School::all();
        $accounts = [];

        foreach ($schools as $school) {
            $email = $school->email ?: (($school->nsm ? strtolower($school->nsm) : 'school' . $school->id) . '@maarif.nu');

            if (\App\Models\User::where('email', $email)->exists()) {
                continue;
            }

            $passwordPlain = $school->nsm ?: ('school' . $school->id);

            \App\Models\User::create([
                'name'      => $school->nama,
                'email'     => $email,
                'password'  => $passwordPlain,
                'role'      => 'operator',
                'is_active' => true,
                'school_id' => $school->id,
            ]);

            $accounts[] = [
                'school_id'      => $school->id,
                'nama'           => $school->nama,
                'email'          => $email,
                'password_plain' => $passwordPlain,
            ];
        }

        return response()->json([
            'success'  => true,
            'accounts' => $accounts,
            'message'  => 'Berhasil generate ' . count($accounts) . ' akun.',
        ]);
    }
}
