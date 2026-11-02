<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\School;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SchoolController extends Controller
{
    /**
     * GET /api/schools
     * Returns paginated school list for the management page
     */
    public function index(Request $request): JsonResponse
    {
        $query = School::query();

        if ($request->filled('search')) {
            $query->where('nama', 'LIKE', "%{$request->search}%");
        }

        if ($request->filled('kecamatan')) {
            $query->where('kecamatan', $request->kecamatan);
        }

        if ($request->filled('jenjang') && $request->jenjang !== 'all') {
            $jenjang = strtoupper(trim($request->jenjang));
            $isMtsSmp = in_array($jenjang, ['MTS', 'SMP', 'MTS / SMP', 'MTS/SMP', 'MTS - SMP']);
            $isMaSmkSma = in_array($jenjang, ['MA', 'SMK', 'SMA', 'MA / SMK / SMA', 'MA/SMK/SMA', 'MA - SMK - SMA']);
            $isMiSd = in_array($jenjang, ['MI', 'SD', 'MI / SD', 'MI/SD', 'MI - SD']);
            $isRaTk = in_array($jenjang, ['RA', 'TK', 'PAUD', 'BA', 'RA / TK', 'RA/TK', 'RA - TK']);

            $query->where(function ($q) use ($jenjang, $isMtsSmp, $isMaSmkSma, $isMiSd, $isRaTk) {
                if ($isMtsSmp) {
                    $q->whereIn(DB::raw("UPPER(COALESCE(jenjang, ''))"), ['MTS', 'SMP'])
                      ->orWhereRaw('UPPER(nama) LIKE ?', ['MTS %'])
                      ->orWhereRaw('UPPER(nama) LIKE ?', ['% MTS %'])
                      ->orWhereRaw('UPPER(nama) LIKE ?', ['%TSANAWIYAH%'])
                      ->orWhereRaw('UPPER(nama) LIKE ?', ['SMP %'])
                      ->orWhereRaw('UPPER(nama) LIKE ?', ['% SMP %']);
                } elseif ($isMaSmkSma) {
                    $q->whereIn(DB::raw("UPPER(COALESCE(jenjang, ''))"), ['MA', 'SMK', 'SMA'])
                      ->orWhere(function ($sub) {
                          $sub->where(function ($s2) {
                              $s2->whereRaw('UPPER(nama) LIKE ?', ['MA %'])
                                 ->whereRaw('UPPER(nama) NOT LIKE ?', ['SMA %'])
                                 ->whereRaw('UPPER(nama) NOT LIKE ?', ['SMK %']);
                          })
                          ->orWhereRaw('UPPER(nama) LIKE ?', ['% MA %'])
                          ->orWhereRaw('UPPER(nama) LIKE ?', ['%ALIYAH%'])
                          ->orWhereRaw('UPPER(nama) LIKE ?', ['SMK %'])
                          ->orWhereRaw('UPPER(nama) LIKE ?', ['% SMK %'])
                          ->orWhereRaw('UPPER(nama) LIKE ?', ['%KEJURUAN%'])
                          ->orWhereRaw('UPPER(nama) LIKE ?', ['SMA %'])
                          ->orWhereRaw('UPPER(nama) LIKE ?', ['% SMA %']);
                      });
                } elseif ($isMiSd) {
                    $q->whereIn(DB::raw("UPPER(COALESCE(jenjang, ''))"), ['MI', 'SD'])
                      ->orWhereRaw('UPPER(nama) LIKE ?', ['MI %'])
                      ->orWhereRaw('UPPER(nama) LIKE ?', ['% MI %'])
                      ->orWhereRaw('UPPER(nama) LIKE ?', ['%IBTIDAIYAH%'])
                      ->orWhereRaw('UPPER(nama) LIKE ?', ['SD %'])
                      ->orWhereRaw('UPPER(nama) LIKE ?', ['% SD %']);
                } elseif ($isRaTk) {
                    $q->where(function ($sub) {
                        $sub->whereIn(DB::raw("UPPER(COALESCE(jenjang, ''))"), ['RA', 'TK', 'PAUD', 'BA'])
                            ->orWhereRaw('UPPER(nama) LIKE ?', ['RA %'])
                            ->orWhereRaw('UPPER(nama) LIKE ?', ['TK %'])
                            ->orWhereRaw('UPPER(nama) LIKE ?', ['PAUD %'])
                            ->orWhereRaw('UPPER(nama) LIKE ?', ['%RAUDHATUL%'])
                            ->orWhereRaw('UPPER(nama) LIKE ?', ['%BUSTANUL%']);
                    });
                } else {
                    $q->whereRaw('UPPER(COALESCE(jenjang, \'\')) = ?', [$jenjang])
                      ->orWhereRaw('UPPER(nama) LIKE ?', ["{$jenjang} %"])
                      ->orWhereRaw('UPPER(nama) LIKE ?', ["% {$jenjang} %"]);
                }
            });
        }

        $schools = $query->orderBy('nama')
            ->paginate($request->input('per_page', 15));

        return response()->json($schools);
    }

    /**
     * GET /api/schools/autocomplete
     * Returns a flat list of schools for autocomplete dropdowns
     * Respects tenant scoping for operators
     */
    public function autocomplete(Request $request): JsonResponse
    {
        $query = School::query();

        // Search filter (case-insensitive, minimum 2 characters)
        if ($request->has('search')) {
            $searchTerm = trim($request->search);
            if (strlen($searchTerm) >= 2) {
                $query->where('nama', 'LIKE', "%{$searchTerm}%");
            }
        }

        // Tenant scoping: operators see only their school, admins see all
        $user = $request->user();
        if ($user && $user->role === 'operator' && $user->school_id) {
            $query->where('id', $user->school_id);
        }

        $schools = $query->select('id', 'nama', 'kecamatan', 'jenjang')
            ->orderBy('jenjang')
            ->orderBy('nama')
            ->limit(500)
            ->get();

        return response()->json($schools);
    }

    public function show(School $school): JsonResponse
    {
        return response()->json($school->loadCount(['teachers', 'students', 'skDocuments']));
    }

    public function store(Request $request): JsonResponse
    {
        if ($request->user()->role !== 'super_admin') {
            return response()->json(['success' => false, 'message' => 'Anda tidak memiliki akses untuk menambah data sekolah.'], 403);
        }

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
            'npsm_nu' => 'nullable|string',
            'jenjang' => 'nullable|string',
        ]);

        if (isset($data['nama'])) {
            $data['nama'] = app(\App\Services\NormalizationService::class)->normalizeSchoolName($data['nama']);
        }

        $school = School::create($data);

        // Log activity
        ActivityLog::create([
            'description' => "Menambahkan sekolah: {$school->nama}",
            'event' => 'create_school',
            'log_name' => 'school',
            'subject_id' => $school->id,
            'subject_type' => get_class($school),
            'causer_id' => $request->user()->id,
            'causer_type' => get_class($request->user()),
            'school_id' => $school->id,
        ]);

        return response()->json($school, 201);
    }

    public function update(Request $request, School $school): JsonResponse
    {
        $user = $request->user();
        
        // Authorization check: admin_yayasan cannot update
        if ($user->role === 'admin_yayasan') {
            return response()->json([
                'success' => false,
                'message' => 'Admin Yayasan tidak memiliki akses untuk mengubah data sekolah'
            ], 403);
        }

        // Authorization check: operators can only update their own school
        if ($user->role === 'operator' && (int) $user->school_id !== (int) $school->id) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki akses untuk mengubah data sekolah ini'
            ], 403);
        }
        
        // Validate only the fields that are being updated
        $validated = $request->validate([
            'nsm' => 'nullable|string|unique:schools,nsm,' . $school->id,
            'npsn' => 'nullable|string|unique:schools,npsn,' . $school->id,
            'nama' => 'nullable|string|max:255',
            'alamat' => 'nullable|string',
            'provinsi' => 'nullable|string',
            'kabupaten' => 'nullable|string',
            'kecamatan' => 'nullable|string',
            'kelurahan' => 'nullable|string',
            'telepon' => 'nullable|string',
            'email' => 'nullable|email',
            'kepala_madrasah' => 'nullable|string|max:255',
            'akreditasi' => 'nullable|string',
            'status_jamiyyah' => 'nullable|string',
            'npsm_nu' => 'nullable|string|unique:schools,npsm_nu,' . $school->id,
            'kepala_nim' => 'nullable|string|max:50',
            'kepala_nuptk' => 'nullable|string|max:50',
            'kepala_whatsapp' => 'nullable|string|max:20',
            'kepala_jabatan_mulai' => 'nullable|date',
            'kepala_jabatan_selesai' => 'nullable|date|after_or_equal:kepala_jabatan_mulai',
            'jumlah_siswa_manual' => 'nullable|integer|min:0|max:100000',
            'jumlah_siswa_per_kelas' => 'nullable|array',
            'jumlah_siswa_per_kelas.*' => 'nullable|integer|min:0|max:100000',
        ]);

        // Only update fields that are actually present in the request
        // Filter out fields that weren't sent in the request at all
        $updateData = [];
        foreach ($validated as $key => $value) {
            if ($request->has($key)) {
                $updateData[$key] = $value;
            }
        }
        
        // Filter out null values - only update fields with actual data
        $updateData = array_filter($updateData, fn($value) => !is_null($value));
        
        if (isset($updateData['jumlah_siswa_per_kelas']) && is_array($updateData['jumlah_siswa_per_kelas'])) {
            $sum = 0;
            $hasVal = false;
            foreach ($updateData['jumlah_siswa_per_kelas'] as $k => $v) {
                if (str_starts_with((string) $k, 'siswa_baru_')) continue;
                if ($v !== null && $v !== '') {
                    $sum += (int) $v;
                    $hasVal = true;
                }
            }
            if ($hasVal) {
                $updateData['jumlah_siswa_manual'] = $sum;
            }
        }

        if (isset($updateData['nama'])) {
            $updateData['nama'] = app(\App\Services\NormalizationService::class)->normalizeSchoolName($updateData['nama']);
        }

        if (!empty($updateData)) {
            // Use database transaction to ensure atomicity
            \DB::transaction(function () use ($school, $updateData, $user) {
                $school->update($updateData);

                // Log activity
                ActivityLog::create([
                    'description' => "Memperbarui data sekolah: {$school->nama}",
                    'event' => 'update_school',
                    'log_name' => 'school',
                    'subject_id' => $school->id,
                    'subject_type' => get_class($school),
                    'causer_id' => $user->id,
                    'causer_type' => get_class($user),
                    'school_id' => $school->id,
                ]);

                app(\App\Services\DashboardCacheService::class)->invalidateForSchool($school->id);
            });
        }

        return response()->json([
            'success' => true,
            'message' => 'Data sekolah berhasil diperbarui',
            'data' => $school->fresh()
        ]);
    }

    public function destroy(Request $request, School $school): JsonResponse
    {
        if ($request->user()->role !== 'super_admin') {
            return response()->json(['success' => false, 'message' => 'Anda tidak memiliki akses untuk menghapus sekolah.'], 403);
        }

        $schoolName = $school->nama;
        $schoolId = $school->id;
        
        $school->delete();

        // Log activity
        ActivityLog::create([
            'description' => "Menghapus sekolah: {$schoolName}",
            'event' => 'delete_school',
            'log_name' => 'school',
            'subject_id' => $schoolId,
            'subject_type' => School::class,
            'causer_id' => $request->user()->id,
            'causer_type' => get_class($request->user()),
            'school_id' => null, // School sudah dihapus
        ]);

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
                    } else {
                        $dataToSave['nama'] = app(\App\Services\NormalizationService::class)->normalizeSchoolName($dataToSave['nama']);
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
                        $newSchool = School::create($saveData);
                        $created++;
                        
                        // Log activity for newly created school
                        try {
                            ActivityLog::create([
                                'description' => "Import sekolah: {$newSchool->nama}",
                                'event' => 'import_school',
                                'log_name' => 'school',
                                'subject_id' => $newSchool->id,
                                'subject_type' => get_class($newSchool),
                                'causer_id' => $request->user()->id,
                                'causer_type' => get_class($request->user()),
                                'school_id' => $newSchool->id,
                            ]);
                        } catch (\Exception $e) {
                            // Don't fail import if logging fails
                            Log::warning("Failed to log school import: " . $e->getMessage());
                        }
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
     * Username: {nsm}@simmaci.com, Password: nsm plain
     */
    public function generateAccounts(Request $request): JsonResponse
    {
        // If school_id provided, generate only for that school
        $schoolId = $request->input('school_id');
        $schools = $schoolId
            ? School::where('id', $schoolId)->get()
            : School::all();

        $accounts = [];
        $skipped = 0;

        foreach ($schools as $school) {
            $nsm = $school->nsm ? strtolower(trim($school->nsm)) : null;
            $email = $nsm ? "{$nsm}@simmaci.com" : ('school' . $school->id . '@simmaci.com');
            $passwordPlain = $school->nsm ?: ('school' . $school->id);

            // Cek berdasarkan school_id (bukan email) agar tidak duplikat
            // meski NSM sekolah berubah setelah akun dibuat
            $existingUser = \App\Models\User::where('school_id', $school->id)
                ->where('role', 'operator')
                ->first();

            if ($existingUser) {
                // Sinkronkan email & password jika NSM berubah
                if ($existingUser->email !== $email) {
                    $existingUser->update([
                        'name'     => $school->nama,
                        'email'    => $email,
                        'password' => $passwordPlain,
                    ]);

                    $accounts[] = [
                        'school_id'      => $school->id,
                        'nama'           => $school->nama,
                        'email'          => $email,
                        'password_plain' => $passwordPlain,
                        'updated'        => true,
                    ];
                } else {
                    $skipped++;
                }
                continue;
            }

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
            'skipped'  => $skipped,
            'message'  => 'Berhasil generate ' . count($accounts) . ' akun. ' . $skipped . ' sudah ada.',
        ]);
    }

    /**
     * PATCH /api/schools/sk-submission-reset-all
     * Reset sk_submission_unlocked ke NULL untuk semua madrasah non-RA/TK.
     * Efeknya: semua yang sudah dibuka akan kembali ke default (locked).
     */
    public function resetAllSkSubmission(Request $request): JsonResponse
    {
        $updated = School::whereNotIn('jenjang', ['RA', 'TK'])
            ->whereNotNull('sk_submission_unlocked')
            ->update(['sk_submission_unlocked' => null]);

        ActivityLog::log(
            description: "Reset semua izin SK submission ke default ({$updated} madrasah)",
            event: 'update_school',
            logName: 'school',
            subject: null,
            causer: $request->user(),
            schoolId: null,
        );

        return response()->json([
            'success' => true,
            'message' => "{$updated} madrasah berhasil direset ke status default (pengajuan ditutup).",
            'data'    => ['updated_count' => $updated],
        ]);
    }

    /**
     * PATCH /api/schools/{school}/sk-submission-unlock
     * Toggle izin pengajuan SK untuk madrasah tertentu.
     * null  = ikuti aturan global (RA/TK buka, MI ke atas tutup)
     * true  = paksa buka (sudah menghubungi pengurus)
     * false = paksa tutup
     *
     * Hanya super_admin dan admin_yayasan yang bisa mengakses.
     */
    public function toggleSkSubmission(Request $request, School $school): JsonResponse
    {
        $data = $request->validate([
            // null = reset ke default global, true = unlock, false = lock
            'sk_submission_unlocked' => 'nullable|boolean',
        ]);

        $school->update(['sk_submission_unlocked' => $data['sk_submission_unlocked']]);

        $statusLabel = match ($school->sk_submission_unlocked) {
            true  => 'dibuka (unlocked oleh admin)',
            false => 'ditutup paksa',
            null  => 'mengikuti aturan global',
        };

        ActivityLog::log(
            description: "Toggle SK submission {$school->nama}: {$statusLabel}",
            event: 'update_school',
            logName: 'school',
            subject: $school,
            causer: $request->user(),
            schoolId: $school->id,
        );

        return response()->json([
            'success' => true,
            'message' => "Status pengajuan SK {$school->nama} berhasil diubah: {$statusLabel}",
            'data'    => [
                'id'                     => $school->id,
                'nama'                   => $school->nama,
                'jenjang'                => $school->jenjang,
                'sk_submission_unlocked' => $school->sk_submission_unlocked,
            ],
        ]);
    }

    /**
     * GET /api/schools/data-readiness
     * Returns statistics & list of schools with teacher & student data completeness status.
     * Supports filtering: search, kecamatan, jenjang, status (all, incomplete, complete, teachers_only, students_only, empty).
     */
    public function dataReadiness(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'super_admin') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Fitur monitoring pendataan hanya dapat diakses oleh Super Admin.'
            ], 403);
        }

        // Base query with subquery aggregates for performance (Zero N+1)
        $query = DB::table('schools as s')
            ->leftJoin(DB::raw('(SELECT school_id, COUNT(*) as teachers_count FROM teachers WHERE deleted_at IS NULL AND is_active = true GROUP BY school_id) as t'), 't.school_id', '=', 's.id')
            ->leftJoin(DB::raw('(SELECT school_id, COUNT(*) as students_count FROM students WHERE deleted_at IS NULL GROUP BY school_id) as st'), 'st.school_id', '=', 's.id')
            ->whereNull('s.deleted_at')
            ->select([
                's.id',
                's.nama',
                's.nsm',
                's.npsn',
                's.npsm_nu',
                's.jenjang',
                's.kecamatan',
                's.alamat',
                's.telepon',
                's.email',
                's.kepala_madrasah',
                's.kepala_whatsapp',
                's.status_jamiyyah',
                's.jumlah_siswa_manual',
                's.jumlah_siswa_per_kelas',
                DB::raw('COALESCE(t.teachers_count, 0) as teachers_count'),
                DB::raw('COALESCE(st.students_count, 0) as students_detail_count'),
                DB::raw("CASE 
                    WHEN COALESCE(s.jumlah_siswa_manual, 0) > 0 THEN s.jumlah_siswa_manual
                    WHEN COALESCE(st.students_count, 0) > 0 THEN st.students_count
                    ELSE 0
                END as effective_students_count"),
                DB::raw("CASE 
                    WHEN COALESCE(s.jumlah_siswa_manual, 0) > 0 THEN 'manual'
                    WHEN COALESCE(st.students_count, 0) > 0 THEN 'detail'
                    ELSE 'empty'
                END as student_source"),
                DB::raw("CASE 
                    WHEN COALESCE(t.teachers_count, 0) > 0 AND (COALESCE(st.students_count, 0) > 0 OR COALESCE(s.jumlah_siswa_manual, 0) > 0) THEN 'complete'
                    WHEN COALESCE(t.teachers_count, 0) > 0 THEN 'teachers_only'
                    WHEN (COALESCE(st.students_count, 0) > 0 OR COALESCE(s.jumlah_siswa_manual, 0) > 0) THEN 'students_only'
                    ELSE 'empty'
                END as completeness_status")
            ]);

        // Filters: Search
        if ($request->filled('search')) {
            $search = '%' . strtoupper(trim($request->search)) . '%';
            $query->where(function ($q) use ($search) {
                $q->whereRaw('UPPER(s.nama) LIKE ?', [$search])
                  ->orWhereRaw('UPPER(COALESCE(s.nsm, \'\')) LIKE ?', [$search])
                  ->orWhereRaw('UPPER(COALESCE(s.npsn, \'\')) LIKE ?', [$search])
                  ->orWhereRaw('UPPER(COALESCE(s.kepala_madrasah, \'\')) LIKE ?', [$search]);
            });
        }

        // Filters: Kecamatan
        if ($request->filled('kecamatan') && $request->kecamatan !== 'all') {
            $query->where('s.kecamatan', $request->kecamatan);
        }

        // Filters: Jenjang
        if ($request->filled('jenjang') && $request->jenjang !== 'all') {
            $jenjang = strtoupper(trim($request->jenjang));
            $isMtsSmp = in_array($jenjang, ['MTS', 'SMP', 'MTS / SMP', 'MTS/SMP', 'MTS - SMP']);
            $isMaSmkSma = in_array($jenjang, ['MA', 'SMK', 'SMA', 'MA / SMK / SMA', 'MA/SMK/SMA', 'MA - SMK - SMA']);
            $isMiSd = in_array($jenjang, ['MI', 'SD', 'MI / SD', 'MI/SD', 'MI - SD']);
            $isRaTk = in_array($jenjang, ['RA', 'TK', 'PAUD', 'BA', 'RA / TK', 'RA/TK', 'RA - TK']);

            $query->where(function ($q) use ($jenjang, $isMtsSmp, $isMaSmkSma, $isMiSd, $isRaTk) {
                if ($isMtsSmp) {
                    $q->whereIn(DB::raw("UPPER(COALESCE(s.jenjang, ''))"), ['MTS', 'SMP'])
                      ->orWhereRaw("UPPER(s.nama) LIKE 'MTS %'")
                      ->orWhereRaw("UPPER(s.nama) LIKE '% MTS %'")
                      ->orWhereRaw("UPPER(s.nama) LIKE '%TSANAWIYAH%'")
                      ->orWhereRaw("UPPER(s.nama) LIKE 'SMP %'")
                      ->orWhereRaw("UPPER(s.nama) LIKE '% SMP %'");
                } elseif ($isMaSmkSma) {
                    $q->whereIn(DB::raw("UPPER(COALESCE(s.jenjang, ''))"), ['MA', 'SMK', 'SMA'])
                      ->orWhere(function ($sub) {
                          $sub->where(function ($s2) {
                              $s2->whereRaw("UPPER(s.nama) LIKE 'MA %'")
                                 ->whereRaw("UPPER(s.nama) NOT LIKE 'SMA %'")
                                 ->whereRaw("UPPER(s.nama) NOT LIKE 'SMK %'");
                          })
                          ->orWhereRaw("UPPER(s.nama) LIKE '% MA %'")
                          ->orWhereRaw("UPPER(s.nama) LIKE '%ALIYAH%'")
                          ->orWhereRaw("UPPER(s.nama) LIKE 'SMK %'")
                          ->orWhereRaw("UPPER(s.nama) LIKE '% SMK %'")
                          ->orWhereRaw("UPPER(s.nama) LIKE '%KEJURUAN%'")
                          ->orWhereRaw("UPPER(s.nama) LIKE 'SMA %'")
                          ->orWhereRaw("UPPER(s.nama) LIKE '% SMA %'");
                      });
                } elseif ($isMiSd) {
                    $q->whereIn(DB::raw("UPPER(COALESCE(s.jenjang, ''))"), ['MI', 'SD'])
                      ->orWhereRaw("UPPER(s.nama) LIKE 'MI %'")
                      ->orWhereRaw("UPPER(s.nama) LIKE '% MI %'")
                      ->orWhereRaw("UPPER(s.nama) LIKE '%IBTIDAIYAH%'")
                      ->orWhereRaw("UPPER(s.nama) LIKE 'SD %'")
                      ->orWhereRaw("UPPER(s.nama) LIKE '% SD %'");
                } elseif ($isRaTk) {
                    $q->whereIn(DB::raw("UPPER(COALESCE(s.jenjang, ''))"), ['RA', 'TK', 'PAUD', 'BA'])
                      ->orWhereRaw("UPPER(s.nama) LIKE 'RA %'")
                      ->orWhereRaw("UPPER(s.nama) LIKE '% RA %'")
                      ->orWhereRaw("UPPER(s.nama) LIKE '%RAUDHATUL%'")
                      ->orWhereRaw("UPPER(s.nama) LIKE 'TK %'")
                      ->orWhereRaw("UPPER(s.nama) LIKE '% TK %'")
                      ->orWhereRaw("UPPER(s.nama) LIKE 'PAUD %'")
                      ->orWhereRaw("UPPER(s.nama) LIKE '%BUSTANUL%'");
                } else {
                    $q->whereRaw("UPPER(COALESCE(s.jenjang, '')) = ?", [$jenjang]);
                }
            });
        }

        // Calculate summary from the full set (matching search, kecamatan, jenjang) BEFORE status filter
        $summarySubquery = clone $query;
        $summaryStats = DB::query()->fromSub($summarySubquery, 'stats')
            ->selectRaw("
                COUNT(*) as total_schools,
                SUM(CASE WHEN completeness_status = 'complete' THEN 1 ELSE 0 END) as complete_count,
                SUM(CASE WHEN completeness_status != 'complete' THEN 1 ELSE 0 END) as incomplete_count,
                SUM(CASE WHEN completeness_status = 'teachers_only' THEN 1 ELSE 0 END) as teachers_only_count,
                SUM(CASE WHEN completeness_status = 'students_only' THEN 1 ELSE 0 END) as students_only_count,
                SUM(CASE WHEN completeness_status = 'empty' THEN 1 ELSE 0 END) as empty_count,
                SUM(CASE WHEN student_source = 'manual' THEN 1 ELSE 0 END) as using_manual_count
            ")
            ->first();

        // Apply status filter on the paginated query
        $status = $request->input('status', 'all');
        if ($status === 'incomplete') {
            $query->where(function ($q) {
                $q->whereNull('t.teachers_count')
                  ->orWhere('t.teachers_count', '<=', 0)
                  ->orWhere(function ($sub) {
                      $sub->where(function ($stSub) {
                          $stSub->whereNull('st.students_count')->orWhere('st.students_count', '<=', 0);
                      })->where(function ($mSub) {
                          $mSub->whereNull('s.jumlah_siswa_manual')->orWhere('s.jumlah_siswa_manual', '<=', 0);
                      });
                  });
            });
        } elseif ($status === 'complete') {
            $query->where('t.teachers_count', '>', 0)
                  ->where(function ($q) {
                      $q->where('st.students_count', '>', 0)
                        ->orWhere('s.jumlah_siswa_manual', '>', 0);
                  });
        } elseif ($status === 'teachers_only') {
            $query->where('t.teachers_count', '>', 0)
                  ->where(function ($q) {
                      $q->whereNull('st.students_count')->orWhere('st.students_count', '<=', 0);
                  })
                  ->where(function ($q) {
                      $q->whereNull('s.jumlah_siswa_manual')->orWhere('s.jumlah_siswa_manual', '<=', 0);
                  });
        } elseif ($status === 'students_only') {
            $query->where(function ($q) {
                $q->whereNull('t.teachers_count')->orWhere('t.teachers_count', '<=', 0);
            })->where(function ($q) {
                $q->where('st.students_count', '>', 0)
                  ->orWhere('s.jumlah_siswa_manual', '>', 0);
            });
        } elseif ($status === 'empty') {
            $query->where(function ($q) {
                $q->whereNull('t.teachers_count')->orWhere('t.teachers_count', '<=', 0);
            })->where(function ($q) {
                $q->whereNull('st.students_count')->orWhere('st.students_count', '<=', 0);
            })->where(function ($q) {
                $q->whereNull('s.jumlah_siswa_manual')->orWhere('s.jumlah_siswa_manual', '<=', 0);
            });
        }

        $perPage = min(max(1, $request->integer('per_page', 20)), 2000);
        $paginated = $query->orderBy('s.nama')->paginate($perPage);

        // Extract school IDs to fetch detail student class distribution
        $schoolIds = collect($paginated->items())->pluck('id')->filter()->all();
        $detailClassCounts = [];
        if (!empty($schoolIds)) {
            $studentRows = DB::table('students')
                ->whereIn('school_id', $schoolIds)
                ->whereNull('deleted_at')
                ->where(function ($q) {
                    $q->whereNull('status')->orWhere('status', 'Aktif');
                })
                ->whereNotNull('kelas')
                ->whereRaw("TRIM(kelas) != ''")
                ->select('school_id', 'kelas', DB::raw('COUNT(*) as total'))
                ->groupBy('school_id', 'kelas')
                ->get();

            foreach ($studentRows as $sr) {
                $detailClassCounts[$sr->school_id][$sr->kelas] = (int) $sr->total;
            }
        }

        $paginated->getCollection()->transform(function ($item) use ($detailClassCounts) {
            if (isset($item->jumlah_siswa_per_kelas) && is_string($item->jumlah_siswa_per_kelas)) {
                $decoded = json_decode($item->jumlah_siswa_per_kelas, true);
                $item->jumlah_siswa_per_kelas = is_array($decoded) ? $decoded : null;
            }

            $item->detail_students_per_kelas = $detailClassCounts[$item->id] ?? null;

            return $item;
        });

        $totalSchools = (int) ($summaryStats->total_schools ?? 0);
        $completeCount = (int) ($summaryStats->complete_count ?? 0);
        $completionPercentage = $totalSchools > 0 ? round(($completeCount / $totalSchools) * 100, 1) : 0;

        return response()->json([
            'summary' => [
                'total_schools' => $totalSchools,
                'complete_count' => $completeCount,
                'incomplete_count' => (int) ($summaryStats->incomplete_count ?? 0),
                'teachers_only_count' => (int) ($summaryStats->teachers_only_count ?? 0),
                'students_only_count' => (int) ($summaryStats->students_only_count ?? 0),
                'empty_count' => (int) ($summaryStats->empty_count ?? 0),
                'using_manual_count' => (int) ($summaryStats->using_manual_count ?? 0),
                'completion_percentage' => $completionPercentage,
            ],
            'data' => $paginated->items(),
            'current_page' => $paginated->currentPage(),
            'last_page' => $paginated->lastPage(),
            'per_page' => $paginated->perPage(),
            'total' => $paginated->total(),
        ]);
    }

    /**
     * PATCH /api/schools/{id}/manual-students
     * Quick update of manual student count by admin_yayasan, super_admin, or the school's operator.
     */
    public function quickUpdateManualStudents(Request $request, School $school): JsonResponse
    {
        $user = $request->user();

        // Operator can only update their own school
        if ($user->role === 'operator' && (int) $user->school_id !== (int) $school->id) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki hak akses untuk mengubah madrasah ini'
            ], 403);
        }

        // Disallow other unprivileged roles
        if (!in_array($user->role, ['super_admin', 'admin_yayasan', 'admin', 'operator'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak'
            ], 403);
        }

        $validated = $request->validate([
            'jumlah_siswa_manual' => 'nullable|integer|min:0|max:100000',
            'jumlah_siswa_per_kelas' => 'nullable|array',
            'jumlah_siswa_per_kelas.*' => 'nullable|integer|min:0|max:100000',
        ]);

        $oldCount = $school->jumlah_siswa_manual;

        $perClassData = null;
        if (array_key_exists('jumlah_siswa_per_kelas', $validated) && is_array($validated['jumlah_siswa_per_kelas'])) {
            $perClassData = $validated['jumlah_siswa_per_kelas'];
            $sum = 0;
            $hasAnyValue = false;
            foreach ($perClassData as $k => $v) {
                if (str_starts_with((string) $k, 'siswa_baru_')) continue;
                if ($v !== null && $v !== '') {
                    $val = (int) $v;
                    $sum += $val;
                    $hasAnyValue = true;
                }
            }
            $newCount = $hasAnyValue ? $sum : null;
        } else {
            $newCount = array_key_exists('jumlah_siswa_manual', $validated) ? $validated['jumlah_siswa_manual'] : null;
        }

        DB::transaction(function () use ($school, $newCount, $perClassData, $oldCount, $user, $validated) {
            $payload = ['jumlah_siswa_manual' => $newCount];
            if (array_key_exists('jumlah_siswa_per_kelas', $validated)) {
                $payload['jumlah_siswa_per_kelas'] = $perClassData;
            }
            $school->update($payload);

            ActivityLog::log(
                description: "Memperbarui estimasi jumlah siswa {$school->nama}: " . ($newCount !== null ? "{$newCount} siswa" : 'dikosongkan') . " (sebelumnya: " . ($oldCount !== null ? "{$oldCount} siswa" : '-') . ")",
                event: 'update_school',
                logName: 'school',
                subject: $school,
                causer: $user,
                schoolId: $school->id,
            );

            app(\App\Services\DashboardCacheService::class)->invalidateForSchool($school->id);
        });

        return response()->json([
            'success' => true,
            'message' => "Jumlah siswa estimasi {$school->nama} berhasil diperbarui",
            'data' => [
                'id' => $school->id,
                'nama' => $school->nama,
                'jumlah_siswa_manual' => $newCount,
                'jumlah_siswa_per_kelas' => $perClassData ?? $school->fresh()->jumlah_siswa_per_kelas,
            ]
        ]);
    }
}

