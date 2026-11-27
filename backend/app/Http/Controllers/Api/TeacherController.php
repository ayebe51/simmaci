<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Teacher\StoreTeacherRequest;
use App\Http\Requests\Teacher\UpdateNimRequest;
use App\Http\Requests\Teacher\UpdateTeacherRequest;
use App\Models\ActivityLog;
use App\Models\School;
use App\Models\Teacher;
use App\Services\MatchingService;
use App\Services\NormalizationService;
use App\Services\StrictDateValidationService;
use App\Services\TeacherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeacherController extends Controller
{
    private StrictDateValidationService $strictDateValidationService;

    public function __construct(
        private TeacherService $teacherService,
        private NormalizationService $normalizationService,
        private MatchingService $matchingService,
        ?StrictDateValidationService $strictDateValidationService = null
    ) {
        $this->strictDateValidationService = $strictDateValidationService ?? app(StrictDateValidationService::class);
    }

    public function index(Request $request): JsonResponse
    {
        $query = Teacher::with('school');

        if ($request->search) {
            $query->whereRaw('LOWER(nama) LIKE LOWER(?)', ["%{$request->search}%"]);
        }
        if ($request->kecamatan) {
            $query->where('kecamatan', $request->kecamatan);
        }
        if ($request->status) {
            $query->where('status', $request->status);
        }
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }
        if ($request->has('is_verified')) {
            $query->where('is_verified', $request->boolean('is_verified'));
        }

        // --- Tenant Isolation ---
        // TenantScope global scope already handles this automatically via HasTenantScope trait.
        // The manual check below is a defense-in-depth layer only for super_admin cross-school queries.
        // Operators CANNOT override their school_id via request parameter.
        $user = $request->user();
        if (! in_array($user->role, ['super_admin', 'admin_yayasan'], true)) {
            // Operator: enforce their school_id, ignore any school_id in request
            if ($user->school_id) {
                $query->where('school_id', $user->school_id);
            }
        } elseif ($request->school_id) {
            // Super admin / admin yayasan: allow filtering by school_id
            $query->where('school_id', $request->school_id);
        }

        // Unpaginated mode for exports or full dataset selection
        if ($request->boolean('all') || $request->boolean('export')) {
            $teachers = $query->orderByDesc('updated_at')->get();

            // Sanitize output to prevent UTF-8 errors
            $teachers->transform(function ($teacher) {
                foreach ($teacher->getAttributes() as $key => $value) {
                    if (is_string($value)) {
                        $teacher->$key = htmlspecialchars_decode(htmlspecialchars($value, ENT_SUBSTITUTE, 'UTF-8'));
                    }
                }
                return $teacher;
            });

            return response()->json([
                'data'  => $teachers,
                'total' => $teachers->count(),
            ]);
        }

        $perPage = min(max(1, $request->integer('per_page', 25)), 100);
        $teachers = $query->orderByDesc('updated_at')
            ->paginate($perPage);

        // Sanitize output to prevent UTF-8 errors
        $teachers->getCollection()->transform(function ($teacher) {
            foreach ($teacher->getAttributes() as $key => $value) {
                if (is_string($value)) {
                    $teacher->$key = htmlspecialchars_decode(htmlspecialchars($value, ENT_SUBSTITUTE, 'UTF-8'));
                }
            }
            return $teacher;
        });

        return response()->json($teachers);
    }

    public function show(Teacher $teacher): JsonResponse
    {
        $this->authorize('view', $teacher);
        return $this->successResponse($teacher->load('school', 'skDocuments'));
    }

    public function store(StoreTeacherRequest $request): JsonResponse
    {
        $data = $request->validated();

        // Normalize teacher name
        $originalNama = $data['nama'];
        $data['nama'] = $this->normalizationService->normalizeTeacherName($data['nama']);

        // Normalize NIM — strip dots, dashes, spaces (e.g. "113.403.283" → "113403283")
        if (isset($data['nomor_induk_maarif'])) {
            $data['nomor_induk_maarif'] = $this->normalizationService->normalizeNim($data['nomor_induk_maarif']);
        }

        // Normalize unit_kerja if present
        $originalUnitKerja = $data['unit_kerja'] ?? null;
        if (isset($data['unit_kerja'])) {
            $data['unit_kerja'] = $this->normalizationService->normalizeSchoolName($data['unit_kerja']);
        }

        // Normalize tempat_lahir if present
        $originalTempatLahir = $data['tempat_lahir'] ?? null;
        if (isset($data['tempat_lahir'])) {
            $data['tempat_lahir'] = $this->normalizationService->normalizePlaceOfBirth($data['tempat_lahir']);
        }

        // Track normalization changes for activity logging
        $normalizationChanges = [];
        if ($originalNama !== $data['nama']) {
            $normalizationChanges['nama'] = [
                'original' => $originalNama,
                'normalized' => $data['nama']
            ];
        }
        if ($originalUnitKerja && isset($data['unit_kerja']) && $originalUnitKerja !== $data['unit_kerja']) {
            $normalizationChanges['unit_kerja'] = [
                'original' => $originalUnitKerja,
                'normalized' => $data['unit_kerja']
            ];
        }
        if ($originalTempatLahir && isset($data['tempat_lahir']) && $originalTempatLahir !== $data['tempat_lahir']) {
            $normalizationChanges['tempat_lahir'] = [
                'original' => $originalTempatLahir,
                'normalized' => $data['tempat_lahir']
            ];
        }

        // Auto-resolve school_id
        if ($request->user()->role === 'operator') {
            $data['school_id'] = $request->user()->school_id;
        } elseif (! isset($data['school_id']) && isset($data['unit_kerja'])) {
            // Case-insensitive school lookup (database-agnostic)
            $school = School::whereRaw('LOWER(nama) = LOWER(?)', [$data['unit_kerja']])->first();
            $data['school_id'] = $school?->id;
        }

        $teacher = $this->teacherService->createTeacher($data);

        $logProperties = [];
        if (!empty($normalizationChanges)) {
            $logProperties['normalization'] = $normalizationChanges;
        }

        ActivityLog::create([
            'description' => "Menambahkan guru: {$teacher->nama}",
            'event' => 'create_teacher',
            'log_name' => 'master',
            'subject_id' => $teacher->id,
            'subject_type' => get_class($teacher),
            'causer_id' => $request->user()->id,
            'causer_type' => get_class($request->user()),
            'school_id' => $teacher->school_id,
            'properties' => $logProperties,
        ]);

        return $this->successResponse($teacher, 'Guru berhasil ditambahkan.', 201);
    }

    public function update(UpdateTeacherRequest $request, Teacher $teacher): JsonResponse
    {
        $this->authorize('update', $teacher);
        $data = $request->validated();

        // Track normalization changes for activity logging
        $normalizationChanges = [];
        
        // Normalize teacher name if present
        if (isset($data['nama'])) {
            $originalNama = $data['nama'];
            $data['nama'] = $this->normalizationService->normalizeTeacherName($data['nama']);
            
            if ($originalNama !== $data['nama']) {
                $normalizationChanges['nama'] = [
                    'original' => $originalNama,
                    'normalized' => $data['nama']
                ];
            }
        }

        // Normalize NIM — strip dots, dashes, spaces (e.g. "113.403.283" → "113403283")
        if (isset($data['nomor_induk_maarif'])) {
            $originalNim = $data['nomor_induk_maarif'];
            $data['nomor_induk_maarif'] = $this->normalizationService->normalizeNim($data['nomor_induk_maarif']);
            if ($originalNim !== $data['nomor_induk_maarif']) {
                $normalizationChanges['nomor_induk_maarif'] = [
                    'original'   => $originalNim,
                    'normalized' => $data['nomor_induk_maarif'],
                ];
            }
        }

        // Normalize unit_kerja if present
        if (isset($data['unit_kerja'])) {
            $originalUnitKerja = $data['unit_kerja'];
            $data['unit_kerja'] = $this->normalizationService->normalizeSchoolName($data['unit_kerja']);
            
            if ($originalUnitKerja !== $data['unit_kerja']) {
                $normalizationChanges['unit_kerja'] = [
                    'original' => $originalUnitKerja,
                    'normalized' => $data['unit_kerja']
                ];
            }
        }

        // Normalize tempat_lahir if present
        if (isset($data['tempat_lahir'])) {
            $originalTempatLahir = $data['tempat_lahir'];
            $data['tempat_lahir'] = $this->normalizationService->normalizePlaceOfBirth($data['tempat_lahir']);

            if ($originalTempatLahir !== $data['tempat_lahir']) {
                $normalizationChanges['tempat_lahir'] = [
                    'original' => $originalTempatLahir,
                    'normalized' => $data['tempat_lahir']
                ];
            }
        }

        $this->teacherService->updateTeacher($teacher, $data);
        
        // Log activity for teacher update
        ActivityLog::create([
            'description' => "Memperbarui data guru: {$teacher->nama}",
            'event' => 'update_teacher',
            'log_name' => 'teacher',
            'subject_id' => $teacher->id,
            'subject_type' => get_class($teacher),
            'causer_id' => $request->user()->id,
            'causer_type' => get_class($request->user()),
            'school_id' => $teacher->school_id,
        ]);
        
        // Log normalization changes if any occurred
        if (!empty($normalizationChanges)) {
            ActivityLog::create([
                'description' => "Normalisasi data guru: {$teacher->nama}",
                'event' => 'normalize_teacher',
                'log_name' => 'master',
                'subject_id' => $teacher->id,
                'subject_type' => get_class($teacher),
                'causer_id' => $request->user()->id,
                'causer_type' => get_class($request->user()),
                'school_id' => $teacher->school_id,
                'properties' => ['normalization' => $normalizationChanges],
            ]);
        }

        return $this->successResponse($teacher->fresh(), 'Guru berhasil diperbarui.');
    }

    public function destroy(Request $request, Teacher $teacher): JsonResponse
    {
        $this->authorize('delete', $teacher);
        
        $teacherName = $teacher->nama;
        $teacherId = $teacher->id;
        $schoolId = $teacher->school_id;
        
        $teacher->delete();

        // Log activity
        ActivityLog::create([
            'description' => "Menghapus guru: {$teacherName}",
            'event' => 'delete_teacher',
            'log_name' => 'teacher',
            'subject_id' => $teacherId,
            'subject_type' => Teacher::class,
            'causer_id' => $request->user()->id,
            'causer_type' => get_class($request->user()),
            'school_id' => $schoolId,
        ]);

        return $this->successResponse(null, 'Guru berhasil dihapus.');
    }

    /**
     * POST /api/teachers/deduplicate
     * Gabungkan data guru lama (NIM nyasar di kolom NIP) dengan data baru (Dari Excel)
     */
    public function deduplicate(Request $request): JsonResponse
    {
        $isDryRun = $request->boolean('dry_run', false);
        $user = $request->user();
        $manualSelections = $request->input('manual_selections', []);

        // Cek role: hanya super_admin dan admin_yayasan yang dapat menjalankan deduplikasi
        if (!in_array($user->role, ['super_admin', 'admin_yayasan'], true)) {
            return $this->errorResponse('Akses ditolak: Hanya Super Admin / Admin Yayasan yang dapat melakukan deduplikasi.', 403);
        }

        // Helper untuk membatasi query berdasarkan role
        $applyRoleFilter = function ($query) use ($user) {
            if (!in_array($user->role, ['super_admin', 'admin_yayasan'], true)) {
                $query->where('school_id', $user->school_id);
            }
            return $query;
        };

        // 1. Deduplicate based on NIM mistakenly placed in NIP
        $oldTeachers = $applyRoleFilter(Teacher::withoutTenantScope())
            ->where('nip', 'like', '1134%')
            ->whereRaw("LENGTH(nip) = 9")
            ->where(function($q) {
                $q->whereNull('nomor_induk_maarif')->orWhere('nomor_induk_maarif', '')->orWhere('nomor_induk_maarif', '-');
            })
            ->get();

        $mergedCount = 0;
        $dryRunSamples = [];

        if ($oldTeachers->isNotEmpty()) {
            $nips = $oldTeachers->pluck('nip')->filter()->unique()->toArray();
            $oldTeacherIds = $oldTeachers->pluck('id')->toArray();
            
            // Fetch all matching new teachers at once (Avoid N+1 timeout)
            $newTeachersByNim = $applyRoleFilter(Teacher::withoutTenantScope())
                ->whereIn('nomor_induk_maarif', $nips)
                ->whereNotIn('id', $oldTeacherIds)
                ->get()
                ->keyBy('nomor_induk_maarif');

            foreach ($oldTeachers as $oldTeacher) {
                if (!$oldTeacher->nip) continue;
                
                $newTeacher = $newTeachersByNim->get($oldTeacher->nip);

                if ($newTeacher) {
                    if ($isDryRun) {
                        $dryRunSamples[] = [
                            'type' => 'nim_nyasar',
                            'old_name' => $oldTeacher->nama,
                            'new_name' => $newTeacher->nama,
                            'nim' => $newTeacher->nomor_induk_maarif
                        ];
                        $mergedCount++;
                        continue;
                    }

                    $oldTeacherName = $oldTeacher->nama;
                    $newTeacherName = $newTeacher->nama;
                    
                    $oldTeacher->nama = $newTeacher->nama;
                    $oldTeacher->nomor_induk_maarif = $newTeacher->nomor_induk_maarif;
                    
                    $fieldsToCopy = ['tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'mapel', 'status', 'tmt', 'is_certified', 'pdpkpnu', 'pendidikan_terakhir', 'phone_number'];
                    foreach ($fieldsToCopy as $field) {
                        if (!empty($newTeacher->$field)) {
                            $oldTeacher->$field = $newTeacher->$field;
                        }
                    }
                    
                    $oldTeacher->nip = null;
                    $oldTeacher->save();

                    $newTeacher->delete();

                    ActivityLog::create([
                        'description' => "Merge otomatis duplikat data (NIM nyasar): NUPTK {$oldTeacher->nuptk}. Nama lama: {$oldTeacherName} diganti menjadi {$newTeacherName}.",
                        'event' => 'deduplicate_teacher',
                        'log_name' => 'master',
                        'subject_id' => $oldTeacher->id,
                        'subject_type' => get_class($oldTeacher),
                        'causer_id' => $request->user()->id,
                        'causer_type' => get_class($request->user()),
                        'school_id' => $oldTeacher->school_id,
                    ]);

                    $mergedCount++;
                }
            }
        }

        // Function to process a group of teachers and find duplicates
        $processDuplicateGroup = function($teachers) use (&$processedIds, &$mergedCount, &$dryRunSamples, $isDryRun, $manualSelections, $request) {
            foreach ($teachers as $t1) {
                if (in_array($t1->id, $processedIds)) continue;

                $name1 = explode(',', $t1->nama)[0];
                $clean1 = preg_replace('/[^A-Z]/', '', strtoupper($name1));
                if (strlen($clean1) < 3) continue;

                foreach ($teachers as $t2) {
                    if ($t1->id === $t2->id || in_array($t2->id, $processedIds)) continue;

                    $name2 = explode(',', $t2->nama)[0];
                    $clean2 = preg_replace('/[^A-Z]/', '', strtoupper($name2));

                    $isNameMatch = ($clean1 === $clean2);
                    $isNuptkMatch = (!empty($t1->nuptk) && $t1->nuptk === $t2->nuptk);
                    $isNipMatch = (!empty($t1->nip) && $t1->nip === $t2->nip);

                    if ($isNameMatch || $isNuptkMatch || $isNipMatch) {
                        $t1HasDegrees = str_contains($t1->nama, ',');
                        $t2HasDegrees = str_contains($t2->nama, ',');

                        $manual = collect($manualSelections)->first(function ($sel) use ($t1, $t2) {
                            return ($sel['keep_id'] == $t1->id && $sel['drop_id'] == $t2->id) ||
                                   ($sel['keep_id'] == $t2->id && $sel['drop_id'] == $t1->id);
                        });

                        if ($manual) {
                            $keep = $t1->id == $manual['keep_id'] ? $t1 : $t2;
                            $drop = $t1->id == $manual['drop_id'] ? $t1 : $t2;
                        } else {
                            $score1 = (!empty($t1->nomor_induk_maarif) ? 10 : 0) + ($t1HasDegrees ? 5 : 0) + (!empty($t1->nuptk) ? 2 : 0);
                            $score2 = (!empty($t2->nomor_induk_maarif) ? 10 : 0) + ($t2HasDegrees ? 5 : 0) + (!empty($t2->nuptk) ? 2 : 0);
                            $keep = $score1 >= $score2 ? $t1 : $t2;
                            $drop = $score1 >= $score2 ? $t2 : $t1;
                        }

                        if ($isDryRun) {
                            $dryRunSamples[] = [
                                'type' => 'name_match',
                                'keep_id' => $keep->id,
                                'drop_id' => $drop->id,
                                'keep_name' => $keep->nama,
                                'drop_name' => $drop->nama,
                                'keep_nim' => $keep->nomor_induk_maarif,
                                'drop_nim' => $drop->nomor_induk_maarif
                            ];
                            $mergedCount++;
                            $processedIds[] = $drop->id;
                            continue;
                        }

                        $fields = ['school_id', 'nomor_induk_maarif', 'nuptk', 'nip', 'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'mapel', 'status', 'tmt', 'is_certified', 'pdpkpnu', 'pendidikan_terakhir', 'phone_number'];
                        foreach ($fields as $field) {
                            if (empty($keep->$field) && !empty($drop->$field)) {
                                $keep->$field = $drop->$field;
                            }
                        }
                        
                        $keep->save();
                        $dropName = $drop->nama;
                        $drop->delete();

                        ActivityLog::create([
                            'description' => "Merge otomatis duplikat nama: {$dropName} digabungkan ke {$keep->nama}.",
                            'event' => 'deduplicate_teacher',
                            'log_name' => 'master',
                            'subject_id' => $keep->id,
                            'subject_type' => get_class($keep),
                            'causer_id' => $request->user()->id,
                            'causer_type' => get_class($request->user()),
                            'school_id' => $keep->school_id,
                        ]);

                        $mergedCount++;
                        $processedIds[] = $drop->id;
                    }
                }
            }
        };

        $processedIds = [];

        // 2a. Deduplicate based on similar names within the SAME school_id
        $schools = $applyRoleFilter(Teacher::withoutTenantScope())
            ->select('school_id')
            ->distinct()
            ->whereNotNull('school_id')
            ->pluck('school_id');

        foreach ($schools as $schoolId) {
            $schoolTeachers = Teacher::withoutTenantScope()
                ->where('school_id', $schoolId)
                ->orderBy('created_at', 'asc')
                ->get();
            $processDuplicateGroup($schoolTeachers);
        }

        // 2b. Deduplicate based on similar names within the SAME unit_kerja (this covers missing school_id)
        $units = $applyRoleFilter(Teacher::withoutTenantScope())
            ->select('unit_kerja')
            ->distinct()
            ->whereNotNull('unit_kerja')
            ->where('unit_kerja', '!=', '')
            ->pluck('unit_kerja');

        foreach ($units as $unitKerja) {
            $unitTeachers = Teacher::withoutTenantScope()
                ->where('unit_kerja', $unitKerja)
                ->orderBy('created_at', 'asc')
                ->get();
            $processDuplicateGroup($unitTeachers);
        }

        // 2c. Deduplicate based on exact NUPTK match
        $nuptks = $applyRoleFilter(Teacher::withoutTenantScope())
            ->select('nuptk')
            ->distinct()
            ->whereNotNull('nuptk')
            ->where('nuptk', '!=', '')
            ->pluck('nuptk');

        foreach ($nuptks as $nuptk) {
            $nuptkTeachers = Teacher::withoutTenantScope()
                ->where('nuptk', $nuptk)
                ->orderBy('created_at', 'asc')
                ->get();
            $processDuplicateGroup($nuptkTeachers);
        }

        // 2d. Deduplicate based on exact NIP match
        $nips = $applyRoleFilter(Teacher::withoutTenantScope())
            ->select('nip')
            ->distinct()
            ->whereNotNull('nip')
            ->where('nip', '!=', '')
            // ensure it's not the nim nyasar format
            ->whereRaw("LENGTH(nip) != 9 OR nip NOT LIKE '1134%'")
            ->pluck('nip');

        foreach ($nips as $nip) {
            $nipTeachers = Teacher::withoutTenantScope()
                ->where('nip', $nip)
                ->orderBy('created_at', 'asc')
                ->get();
            $processDuplicateGroup($nipTeachers);
        }

        // 3. CLEANUP: Kosongkan NIP yang isinya sebenarnya adalah NIM (1134... 9 digit)
        if (!$isDryRun) {
            $applyRoleFilter(Teacher::withoutTenantScope())
                ->where('nip', 'like', '1134%')
                ->whereRaw("LENGTH(nip) = 9")
                ->update(['nip' => null]);
        }

        if ($isDryRun) {
            return $this->successResponse([
                'merged_count' => $mergedCount,
                'samples' => $dryRunSamples
            ], "Simulasi: $mergedCount data ganda terdeteksi (Berdasarkan NIM Nyasar & Kesamaan Nama).");
        }

        return $this->successResponse([
            'merged_count' => $mergedCount,
        ], "Berhasil menggabungkan $mergedCount data ganda.");
    }

    /**
     * POST /api/teachers/import — Bulk import from JSON array
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate(['teachers' => 'required|array']);

        $dateErrors = $this->strictDateValidationService->validateRows($request->teachers);
        if (!empty($dateErrors)) {
            return response()->json([
                'success'     => false,
                'message'     => $this->strictDateValidationService->formatErrorMessage($dateErrors),
                'errors'      => $dateErrors,
                'date_errors' => $dateErrors,
            ], 422);
        }

        $created = 0;
        $errors = [];

        $allowedFields = [
            'nuptk', 'nama', 'nip', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir',
            'pendidikan_terakhir', 'mapel', 'unit_kerja', 'school_id', 'status',
            'phone_number', 'email', 'is_active', 'is_verified',
            'is_certified', 'tmt', 'pdpkpnu', 'kecamatan', 'nomor_induk_maarif',
            'provinsi', 'kabupaten', 'kelurahan'
        ];

        foreach ($request->teachers as $index => $row) {
            try {
                // Normalize keys: trim, lowercase, replace non-alphanumeric with underscore
                $normalizedRow = [];
                foreach ($row as $key => $value) {
                    $cleanKey = preg_replace('/[^a-z0-9]/', '_', trim(strtolower($key)));
                    $cleanKey = preg_replace('/_+/', '_', $cleanKey);
                    $cleanKey = trim($cleanKey, '_');
                    $normalizedRow[$cleanKey] = $value;
                }

                // Parse N.I.M (Nomor Induk Maarif)
                $nim = null;
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'maarif') || (str_contains($k, 'nomor_induk') && !str_contains($k, 'pegawai')) || (str_contains($k, 'nim') && !str_contains($k, 'p'))) {
                        $nim = $v;
                        break;
                    }
                }
                // Normalize NIM — strip dots, dashes, spaces, apostrophes
                $nimNormalized = $nim ? $this->normalizationService->normalizeNim((string)$nim) : null;
                // If the "NIM" value is non-numeric text (e.g. "Non PNS", "PNS"), discard it
                if ($nimNormalized !== null && !ctype_digit($nimNormalized)) {
                    $nimNormalized = null;
                }
                $normalizedRow['nomor_induk_maarif'] = $nimNormalized;

                // Parse NUPTK
                $nuptk = null;
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'nuptk') || str_contains($k, 'n_u_p_t_k') || str_contains($k, 'pegawai')) {
                        $nuptk = $v;
                        break;
                    }
                }
                // Strip apostrophe and whitespace from NUPTK
                $nuptk = $nuptk ? ltrim(trim((string)$nuptk), "' ") : null;
                // If NUPTK looks like a NIM (9 digits, starts with 1134), move it to nomor_induk_maarif
                if ($nuptk !== null && preg_match('/^1134\d{5}$/', $nuptk)) {
                    if (empty($normalizedRow['nomor_induk_maarif'])) {
                        $normalizedRow['nomor_induk_maarif'] = $nuptk;
                    }
                    $nuptk = null; // clear from NUPTK field
                }
                // NUPTK must be numeric-only (16 digits typically); discard non-numeric values
                if ($nuptk !== null && !ctype_digit($nuptk)) {
                    $nuptk = null;
                }
                $normalizedRow['nuptk'] = $nuptk;

                // Parse NIP (Pegawai/NIY)
                $nip = null;
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'nip') || str_contains($k, 'niy') || str_contains($k, 'pegawai') || (str_contains($k, 'n_i_y'))) {
                        $nip = $v;
                        break;
                    }
                }
                $normalizedRow['nip'] = $nip ? ltrim(trim((string)$nip), "'") : null;

                // Parse Satminkal (unit_kerja)
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'satminkal') || str_contains($k, 'unit_kerja')
                        || str_contains($k, 'nama_sekolah') || str_contains($k, 'nama_madrasah')
                        || str_contains($k, 'nama_lembaga') || str_contains($k, 'tempat_tugas')
                        || str_contains($k, 'asal_sekolah') || str_contains($k, 'instansi')
                        || $k === 'lembaga' || $k === 'madrasah' || $k === 'sekolah'
                    ) {
                        $normalizedRow['unit_kerja'] = $v;
                        break;
                    }
                }

                // Parse Provinsi
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'provinsi') || str_contains($k, 'propinsi')) {
                        $normalizedRow['provinsi'] = $v;
                        break;
                    }
                }

                // Parse Kabupaten/Kota
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'kab_kota') || str_contains($k, 'kabupaten')) {
                        $normalizedRow['kabupaten'] = $v;
                        break;
                    }
                }

                // Parse Kelurahan/Desa
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'kelurahan_desa') || str_contains($k, 'kelurahan')) {
                        $normalizedRow['kelurahan'] = $v;
                        break;
                    }
                }

                // Parse No HP
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'no_hp') || str_contains($k, 'nomor_hp')) {
                        $normalizedRow['phone_number'] = ltrim(trim((string)$v), "'");
                        break;
                    }
                }

                $schoolId = $normalizedRow['school_id'] ?? null;
                // Force user's school if operator
                if ($request->user()->role === 'operator') {
                    $schoolId = $request->user()->school_id;
                    // If unit_kerja is blank, fall back to the operator's school name
                    if (empty(trim((string)($normalizedRow['unit_kerja'] ?? '')))) {
                        $operatorSchool = School::find($schoolId);
                        $normalizedRow['unit_kerja'] = $operatorSchool?->nama;
                    }
                } elseif (!$schoolId && isset($normalizedRow['unit_kerja'])) {
                    // Case-insensitive school lookup (database-agnostic)
                    $school = School::whereRaw('LOWER(nama) = LOWER(?)', [$normalizedRow['unit_kerja']])->first();
                    $schoolId = $school?->id;
                }

                // Parse Sertifikasi
                $sertifikasi = null;
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'sertif') || str_contains($k, 'certified')) {
                        $sertifikasi = $v;
                        break;
                    }
                }
                if ($sertifikasi !== null && $sertifikasi !== '') {
                    $val = strtolower(trim((string)$sertifikasi));
                    $normalizedRow['is_certified'] = in_array($val, ['sudah', 'ya', '1', 'true', 'yes', 'v']);
                }

                // Parse Tempat Tanggal Lahir (Combined)
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'tempat_tanggal_lahir') || $k === 'ttl' || str_contains($k, 'tempat_tgl_lahir')) {
                        $parts = explode(',', (string)$v);
                        if (count($parts) >= 2) {
                            if (!isset($normalizedRow['tempat_lahir'])) {
                                $normalizedRow['tempat_lahir'] = trim($parts[0]);
                            }
                            if (!isset($normalizedRow['tanggal_lahir'])) {
                                $normalizedRow['tanggal_lahir'] = trim($parts[1]);
                            }
                        }
                        break;
                    }
                }

                // Parse Tanggal Lahir (Strict Date Validation & Normalization)
                $tglLahirRaw = $normalizedRow['tanggal_lahir'] ?? $normalizedRow['tgl_lahir'] ?? null;
                if ($tglLahirRaw !== null && (string)$tglLahirRaw !== '') {
                    $normalizedRow['tanggal_lahir'] = $this->strictDateValidationService->parseAndNormalize($tglLahirRaw);
                } else {
                    $normalizedRow['tanggal_lahir'] = null;
                }

                // Parse PDPKPNU
                $pdpkpnuRaw = null;
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'pdpkpnu') || str_contains($k, 'p_d_p_k_p_n_u')) {
                        $pdpkpnuRaw = $v;
                        break;
                    }
                }
                if ($pdpkpnuRaw !== null && $pdpkpnuRaw !== '') {
                    $val2 = strtolower(trim((string)$pdpkpnuRaw));
                    $normalizedRow['pdpkpnu'] = in_array($val2, ['sudah', 'ya', '1', 'true', 'yes', 'v']) ? 'Sudah' : 'Belum';
                }

                // Parse TMT Date (Strict Date Validation & Normalization)
                $tmtRaw = null;
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'tmt') || str_contains($k, 'mulai_tugas') || str_contains($k, 'tanggal_tugas') || str_contains($k, 'penugasan')) {
                        $tmtRaw = $v;
                        break;
                    }
                }
                $tmtDate = null;
                if ($tmtRaw !== null && (string)$tmtRaw !== '') {
                    $normalizedTmt = $this->strictDateValidationService->parseAndNormalize($tmtRaw);
                    $normalizedRow['tmt'] = $normalizedTmt;
                    $tmtDate = $normalizedTmt ? \Carbon\Carbon::parse($normalizedTmt) : null;
                }

                // Kalkulasi Status berdasarkan Pendidikan Terakhir, TMT Lama Pengabdian, dan Sertifikasi
                $pendidikan = null;
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'pendidikan') || str_contains($k, 'ijazah') || str_contains($k, 'ijasah') || str_contains($k, 'jenjang')) {
                        $pendidikan = $v;
                        break;
                    }
                }

                if ($pendidikan !== null) {
                    $normalizedRow['pendidikan_terakhir'] = $pendidikan;
                    $pendidikanTinggi = ['S1', 'S2', 'S3', 'D4', 'S1/D4', 'STRATA'];
                    $isSarjana = false;
                    foreach ($pendidikanTinggi as $pt) {
                        if (stripos((string)$pendidikan, $pt) !== false) {
                            $isSarjana = true;
                            break;
                        }
                    }

                    if (!$isSarjana) {
                        // Non-sarjana (D1/D2/D3/SMA/dll) → Tendik
                        $normalizedRow['status'] = 'Tendik';
                    } elseif ($tmtDate) {
                        // Sarjana + TMT ada → hitung lama pengabdian
                        $diffYears = $tmtDate->diffInYears(\Carbon\Carbon::now());
                        $normalizedRow['status'] = ($diffYears >= 2) ? 'GTY' : 'GTT';
                    } else {
                        // Sarjana tapi TMT kosong → GTT
                        $normalizedRow['status'] = 'GTT';
                    }
                }

                // Filter row to only include allowed fields
                $dataToSave = [];
                foreach ($allowedFields as $field) {
                    if (isset($normalizedRow[$field])) {
                        $dataToSave[$field] = $normalizedRow[$field];
                    }
                }

                // Explicitly bind parsed pendidikan because the 'Pendidikan Terakhir' raw key might not match the allowedField name 'pendidikan_terakhir' precisely in earlier steps
                if (isset($normalizedRow['pendidikan_terakhir']) && $normalizedRow['pendidikan_terakhir'] !== null) {
                    $dataToSave['pendidikan_terakhir'] = $normalizedRow['pendidikan_terakhir'];
                }

                // Fallback for nama
                if (empty($dataToSave['nama'])) {
                    foreach($normalizedRow as $k => $v) {
                        if (str_contains($k, 'nama') || $k === 'guru' || $k === 'karyawan') {
                            $dataToSave['nama'] = $v;
                            break;
                        }
                    }
                }

                if (empty($dataToSave['nama'])) {
                    // Skip if empty row
                    if (empty(array_filter($normalizedRow))) continue;
                    $dataToSave['nama'] = "Guru Baru (Tanpa Nama)";
                }

                // Apply name normalization
                $originalNama = $dataToSave['nama'];
                $dataToSave['nama'] = $this->normalizationService->normalizeTeacherName($dataToSave['nama']);

                $originalUnitKerja = $dataToSave['unit_kerja'] ?? null;
                if (isset($dataToSave['unit_kerja'])) {
                    $dataToSave['unit_kerja'] = $this->normalizationService->normalizeSchoolName($dataToSave['unit_kerja']);
                }

                $originalTempatLahir = $dataToSave['tempat_lahir'] ?? null;
                if (isset($dataToSave['tempat_lahir'])) {
                    $dataToSave['tempat_lahir'] = $this->normalizationService->normalizePlaceOfBirth($dataToSave['tempat_lahir']);
                }

                // Normalize employment status to one of: GTY, GTT, Tendik, PNS
                if (isset($dataToSave['status'])) {
                    $tmtForStatus = isset($dataToSave['tmt']) ? \Carbon\Carbon::parse($dataToSave['tmt']) : null;
                    $teacherNameForStatus = $dataToSave['nama'] ?? null;
                    $dataToSave['status'] = $this->normalizationService->normalizeEmploymentStatus($dataToSave['status'], $tmtForStatus, $teacherNameForStatus);
                }

                // Track normalization changes for this teacher
                $normalizationChanges = [];
                if ($originalNama !== $dataToSave['nama']) {
                    $normalizationChanges['nama'] = [
                        'original' => $originalNama,
                        'normalized' => $dataToSave['nama']
                    ];
                }
                if ($originalUnitKerja && isset($dataToSave['unit_kerja']) && $originalUnitKerja !== $dataToSave['unit_kerja']) {
                    $normalizationChanges['unit_kerja'] = [
                        'original' => $originalUnitKerja,
                        'normalized' => $dataToSave['unit_kerja']
                    ];
                }
                if ($originalTempatLahir && isset($dataToSave['tempat_lahir']) && $originalTempatLahir !== $dataToSave['tempat_lahir']) {
                    $normalizationChanges['tempat_lahir'] = [
                        'original' => $originalTempatLahir,
                        'normalized' => $dataToSave['tempat_lahir']
                    ];
                }

                $savePayload = array_merge(array_filter($dataToSave, fn($v) => $v !== null && $v !== ''), ['school_id' => $schoolId]);

                // Pastikan unit_kerja dari fallback operator selalu masuk ke payload,
                // tidak ikut dibuang oleh array_filter di atas
                if (empty($savePayload['unit_kerja']) && !empty($normalizedRow['unit_kerja'])) {
                    $savePayload['unit_kerja'] = $normalizedRow['unit_kerja'];
                }

                // Fallback terakhir: ambil dari nama sekolah berdasarkan school_id
                if (empty($savePayload['unit_kerja']) && $schoolId) {
                    $fallbackSchool = School::find($schoolId);
                    if ($fallbackSchool) {
                        $savePayload['unit_kerja'] = $fallbackSchool->nama;
                    }
                }
                $teacher = null;
                if ($nuptk) {
                    $teacher = Teacher::withoutTenantScope()->where('nuptk', $nuptk)->first();
                }
                
                if (!$teacher) {
                    $teacher = Teacher::withoutTenantScope()
                        ->where('nama', $dataToSave['nama'])
                        ->where('school_id', $schoolId)
                        ->first();
                }

                // Forcefully reclaim the NIM if it's already used by someone else
                if (!empty($savePayload['nomor_induk_maarif'])) {
                    $nimToReclaim = $savePayload['nomor_induk_maarif'];
                    $nimConflicts = Teacher::withoutTenantScope()
                        ->where('nomor_induk_maarif', $nimToReclaim)
                        ->when($teacher, function ($query) use ($teacher) {
                            $query->where('id', '!=', $teacher->id);
                        })
                        ->get();
                    
                    foreach ($nimConflicts as $conflict) {
                        $conflict->update(['nomor_induk_maarif' => null]);
                        try {
                            ActivityLog::create([
                                'description' => "NIM {$nimToReclaim} dicabut otomatis karena dipakai oleh data resmi atas nama {$dataToSave['nama']}",
                                'event' => 'nim_force_reassigned',
                                'log_name' => 'master',
                                'subject_id' => $conflict->id,
                                'subject_type' => get_class($conflict),
                                'causer_id' => $request->user()->id,
                                'causer_type' => get_class($request->user()),
                                'school_id' => $conflict->school_id,
                            ]);
                        } catch (\Exception $e) {
                            // ignore log error
                        }
                    }
                }

                if ($teacher) {
                    $teacher->update($savePayload);
                } else {
                    $teacher = Teacher::create($savePayload);
                }
                
                // Log normalization changes if any occurred during import
                if (!empty($normalizationChanges)) {
                    try {
                        ActivityLog::create([
                            'description' => "Import normalisasi guru: {$teacher->nama}",
                            'event' => 'import_normalize_teacher',
                            'log_name' => 'master',
                            'subject_id' => $teacher->id,
                            'subject_type' => get_class($teacher),
                            'causer_id' => $request->user()->id,
                            'causer_type' => get_class($request->user()),
                            'school_id' => $teacher->school_id,
                            'properties' => ['normalization' => $normalizationChanges],
                        ]);
                    } catch (\Exception $e) {
                        // Continue processing even if activity log fails
                        \Log::warning('Failed to log normalization during import', [
                            'teacher_id' => $teacher->id,
                            'error' => $e->getMessage()
                        ]);
                    }
                }
                
                $created++;
            } catch (\Throwable $e) {
                $errors[] = [
                    'row' => $index + 1,
                    'nuptk' => (string)($row['nuptk'] ?? $row['NUPTK'] ?? 'empty'), 
                    'error' => $e->getMessage()
                ];
                continue; // pastikan loop berlanjut
            }
        }

        return response()->json([
            'created' => $created, 
            'errors' => $errors,
            'summary' => "Berhasil: $created, Gagal: " . count($errors)
        ]);
    }

    /**
     * GET /api/teachers/nim/generate
     * Preview the next NIM that would be generated. Does NOT save anything.
     * Format: 1134XXXXX (prefix "1134" = Cilacap code + 5-digit zero-padded sequence)
     *
     * Feature: nim-generator-sk, Property 1: NIM generate = gap-fill mulai dari 113403832
     *
     * Logika: cari NIM kosong pertama mulai dari urutan 3832 (113403832) ke atas.
     * Gap sebelum 3832 diabaikan (dianggap sudah tidak relevan).
     * Jika semua terisi s/d MAX, fallback ke MAX+1.
     */
    public function previewNim(): JsonResponse
    {
        $driver = \DB::connection()->getDriverName();

        // Titik awal pencarian gap — urutan 5-digit setelah prefix "1134"
        // Sesuai permintaan: mulai scan dari 113403832
        $scanStartSeq = 3832;

        // Ambil semua NIM aktif format 1134XXXXX secara global (lintas tenant).
        $baseQuery = Teacher::withoutTenantScope()
            ->where('nomor_induk_maarif', 'like', '1134%')
            ->whereRaw("LENGTH(nomor_induk_maarif) = 9");

        if ($driver === 'pgsql') {
            $baseQuery->whereRaw("nomor_induk_maarif ~ '^[0-9]+$'");
        } else {
            $baseQuery->whereRaw("nomor_induk_maarif GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'");
        }

        // Load ke hash set untuk lookup O(1)
        $allNims = $baseQuery->pluck('nomor_induk_maarif')->flip()->all();

        if (empty($allNims)) {
            return $this->successResponse([
                'nim'         => '1134' . str_pad($scanStartSeq, 5, '0', STR_PAD_LEFT),
                'current_max' => null,
                'has_gap'     => false,
            ]);
        }

        // Cari MAX sequence untuk tahu batas atas iterasi
        $maxSeq = collect(array_keys($allNims))
            ->map(fn($n) => (int) substr($n, 4))
            ->max();

        // Jika MAX di bawah scan start, tidak ada NIM di range yang relevan
        // → langsung kembalikan scan start sebagai NIM berikutnya
        if ($maxSeq < $scanStartSeq) {
            return $this->successResponse([
                'nim'         => '1134' . str_pad($scanStartSeq, 5, '0', STR_PAD_LEFT),
                'current_max' => '1134' . str_pad($maxSeq, 5, '0', STR_PAD_LEFT),
                'has_gap'     => true,
            ]);
        }

        // Scan dari scanStartSeq s/d MAX, cari gap pertama
        $gapSeq = null;
        for ($seq = $scanStartSeq; $seq <= $maxSeq; $seq++) {
            $candidate = '1134' . str_pad($seq, 5, '0', STR_PAD_LEFT);
            if (!isset($allNims[$candidate])) {
                $gapSeq = $seq;
                break;
            }
        }

        if ($gapSeq !== null) {
            // Ada gap di range scanStart s/d MAX
            $nextNim = '1134' . str_pad($gapSeq, 5, '0', STR_PAD_LEFT);
        } else {
            // Tidak ada gap di range itu — lanjut dari MAX+1
            $nextNim = '1134' . str_pad($maxSeq + 1, 5, '0', STR_PAD_LEFT);
        }

        return $this->successResponse([
            'nim'         => $nextNim,
            'current_max' => '1134' . str_pad($maxSeq, 5, '0', STR_PAD_LEFT),
            'has_gap'     => $gapSeq !== null,
        ]);
    }

    /**
     * PATCH /api/teachers/{id}/nim
     * Save a NIM to a teacher record. Validates global uniqueness across all tenants.
     *
     * Feature: nim-generator-sk, Property 3: Global uniqueness — no two teachers may share the same NIM
     * Feature: nim-generator-sk, Property 5: Format validation — non-numeric NIM rejected
     */
    public function updateNim(UpdateNimRequest $request, Teacher $teacher): JsonResponse
    {
        $this->authorize('update', $teacher);

        // Normalize NIM before validation — strip dots, dashes, spaces
        $nim = $this->normalizationService->normalizeNim($request->validated()['nim']) ?? $request->validated()['nim'];

        // Global uniqueness check — bypass tenant scope to check across ALL schools
        $duplicate = Teacher::withoutTenantScope()
            ->where('nomor_induk_maarif', $nim)
            ->where('id', '!=', $teacher->id)
            ->with('school')
            ->first();

        if ($duplicate) {
            $sekolah = $duplicate->school?->nama ?? 'Sekolah tidak diketahui';
            return $this->errorResponse(
                'NIM sudah digunakan oleh guru lain.',
                [
                    'nim' => ["NIM {$nim} sudah digunakan oleh {$duplicate->nama} ({$sekolah})."],
                ],
                422
            );
        }

        $oldNim = $teacher->nomor_induk_maarif;

        $teacher->nomor_induk_maarif = $nim;
        $teacher->save();

        // Activity log
        ActivityLog::create([
            'description' => "Update NIM guru: {$teacher->nama} → {$nim}",
            'event'       => 'update_nim',
            'log_name'    => 'master',
            'subject_id'  => $teacher->id,
            'subject_type' => get_class($teacher),
            'causer_id'   => $request->user()->id,
            'causer_type' => get_class($request->user()),
            'school_id'   => $teacher->school_id,
            'properties'  => [
                'old_nim' => $oldNim,
                'new_nim' => $nim,
            ],
        ]);

        return $this->successResponse(
            [
                'id'                  => $teacher->id,
                'nama'                => $teacher->nama,
                'nomor_induk_maarif'  => $teacher->nomor_induk_maarif,
            ],
            'NIM berhasil disimpan.'
        );
    }

    /**
     * Delete all teachers from the database.
     */
    public function deleteAll(): JsonResponse
    {
        $count = Teacher::count();
        Teacher::query()->delete();

        return response()->json([
            'success' => true,
            'message' => "Berhasil menghapus $count data guru.",
            'deleted' => $count,
        ]);
    }

    /**
     * POST /api/teachers/recalculate-status
     * Batch re-evaluate GTY/GTT/Tendik status for all teachers based on:
     * - TMT (Tanggal Mulai Tugas): GTY if ≥ 2 years, GTT if < 2 years
     * - Gelar akademik: no degree → Tendik, diploma only → Tendik
     * - pendidikan_terakhir: D3/D2/D1/SMA or below → Tendik
     *
     * Only recalculates non-PNS teachers (PNS status is final).
     * Supports ?dry_run=true for preview without saving.
     */
    public function recalculateStatuses(Request $request): JsonResponse
    {
        if (!in_array($request->user()->role, ['super_admin', 'admin_yayasan'])) {
            return $this->errorResponse('Anda tidak memiliki akses.', 403);
        }

        $isDryRun = $request->boolean('dry_run', false);
        $schoolId = $request->input('school_id');

        $query = Teacher::withoutTenantScope()
            ->whereNotIn('status', ['PNS', 'PPPK'])  // PNS/PPPK are final
            ->whereNotNull('status');

        // Scope to specific school if requested (for operator-level batch)
        if ($schoolId) {
            $query->where('school_id', $schoolId);
        } elseif (!in_array($request->user()->role, ['super_admin', 'admin_yayasan'])) {
            $query->where('school_id', $request->user()->school_id);
        }

        $updated = 0;
        $total   = 0;
        $changes = [];

        $query->chunk(500, function ($teachers) use (&$updated, &$total, &$changes, $isDryRun) {
            foreach ($teachers as $teacher) {
                $total++;
                $originalStatus     = $teacher->status;
                $originalPendidikan = $teacher->pendidikan_terakhir;

                // Parse TMT
                $tmt = null;
                if ($teacher->tmt) {
                    try {
                        $tmt = \Carbon\Carbon::parse((string) $teacher->tmt);
                    } catch (\Exception $e) {
                        $tmt = null;
                    }
                }

                // Auto-infer pendidikan_terakhir jika kosong
                $newPendidikan = $originalPendidikan;
                if (empty(trim((string) $originalPendidikan))) {
                    $inferred = $this->normalizationService->inferPendidikanFromName($teacher->nama);
                    if ($inferred !== null) {
                        $newPendidikan = $inferred;
                    }
                }

                $newStatus = $this->normalizationService->normalizeEmploymentStatus(
                    $originalStatus,
                    $tmt,
                    $teacher->nama,
                    $newPendidikan ?? $originalPendidikan
                );

                $statusChanged    = $newStatus !== $originalStatus;
                $pendidikanChanged = $newPendidikan !== $originalPendidikan;

                if ($statusChanged || $pendidikanChanged) {
                    $toUpdate = [];
                    if ($statusChanged)    $toUpdate['status']             = $newStatus;
                    if ($pendidikanChanged) $toUpdate['pendidikan_terakhir'] = $newPendidikan;

                    if (!$isDryRun) {
                        $teacher->update($toUpdate);
                    }
                    if ($statusChanged) {
                        $changes[] = [
                            'id'      => $teacher->id,
                            'nama'    => $teacher->nama,
                            'tmt'     => $teacher->tmt,
                            'dari'    => $originalStatus,
                            'menjadi' => $newStatus,
                            'pendidikan_baru' => $pendidikanChanged ? $newPendidikan : null,
                        ];
                    } elseif ($pendidikanChanged) {
                        $changes[] = [
                            'id'      => $teacher->id,
                            'nama'    => $teacher->nama,
                            'tmt'     => $teacher->tmt,
                            'dari'    => $originalStatus,
                            'menjadi' => $newStatus,
                            'pendidikan_baru' => $newPendidikan,
                        ];
                    }
                    $updated++;
                }
            }
        });

        if (!$isDryRun && $updated > 0) {
            ActivityLog::create([
                'description' => "Recalculate status kepegawaian: {$updated} dari {$total} guru diperbarui.",
                'event'       => 'recalculate_teacher_status',
                'log_name'    => 'master',
                'causer_id'   => $request->user()->id,
                'causer_type' => get_class($request->user()),
                'school_id'   => null,
                'properties'  => ['updated' => $updated, 'total' => $total],
            ]);
        }

        $message = $isDryRun
            ? "Preview: {$updated} dari {$total} guru akan diperbarui statusnya."
            : "Selesai: {$updated} dari {$total} guru berhasil diperbarui statusnya.";

        return $this->successResponse([
            'total'    => $total,
            'updated'  => $updated,
            'dry_run'  => $isDryRun,
            'changes'  => $isDryRun ? $changes : array_slice($changes, 0, 50), // limit detail in live mode
        ], $message);
    }

    /**
     * Generate user accounts for teachers who don't have one.
     * Username: email (from NUPTK@maarif.nu if no email), Password: tanggal_lahir (ddmmyyyy).
     */
    /**
     * POST /api/teachers/nim/bulk-generate
     * Bulk generate NIM for teachers who don't have one.
     */
    public function bulkGenerateNim(Request $request): JsonResponse
    {
        // Require super_admin or admin_yayasan
        if (!in_array($request->user()->role, ['super_admin', 'admin_yayasan'])) {
            return response()->json(['message' => 'Anda tidak memiliki akses.'], 403);
        }

        $teacherIds = $request->input('teacher_ids');

        $query = Teacher::where(function ($q) {
            $q->whereNull('nomor_induk_maarif')
              ->orWhere('nomor_induk_maarif', '')
              ->orWhere('nomor_induk_maarif', '-');
        });

        if ($teacherIds && count($teacherIds) > 0) {
            $query->whereIn('id', $teacherIds);
        }
        
        // Selalu terapkan filter ketat: hanya untuk sekolah jam'iyyah dan BUKAN PNS
        $query->whereHas('school', function ($q) {
            $q->whereRaw("LOWER(status_jamiyyah) LIKE '%jam%iyyah%'");
        })->where(function ($q) {
            $q->whereRaw("LOWER(status) NOT LIKE '%pns%'")
              ->orWhereNull('status');
        });

        // Order by name ascending
        $teachers = $query->orderBy('nama', 'asc')->get();

        if ($teachers->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Tidak ada guru yang membutuhkan NIM pada data yang dipilih.'
            ]);
        }

        $generatedCount = 0;
        $results = [];

        \DB::transaction(function () use ($teachers, &$generatedCount, &$results, $request) {
            $driver = \DB::connection()->getDriverName();

            // Titik awal scan gap — harus sama dengan $scanStartSeq di previewNim()
            $scanStartSeq = 3832;

            // Load semua NIM aktif format 1134XXXXX ke hash set untuk lookup O(1)
            $baseQuery = Teacher::withoutTenantScope()
                ->where('nomor_induk_maarif', 'like', '1134%')
                ->whereRaw("LENGTH(nomor_induk_maarif) = 9");

            if ($driver === 'pgsql') {
                $baseQuery->whereRaw("nomor_induk_maarif ~ '^[0-9]+$'");
            } else {
                $baseQuery->whereRaw("nomor_induk_maarif GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'");
            }

            // Hash set: NIM → true, untuk lookup O(1) tanpa N+1 query
            $usedNims = $baseQuery->pluck('nomor_induk_maarif')->flip()->all();

            // Cari MAX sequence
            $maxSeq = empty($usedNims)
                ? 0
                : collect(array_keys($usedNims))->map(fn($n) => (int) substr($n, 4))->max();

            // Pointer untuk scan gap, mulai dari scanStartSeq
            $scanPtr = $scanStartSeq;

            foreach ($teachers as $teacher) {
                // Cari NIM berikutnya: gap-fill dari scanPtr, fallback ke MAX+1
                while (isset($usedNims['1134' . str_pad($scanPtr, 5, '0', STR_PAD_LEFT)])) {
                    $scanPtr++;
                }

                // Jika scanPtr masih dalam range <= MAX, ambil gap ini
                // Jika sudah melewati MAX, scanPtr = MAX+1 (sudah increment di atas)
                $nextNim = '1134' . str_pad($scanPtr, 5, '0', STR_PAD_LEFT);

                // Tandai NIM ini sebagai terpakai di hash set (untuk iterasi berikutnya)
                $usedNims[$nextNim] = true;
                if ($scanPtr > $maxSeq) {
                    $maxSeq = $scanPtr;
                }
                $scanPtr++;

                $teacher->update(['nomor_induk_maarif' => $nextNim]);

                $results[] = [
                    'id'   => $teacher->id,
                    'nama' => $teacher->nama,
                    'nim'  => $nextNim,
                ];
                $generatedCount++;
            }

            \App\Models\ActivityLog::log(
                description: "Bulk Generate NIM: {$generatedCount} NIM berhasil dibuat",
                event: 'bulk_generate_nim',
                logName: 'teacher',
                causer: $request->user()
            );
        });

        return response()->json([
            'success' => true,
            'count' => $generatedCount,
            'results' => $results,
            'message' => "Berhasil men-generate {$generatedCount} NIM baru."
        ]);
    }

    /**
     * POST /api/teachers/nim/bulk-generate/preview
     * Preview daftar guru yang akan menerima NIM dari bulkGenerateNim (tidak menyimpan).
     * Berguna untuk konfirmasi sebelum generate massal.
     */
    public function previewBulkGenerateNim(Request $request): JsonResponse
    {
        if (!in_array($request->user()->role, ['super_admin', 'admin_yayasan'])) {
            return response()->json(['message' => 'Anda tidak memiliki akses.'], 403);
        }

        $teacherIds = $request->input('teacher_ids');

        $query = Teacher::with('school')
            ->where(function ($q) {
                $q->whereNull('nomor_induk_maarif')
                  ->orWhere('nomor_induk_maarif', '')
                  ->orWhere('nomor_induk_maarif', '-');
            })
            ->whereHas('school', function ($q) {
                $q->whereRaw("LOWER(status_jamiyyah) LIKE '%jam%iyyah%'");
            })
            ->where(function ($q) {
                $q->whereRaw("LOWER(status) NOT LIKE '%pns%'")
                  ->orWhereNull('status');
            });

        if ($teacherIds && count($teacherIds) > 0) {
            $query->whereIn('id', $teacherIds);
        }

        $teachers = $query->orderBy('nama', 'asc')
            ->get(['id', 'nama', 'status', 'unit_kerja', 'school_id']);

        return response()->json([
            'success' => true,
            'count' => $teachers->count(),
            'teachers' => $teachers->map(fn($t) => [
                'id'        => $t->id,
                'nama'      => $t->nama,
                'status'    => $t->status,
                'unit_kerja'=> $t->unit_kerja,
                'school'    => $t->school ? ['nama' => $t->school->nama] : null,
            ]),
        ]);
    }

    public function generateAccounts(Request $request): JsonResponse
    {
        $teacherIds = $request->input('teacher_ids');

        $query = Teacher::query();
        if ($teacherIds && count($teacherIds) > 0) {
            $query->whereIn('id', $teacherIds);
        }
        $teachers = $query->get();

        $accounts = [];

        foreach ($teachers as $teacher) {
            // Generate email from NUPTK or name
            $slug = $teacher->nuptk
                ? strtolower(preg_replace('/\s+/', '', $teacher->nuptk))
                : strtolower(preg_replace('/[^a-z0-9]/', '', str_replace(' ', '', $teacher->nama)));

            $email = $teacher->email ?: "{$slug}@maarif.nu";

            // Skip if user with this email already exists
            if (\App\Models\User::where('email', $email)->exists()) {
                continue;
            }

            // Generate password from tanggal_lahir (ddmmyyyy) or default
            $passwordPlain = $teacher->tanggal_lahir
                ? \Carbon\Carbon::parse($teacher->tanggal_lahir)->format('dmY')
                : 'maarif' . ($teacher->nuptk ? substr($teacher->nuptk, -4) : '1234');

            $user = \App\Models\User::create([
                'name'     => $teacher->nama,
                'email'    => $email,
                'password' => $passwordPlain,
                'role'     => 'operator',
                'is_active' => true,
                'school_id' => $teacher->school_id,
            ]);

            // Update teacher email reference
            if (!$teacher->email) {
                $teacher->update(['email' => $email]);
            }

            $accounts[] = [
                'teacher_id'     => $teacher->id,
                'nama'           => $teacher->nama,
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

    /**
     * Parse and normalize a single row from the Excel/JSON import.
     */
    private function parseImportRow(array $row, Request $request): array
    {
        $allowedFields = [
            'nuptk', 'nama', 'nip', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir',
            'pendidikan_terakhir', 'mapel', 'unit_kerja', 'school_id', 'status',
            'phone_number', 'email', 'is_active', 'is_verified',
            'is_certified', 'tmt', 'pdpkpnu', 'kecamatan', 'nomor_induk_maarif',
            'provinsi', 'kabupaten', 'kelurahan'
        ];

        // Normalize keys: trim, lowercase, replace non-alphanumeric with underscore
        $normalizedRow = [];
        foreach ($row as $key => $value) {
            $cleanKey = preg_replace('/[^a-z0-9]/', '_', trim(strtolower($key)));
            $cleanKey = preg_replace('/_+/', '_', $cleanKey);
            $cleanKey = trim($cleanKey, '_');
            $normalizedRow[$cleanKey] = $value;
        }

        // Parse N.I.M (Nomor Induk Maarif)
        $nim = null;
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'maarif') || (str_contains($k, 'nomor_induk') && !str_contains($k, 'pegawai')) || (str_contains($k, 'nim') && !str_contains($k, 'p'))) {
                $nim = $v;
                break;
            }
        }
        // Normalize NIM — strip dots, dashes, spaces, apostrophes
        $nimNormalized = $nim ? $this->normalizationService->normalizeNim((string)$nim) : null;
        // If the "NIM" value is non-numeric text (e.g. "Non PNS", "PNS"), discard it
        if ($nimNormalized !== null && !ctype_digit($nimNormalized)) {
            $nimNormalized = null;
        }
        $normalizedRow['nomor_induk_maarif'] = $nimNormalized;

        // Parse NUPTK
        $nuptk = null;
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'nuptk') || str_contains($k, 'n_u_p_t_k') || str_contains($k, 'pegawai')) {
                $nuptk = $v;
                break;
            }
        }
        // Strip apostrophe and whitespace from NUPTK
        $nuptk = $nuptk ? ltrim(trim((string)$nuptk), "' ") : null;
        // If NUPTK looks like a NIM (9 digits, starts with 1134), move it to nomor_induk_maarif
        if ($nuptk !== null && preg_match('/^1134\d{5}$/', $nuptk)) {
            if (empty($normalizedRow['nomor_induk_maarif'])) {
                $normalizedRow['nomor_induk_maarif'] = $nuptk;
            }
            $nuptk = null; // clear from NUPTK field
        }
        // NUPTK must be numeric-only (16 digits typically); discard non-numeric values
        if ($nuptk !== null && !ctype_digit($nuptk)) {
            $nuptk = null;
        }
        $normalizedRow['nuptk'] = $nuptk;

        // Parse NIP (Pegawai/NIY)
        $nip = null;
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'nip') || str_contains($k, 'niy') || str_contains($k, 'pegawai') || (str_contains($k, 'n_i_y'))) {
                $nip = $v;
                break;
            }
        }
        $normalizedRow['nip'] = $nip ? ltrim(trim((string)$nip), "'") : null;

        // Parse Satminkal (unit_kerja)
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'satminkal') || str_contains($k, 'unit_kerja')
                || str_contains($k, 'nama_sekolah') || str_contains($k, 'nama_madrasah')
                || str_contains($k, 'nama_lembaga') || str_contains($k, 'tempat_tugas')
                || str_contains($k, 'asal_sekolah') || str_contains($k, 'instansi')
                || $k === 'lembaga' || $k === 'madrasah' || $k === 'sekolah'
            ) {
                $normalizedRow['unit_kerja'] = $v;
                break;
            }
        }

        // Parse Provinsi, Kabupaten/Kota, Kelurahan/Desa, No HP
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'provinsi') || str_contains($k, 'propinsi')) {
                $normalizedRow['provinsi'] = $v;
                break;
            }
        }
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'kab_kota') || str_contains($k, 'kabupaten')) {
                $normalizedRow['kabupaten'] = $v;
                break;
            }
        }
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'kelurahan_desa') || str_contains($k, 'kelurahan')) {
                $normalizedRow['kelurahan'] = $v;
                break;
            }
        }
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'no_hp') || str_contains($k, 'nomor_hp')) {
                $normalizedRow['phone_number'] = ltrim(trim((string)$v), "'");
                break;
            }
        }

        $schoolId = $normalizedRow['school_id'] ?? null;
        // Force user's school if operator
        if ($request->user()->role === 'operator') {
            $schoolId = $request->user()->school_id;
            if (empty(trim((string)($normalizedRow['unit_kerja'] ?? '')))) {
                $operatorSchool = School::find($schoolId);
                $normalizedRow['unit_kerja'] = $operatorSchool?->nama;
            }
        } elseif (!$schoolId && isset($normalizedRow['unit_kerja'])) {
            $school = School::whereRaw('LOWER(nama) = LOWER(?)', [$normalizedRow['unit_kerja']])->first();
            $schoolId = $school?->id;
        }

        // Parse Sertifikasi
        $sertifikasi = null;
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'sertif') || str_contains($k, 'certified')) {
                $sertifikasi = $v;
                break;
            }
        }
        if ($sertifikasi !== null && $sertifikasi !== '') {
            $val = strtolower(trim((string)$sertifikasi));
            $normalizedRow['is_certified'] = in_array($val, ['sudah', 'ya', '1', 'true', 'yes', 'v']);
        }

        // Parse Tempat Tanggal Lahir (Combined)
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'tempat_tanggal_lahir') || $k === 'ttl' || str_contains($k, 'tempat_tgl_lahir')) {
                $parts = explode(',', (string)$v);
                if (count($parts) >= 2) {
                    if (!isset($normalizedRow['tempat_lahir'])) {
                        $normalizedRow['tempat_lahir'] = trim($parts[0]);
                    }
                    if (!isset($normalizedRow['tanggal_lahir'])) {
                        $normalizedRow['tanggal_lahir'] = trim($parts[1]);
                    }
                }
                break;
            }
        }

        // Parse Tanggal Lahir (Strict Date Validation & Normalization)
        $tglLahirRaw = $normalizedRow['tanggal_lahir'] ?? $normalizedRow['tgl_lahir'] ?? null;
        if ($tglLahirRaw !== null && (string)$tglLahirRaw !== '') {
            $normalizedRow['tanggal_lahir'] = $this->strictDateValidationService->parseAndNormalize($tglLahirRaw);
        } else {
            $normalizedRow['tanggal_lahir'] = null;
        }

        // Parse PDPKPNU
        $pdpkpnuRaw = null;
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'pdpkpnu') || str_contains($k, 'p_d_p_k_p_n_u')) {
                $pdpkpnuRaw = $v;
                break;
            }
        }
        if ($pdpkpnuRaw !== null && $pdpkpnuRaw !== '') {
            $val2 = strtolower(trim((string)$pdpkpnuRaw));
            $normalizedRow['pdpkpnu'] = in_array($val2, ['sudah', 'ya', '1', 'true', 'yes', 'v']) ? 'Sudah' : 'Belum';
        }

        // Parse TMT Date (Strict Date Validation & Normalization)
        $tmtRaw = null;
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'tmt') || str_contains($k, 'mulai_tugas') || str_contains($k, 'tanggal_tugas') || str_contains($k, 'penugasan')) {
                $tmtRaw = $v;
                break;
            }
        }
        $tmtDate = null;
        if ($tmtRaw !== null && (string)$tmtRaw !== '') {
            $normalizedTmt = $this->strictDateValidationService->parseAndNormalize($tmtRaw);
            $normalizedRow['tmt'] = $normalizedTmt;
            $tmtDate = $normalizedTmt ? \Carbon\Carbon::parse($normalizedTmt) : null;
        }

        // Kalkulasi Status
        $pendidikan = null;
        foreach($normalizedRow as $k => $v) {
            if (str_contains($k, 'pendidikan') || str_contains($k, 'ijazah') || str_contains($k, 'ijasah') || str_contains($k, 'jenjang')) {
                $pendidikan = $v;
                break;
            }
        }

        if ($pendidikan !== null) {
            $normalizedRow['pendidikan_terakhir'] = $pendidikan;
            $pendidikanTinggi = ['S1', 'S2', 'S3', 'D4', 'S1/D4', 'STRATA'];
            $isSarjana = false;
            foreach ($pendidikanTinggi as $pt) {
                if (stripos((string)$pendidikan, $pt) !== false) {
                    $isSarjana = true;
                    break;
                }
            }

            if (!$isSarjana) {
                $normalizedRow['status'] = 'Tendik';
            } elseif ($tmtDate) {
                $diffYears = $tmtDate->diffInYears(\Carbon\Carbon::now());
                $normalizedRow['status'] = ($diffYears >= 2) ? 'GTY' : 'GTT';
            } else {
                $normalizedRow['status'] = 'GTT';
            }
        }

        $dataToSave = [];
        foreach ($allowedFields as $field) {
            if (isset($normalizedRow[$field])) {
                $dataToSave[$field] = $normalizedRow[$field];
            }
        }

        if (isset($normalizedRow['pendidikan_terakhir']) && $normalizedRow['pendidikan_terakhir'] !== null) {
            $dataToSave['pendidikan_terakhir'] = $normalizedRow['pendidikan_terakhir'];
        }

        // Fallback for nama
        if (empty($dataToSave['nama'])) {
            foreach($normalizedRow as $k => $v) {
                if (str_contains($k, 'nama') || $k === 'guru' || $k === 'karyawan') {
                    $dataToSave['nama'] = $v;
                    break;
                }
            }
        }

        if (empty($dataToSave['nama'])) {
            if (empty(array_filter($normalizedRow))) return []; // skip empty
            $dataToSave['nama'] = "Guru Baru (Tanpa Nama)";
        }

        // Apply normalizations via NormalizationService
        $dataToSave['nama'] = $this->normalizationService->normalizeTeacherName($dataToSave['nama']);
        if (isset($dataToSave['unit_kerja'])) {
            $dataToSave['unit_kerja'] = $this->normalizationService->normalizeSchoolName($dataToSave['unit_kerja']);
        }
        if (isset($dataToSave['tempat_lahir'])) {
            $dataToSave['tempat_lahir'] = $this->normalizationService->normalizePlaceOfBirth($dataToSave['tempat_lahir']);
        }
        if (isset($dataToSave['status'])) {
            $tmtForStatus = isset($dataToSave['tmt']) ? \Carbon\Carbon::parse($dataToSave['tmt']) : null;
            $teacherNameForStatus = $dataToSave['nama'] ?? null;
            $dataToSave['status'] = $this->normalizationService->normalizeEmploymentStatus($dataToSave['status'], $tmtForStatus, $teacherNameForStatus);
        }

        $savePayload = array_merge(array_filter($dataToSave, fn($v) => $v !== null && $v !== ''), ['school_id' => $schoolId]);

        if (empty($savePayload['unit_kerja']) && !empty($normalizedRow['unit_kerja'])) {
            $savePayload['unit_kerja'] = $normalizedRow['unit_kerja'];
        }
        if (empty($savePayload['unit_kerja']) && $schoolId) {
            $fallbackSchool = School::find($schoolId);
            if ($fallbackSchool) {
                $savePayload['unit_kerja'] = $fallbackSchool->nama;
            }
        }

        return $savePayload;
    }

    /**
     * POST /api/teachers/import/preview
     */
    public function importPreview(Request $request): JsonResponse
    {
        $request->validate(['teachers' => 'required|array']);

        $dateErrors = $this->strictDateValidationService->validateRows($request->teachers);
        if (!empty($dateErrors)) {
            return response()->json([
                'success'     => false,
                'message'     => $this->strictDateValidationService->formatErrorMessage($dateErrors),
                'errors'      => $dateErrors,
                'date_errors' => $dateErrors,
            ], 422);
        }
        
        $previews = [];
        $indexCounter = 0;

        foreach ($request->teachers as $index => $row) {
            try {
                $parsedData = $this->parseImportRow($row, $request);
                if (empty($parsedData)) continue;

                $nim = $parsedData['nomor_induk_maarif'] ?? null;
                $namaFile = $parsedData['nama'] ?? '';
                $unitFile = $parsedData['unit_kerja'] ?? '';
                
                // Fetch matches from DB if NIM exists
                $dbMatches = [];
                if ($nim) {
                    $dbMatches = Teacher::withoutTenantScope()
                        ->where('nomor_induk_maarif', $nim)
                        ->get()
                        ->toArray();
                }

                if (!empty($dbMatches)) {
                    $matchResult = $this->matchingService->determineStatus($dbMatches, $parsedData);
                } else {
                    // NIM not found. Try to find an existing teacher without NIM.
                    $nameMatchQuery = Teacher::withoutTenantScope()->whereNull('nomor_induk_maarif');
                    if (!empty($parsedData['school_id'])) {
                         $nameMatchQuery->where('school_id', $parsedData['school_id']);
                    } else {
                         // Broad match on the first 4 characters of the name to reduce DB load
                         $prefix = substr($namaFile, 0, 4);
                         if (strlen($prefix) >= 3) {
                             $nameMatchQuery->whereRaw('LOWER(nama) LIKE ?', [strtolower($prefix).'%']);
                         }
                    }
                    $potentialMatches = $nameMatchQuery->get()->toArray();
                    // Jangan mencocokkan dua guru berbeda bernama sama bila tanggal_lahir keduanya ada dan berbeda
                    if (!empty($parsedData['tanggal_lahir'])) {
                        $incomingDob = $parsedData['tanggal_lahir'];
                        $potentialMatches = array_values(array_filter(
                            $potentialMatches,
                            fn(array $candidate) => empty($candidate['tanggal_lahir']) || $candidate['tanggal_lahir'] === $incomingDob
                        ));
                    }
                    $matchResult = $this->matchingService->determineStatusByName($potentialMatches, $parsedData);
                }
                
                $dbNama = '';
                $dbUnit = '';
                if ($matchResult['target_id']) {
                    // Match could come from dbMatches or potentialMatches
                    $targetRow = collect($dbMatches)->firstWhere('id', $matchResult['target_id']);
                    if (!$targetRow && isset($potentialMatches)) {
                        $targetRow = collect($potentialMatches)->firstWhere('id', $matchResult['target_id']);
                    }

                    if ($targetRow) {
                        $dbNama = $targetRow['nama'];
                        $dbUnit = $targetRow['unit_kerja'];
                    }
                } else if (!empty($dbMatches) && $matchResult['status'] === 'TAKEOVER') {
                    // Just show the first one it's taking over from
                    $dbNama = $dbMatches[0]['nama'];
                    $dbUnit = $dbMatches[0]['unit_kerja'];
                } else if (!empty($dbMatches) && $matchResult['status'] === 'KONFLIK') {
                    $dbNama = $dbMatches[0]['nama'] . ' (Ganda)';
                    $dbUnit = $dbMatches[0]['unit_kerja'];
                }

                $signature = $this->strictDateValidationService->signNormalizedDates(
                    $parsedData,
                    $request->user()?->id,
                    $request->user()?->school_id
                );

                $previews[] = [
                    'id' => $indexCounter++,
                    'nim' => $nim,
                    'nama_file' => $namaFile,
                    'nama_db' => $dbNama,
                    'unit_file' => $unitFile,
                    'unit_db' => $dbUnit,
                    'status' => $matchResult['status'],
                    'action' => $matchResult['action'],
                    'message' => $matchResult['message'],
                    'target_id' => $matchResult['target_id'],
                    'payload' => $parsedData,
                    'preview_date_signature' => $signature,
                ];
            } catch (\RuntimeException $e) {
                // F-03: Fail-closed jika signing key tidak terkonfigurasi (jangan ditelan)
                \Illuminate\Support\Facades\Log::error('TeacherController::importPreview signing error', [
                    'user_id'   => $request->user()?->id,
                    'school_id' => $request->user()?->school_id,
                    'message'   => $e->getMessage(),
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'Konfigurasi keamanan import belum lengkap. Hubungi administrator.',
                ], 500);
            } catch (\Exception $e) {
                // Log and continue
                continue;
            }
        }

        return response()->json([
            'previews' => $previews
        ]);
    }

    /**
     * POST /api/teachers/import/commit
     */
    public function importCommit(Request $request): JsonResponse
    {
        $request->validate(['teachers' => 'required|array']);

        $user = $request->user();
        $isOperator = $user?->isOperator();
        $operatorSchoolId = (int) $user?->school_id;

        // Validasi ulang ketat di tahap commit:
        // - Payload ber-tanda-tangan preview yang utuh diverifikasi HMAC + validasi kalender ISO YYYY-MM-DD.
        // - Payload yang dimanipulasi pasca-preview atau tanpa provenance preview wajib melewati strict validation penuh.
        $commitValidation = $this->strictDateValidationService->validateCommitRows(
            $request->teachers,
            $user?->id,
            $user?->school_id
        );
        $dateErrors = $commitValidation['errors'];
        if (!empty($dateErrors)) {
            return response()->json([
                'success'     => false,
                'message'     => $this->strictDateValidationService->formatErrorMessage($dateErrors),
                'errors'      => $dateErrors,
                'date_errors' => $dateErrors,
            ], 422);
        }

        $normalizedByIndex = $commitValidation['normalized_by_index'];

        // F-02 / VA-01 / VA-02: Tentukan scope school_id + identitas global (NIM & NUPTK) secara deterministik & terurut (mencegah deadlock)
        $lockTargets = $this->resolveCommitLockTargets($request->teachers, (bool) $isOperator, $operatorSchoolId);

        try {
            return $this->withCommitLocks($lockTargets, function () use (
                $request,
                $isOperator,
                $operatorSchoolId,
                $normalizedByIndex,
                $lockTargets
            ): JsonResponse {
                $created = 0;
                $updated = 0;

                if (\DB::getDriverName() === 'sqlite' && config('database.connections.sqlite.database') !== ':memory:') {
                    \DB::statement('PRAGMA busy_timeout = 10000');
                }

                \DB::beginTransaction();
                try {
                    // F-02 / VA-02: PostgreSQL transaction-scoped advisory lock (otomatis dilepas saat COMMIT/ROLLBACK)
                    // Urutan akuisisi kanonik global: Tier 1 school_id -> Tier 2 NIM -> Tier 3 NUPTK (bebas deadlock).
                    if (\DB::getDriverName() === 'pgsql') {
                        $pgLockTimeoutSec = max(1, (int) config('app.import_commit_lock_block_seconds', 15));
                        \DB::statement("SET LOCAL lock_timeout = '{$pgLockTimeoutSec}s'");

                        foreach ($lockTargets['school_ids'] as $sid) {
                            $advisoryKey = 7100000000 + (int) $sid;
                            \DB::statement('SELECT pg_advisory_xact_lock(?)', [$advisoryKey]);
                        }
                        foreach ($lockTargets['nims'] as $nimKey) {
                            \DB::statement("SELECT pg_advisory_xact_lock(7101, hashtext('teacher_nim:' || CAST(? AS text)))", [$nimKey]);
                        }
                        foreach ($lockTargets['nuptks'] as $nuptkKey) {
                            \DB::statement("SELECT pg_advisory_xact_lock(7102, hashtext('teacher_nuptk:' || CAST(? AS text)))", [$nuptkKey]);
                        }
                    }

                    foreach ($request->teachers as $idx => $row) {
                        $payload = $row['payload'] ?? [];
                        $action = $row['action'] ?? 'INSERT';
                        $targetId = $row['target_id'] ?? null;

                        // Pastikan tanggal yang telah lolos re-validasi tersimpan dalam format internal standar YYYY-MM-DD
                        if (!empty($normalizedByIndex[$idx])) {
                            foreach ($normalizedByIndex[$idx] as $dateKey => $isoDate) {
                                $payload[$dateKey] = $isoDate;
                            }
                        }

                        if ($isOperator) {
                            // Operator must only insert for their own school
                            $payload['school_id'] = $operatorSchoolId;
                            // Never allow operator to self-verify or mark SK generated
                            unset($payload['is_verified'], $payload['is_sk_generated'], $payload['deleted_at']);
                        }

                        if ($action === 'INSERT' || ($action === 'MANUAL' && !$targetId)) {
                            // F-01: Resolusi identitas guru yang ketat (NIM utama, tanpa fallback nama saja, tolak konflik/ambigu)
                            $resolution = $this->resolveExistingTeacherForCommit($payload, (bool) $isOperator, $operatorSchoolId);

                            if ($resolution['status'] === 'forbidden') {
                                \DB::rollBack();
                                return response()->json([
                                    'success' => false,
                                    'message' => $resolution['message'],
                                ], 403);
                            }

                            if ($resolution['status'] === 'conflict') {
                                \DB::rollBack();
                                return response()->json([
                                    'success' => false,
                                    'message' => $resolution['message'],
                                ], 422);
                            }

                            if ($resolution['status'] === 'found' && $resolution['teacher'] instanceof Teacher) {
                                $existingTeacher = $resolution['teacher'];
                                $updatePayload = $payload;
                                if ($isOperator) {
                                    unset($updatePayload['school_id']);
                                }
                                // Jangan pernah menimpa NIM eksisting yang sudah terisi dengan NIM berbeda atau kosong
                                if (!empty($existingTeacher->nomor_induk_maarif)) {
                                    unset($updatePayload['nomor_induk_maarif']);
                                }
                                $existingTeacher->update($updatePayload);
                                $updated++;
                            } else {
                                Teacher::create($payload);
                                $created++;
                            }
                        } 
                        elseif ($action === 'UPDATE' || ($action === 'MANUAL' && $targetId)) {
                            $teacher = Teacher::withoutTenantScope()->find($targetId);
                            if ($teacher) {
                                // Tenant check: operator can only update teachers belonging to their school
                                if ($isOperator && (int) $teacher->school_id !== $operatorSchoolId) {
                                    \DB::rollBack();
                                    return response()->json([
                                        'success' => false,
                                        'message' => 'Akses ditolak: Anda tidak memiliki wewenang memperbarui data guru madrasah lain.'
                                    ], 403);
                                }

                                // F-01: Cegah penggantian NIM eksisting dengan NIM berbeda saat UPDATE
                                $incomingNim = isset($payload['nomor_induk_maarif']) ? trim((string) $payload['nomor_induk_maarif']) : '';
                                if ($incomingNim !== '' && !empty($teacher->nomor_induk_maarif) && $teacher->nomor_induk_maarif !== $incomingNim) {
                                    \DB::rollBack();
                                    return response()->json([
                                        'success' => false,
                                        'message' => "Konflik identitas: NIM guru eksisting ({$teacher->nomor_induk_maarif}) tidak boleh ditimpa menjadi {$incomingNim}."
                                    ], 422);
                                }

                                // VA-01: Cegah klaim NIM atau NUPTK milik guru/madrasah lain saat UPDATE
                                if ($incomingNim !== '' && $incomingNim !== (string) $teacher->nomor_induk_maarif) {
                                    if ($this->existsOtherTeacherWithIdentifier('nomor_induk_maarif', $incomingNim, (int) $teacher->id)) {
                                        \DB::rollBack();
                                        return response()->json([
                                            'success' => false,
                                            'message' => "Konflik identitas: NIM {$incomingNim} sudah terdaftar pada madrasah/guru lain dan tidak dapat ditimpa."
                                        ], 422);
                                    }
                                }

                                $incomingNuptk = isset($payload['nuptk']) ? trim((string) $payload['nuptk']) : '';
                                if ($incomingNuptk !== '' && $incomingNuptk !== (string) $teacher->nuptk) {
                                    if ($this->existsOtherTeacherWithIdentifier('nuptk', $incomingNuptk, (int) $teacher->id)) {
                                        \DB::rollBack();
                                        return response()->json([
                                            'success' => false,
                                            'message' => "Konflik identitas: NUPTK {$incomingNuptk} sudah terdaftar pada madrasah/guru lain."
                                        ], 422);
                                    }
                                }

                                // User instruction: For safe update, KEEP database name.
                                // So we remove 'nama' from payload so it doesn't overwrite.
                                if (isset($payload['nama'])) {
                                    unset($payload['nama']);
                                }
                                if ($isOperator) {
                                    unset($payload['school_id']); // Cannot transfer school via import
                                }
                                $teacher->update($payload);
                                $updated++;
                            }
                        }
                    }
                    \DB::commit();
                    
                    return response()->json([
                        'success' => true,
                        'summary' => "Berhasil: $created Ditambahkan, $updated Diperbarui."
                    ]);
                } catch (\Throwable $e) {
                    if (\DB::transactionLevel() > 0) {
                        \DB::rollBack();
                    }

                    // VA-03 / VA-02: Tangani timeout lock (Cache::lock atau PostgreSQL SQLSTATE 55P03) -> HTTP 409
                    if ($this->isLockTimeoutException($e)) {
                        \Illuminate\Support\Facades\Log::warning('TeacherController::importCommit lock timeout inside transaction', [
                            'user_id'   => $request->user()?->id,
                            'school_id' => $request->user()?->school_id,
                            'exception' => get_class($e),
                            'message'   => $e->getMessage(),
                        ]);

                        return response()->json([
                            'success' => false,
                            'message' => 'Sistem sedang memproses data untuk madrasah terkait. Silakan coba beberapa saat lagi.',
                            'code'    => 'LOCK_TIMEOUT',
                        ], 409);
                    }

                    // VA-01: Tangani UniqueConstraintViolationException (SQLSTATE 23505) secara bersih -> HTTP 422
                    if ($this->isUniqueConstraintViolation($e)) {
                        \Illuminate\Support\Facades\Log::warning('TeacherController::importCommit unique constraint conflict', [
                            'user_id'   => $request->user()?->id,
                            'school_id' => $request->user()?->school_id,
                            'exception' => get_class($e),
                            'message'   => $e->getMessage(),
                        ]);

                        return response()->json([
                            'success' => false,
                            'message' => 'Konflik identitas: NIM atau NUPTK sudah terdaftar pada madrasah lain dan tidak dapat diduplikasi.',
                        ], 422);
                    }

                    \Illuminate\Support\Facades\Log::error('TeacherController::importCommit failed', [
                        'user_id'   => $request->user()?->id,
                        'school_id' => $request->user()?->school_id,
                        'exception' => get_class($e),
                        'message'   => $e->getMessage(),
                        'file'      => $e->getFile(),
                        'line'      => $e->getLine(),
                    ]);

                    return response()->json([
                        'success' => false,
                        'message' => 'Terjadi kesalahan saat menyimpan data guru. Seluruh perubahan telah dibatalkan. Silakan coba lagi atau hubungi administrator.',
                    ], 500);
                } finally {
                    $this->disconnectGlobalIdentityLookupConnection();
                }
            });
        } catch (\Illuminate\Contracts\Cache\LockTimeoutException $e) {
            \Illuminate\Support\Facades\Log::warning('TeacherController::importCommit cache lock timeout', [
                'user_id'   => $request->user()?->id,
                'school_id' => $request->user()?->school_id,
                'schools'   => $lockTargets['school_ids'],
                'message'   => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Sistem sedang memproses data untuk madrasah terkait. Silakan coba beberapa saat lagi.',
                'code'    => 'LOCK_TIMEOUT',
            ], 409);
        }
    }

    /**
     * Kumpulkan daftar school_id serta identitas global (NIM & NUPTK) secara unik dan terurut kanonik (F-02 / VA-01 / VA-02).
     * Untuk non-operator pada aksi UPDATE/MANUAL tanpa payload.school_id, resolve school_id riil dari record guru target.
     *
     * @return array{school_ids: array<int, int>, nims: array<int, string>, nuptks: array<int, string>}
     */
    private function resolveCommitLockTargets(array $rows, bool $isOperator, int $operatorSchoolId): array
    {
        $schoolIds = [];
        $nims = [];
        $nuptks = [];

        if ($isOperator) {
            $schoolIds[$operatorSchoolId] = $operatorSchoolId;
        } else {
            // Kumpulkan target_id yang tidak memiliki payload.school_id agar dapat di-resolve dalam 1 query batch
            $targetIdsToResolve = [];
            foreach ($rows as $row) {
                $payload = is_array($row['payload'] ?? null) ? $row['payload'] : [];
                $hasPayloadSchool = isset($payload['school_id']) && is_numeric($payload['school_id']);
                $targetId = $row['target_id'] ?? null;
                if (!$hasPayloadSchool && is_numeric($targetId)) {
                    $targetIdsToResolve[(int) $targetId] = (int) $targetId;
                }
            }

            $targetSchoolMap = [];
            if (!empty($targetIdsToResolve)) {
                $targetSchoolMap = Teacher::withoutTenantScope()
                    ->whereIn('id', array_values($targetIdsToResolve))
                    ->pluck('school_id', 'id')
                    ->all();
            }

            foreach ($rows as $row) {
                $payload = is_array($row['payload'] ?? null) ? $row['payload'] : [];
                $targetId = $row['target_id'] ?? null;

                if (isset($payload['school_id']) && is_numeric($payload['school_id'])) {
                    $sid = (int) $payload['school_id'];
                } elseif (is_numeric($targetId) && array_key_exists((int) $targetId, $targetSchoolMap) && $targetSchoolMap[(int) $targetId] !== null) {
                    $sid = (int) $targetSchoolMap[(int) $targetId];
                } else {
                    $sid = 0;
                }
                $schoolIds[$sid] = $sid;
            }

            if (empty($schoolIds)) {
                $schoolIds[0] = 0;
            }
        }

        foreach ($rows as $row) {
            $payload = is_array($row['payload'] ?? null) ? $row['payload'] : [];
            $nim = isset($payload['nomor_induk_maarif']) ? trim((string) $payload['nomor_induk_maarif']) : '';
            if ($nim !== '') {
                $nims[$nim] = $nim;
            }
            $nuptk = isset($payload['nuptk']) ? trim((string) $payload['nuptk']) : '';
            if ($nuptk !== '') {
                $nuptks[$nuptk] = $nuptk;
            }
        }

        $sortedSchools = array_values($schoolIds);
        sort($sortedSchools, SORT_NUMERIC);

        $sortedNims = array_values($nims);
        sort($sortedNims, SORT_STRING);

        $sortedNuptks = array_values($nuptks);
        sort($sortedNuptks, SORT_STRING);

        return [
            'school_ids' => $sortedSchools,
            'nims'       => $sortedNims,
            'nuptks'     => $sortedNuptks,
        ];
    }

    /**
     * Backward-compatible wrapper untuk resolusi daftar school_id lock.
     *
     * @return array<int, int>
     */
    private function resolveCommitLockSchoolIds(array $rows, bool $isOperator, int $operatorSchoolId): array
    {
        return $this->resolveCommitLockTargets($rows, $isOperator, $operatorSchoolId)['school_ids'];
    }

    /**
     * Eksekusi callback commit di bawah proteksi lock berurutan kanonik (school_id -> NIM -> NUPTK)
     * dengan TTL >= PHP-FPM request_terminate_timeout (default 90s) dan pelepasan terjamin di finally (F-02 / VA-03).
     *
     * @param array{school_ids: array<int, int>, nims: array<int, string>, nuptks: array<int, string>} $lockTargets
     */
    private function withCommitLocks(array $lockTargets, callable $callback): mixed
    {
        $storeName = config('cache.default');
        // Pada file-backed SQLite dengan CACHE_STORE=array, gunakan file lock agar sinkron lintas proses
        if ($storeName === 'array' && \DB::getDriverName() === 'sqlite' && config('database.connections.sqlite.database') !== ':memory:') {
            $storeName = 'file';
        }

        $cacheRepo = \Illuminate\Support\Facades\Cache::store($storeName);
        $ttlSeconds = max(60, (int) config('app.import_commit_lock_ttl_seconds', 90));
        $blockSeconds = max(1, (int) config('app.import_commit_lock_block_seconds', 15));

        $lockKeys = [];
        foreach ($lockTargets['school_ids'] ?? [] as $sid) {
            $lockKeys[] = "teacher_import_commit:school:{$sid}";
        }
        foreach ($lockTargets['nims'] ?? [] as $nim) {
            $lockKeys[] = "teacher_import_commit:nim:{$nim}";
        }
        foreach ($lockTargets['nuptks'] ?? [] as $nuptk) {
            $lockKeys[] = "teacher_import_commit:nuptk:{$nuptk}";
        }

        $acquiredLocks = [];

        try {
            foreach ($lockKeys as $lockKey) {
                $lock = $cacheRepo->lock($lockKey, $ttlSeconds);
                $lock->block($blockSeconds);
                $acquiredLocks[] = $lock;
            }

            return $callback();
        } finally {
            foreach (array_reverse($acquiredLocks) as $lock) {
                try {
                    $lock->release();
                } catch (\Throwable) {
                    // Best-effort release
                }
            }
        }
    }

    /**
     * Deteksi apakah exception merupakan pelanggaran unique constraint DB (PostgreSQL SQLSTATE 23505 / Laravel UniqueConstraintViolationException).
     */
    private function isUniqueConstraintViolation(\Throwable $e): bool
    {
        if ($e instanceof \Illuminate\Database\UniqueConstraintViolationException) {
            return true;
        }

        $current = $e;
        while ($current !== null) {
            $code = (string) $current->getCode();
            if ($code === '23505') {
                return true;
            }
            if ($current instanceof \PDOException && is_array($current->errorInfo ?? null) && ($current->errorInfo[0] ?? null) === '23505') {
                return true;
            }
            if ($current instanceof \Illuminate\Database\QueryException && is_array($current->errorInfo ?? null) && ($current->errorInfo[0] ?? null) === '23505') {
                return true;
            }
            $current = $current->getPrevious();
        }

        return false;
    }

    /**
     * Deteksi apakah exception merupakan kegagalan memperoleh lock (Cache LockTimeoutException atau PostgreSQL SQLSTATE 55P03).
     */
    private function isLockTimeoutException(\Throwable $e): bool
    {
        $current = $e;
        while ($current !== null) {
            if ($current instanceof \Illuminate\Contracts\Cache\LockTimeoutException) {
                return true;
            }
            $code = (string) $current->getCode();
            if ($code === '55P03') {
                return true;
            }
            if (($current instanceof \PDOException || $current instanceof \Illuminate\Database\QueryException)
                && is_array($current->errorInfo ?? null)
                && ($current->errorInfo[0] ?? null) === '55P03'
            ) {
                return true;
            }
            $current = $current->getPrevious();
        }

        return false;
    }

    /**
     * Cek keberadaan NIM atau NUPTK aktif pada guru lain (termasuk lintas madrasah) secara aman meskipun
     * koneksi PostgreSQL utama menggunakan role non-superuser dengan RLS aktif (VA-01).
     * Hanya mengembalikan boolean (tidak pernah mengekspos data/PII madrasah lain).
     */
    private function existsOtherTeacherWithIdentifier(string $column, string $value, ?int $excludeTeacherId = null): bool
    {
        if (!in_array($column, ['nomor_induk_maarif', 'nuptk'], true)) {
            return false;
        }

        // 1. Cek pada koneksi transaksional utama (menangkap baris uncommitted dalam batch yang sama)
        $mainQuery = Teacher::withoutTenantScope()->where($column, $value);
        if ($excludeTeacherId !== null) {
            $mainQuery->where('id', '!=', $excludeTeacherId);
        }
        if ($mainQuery->exists()) {
            return true;
        }

        // 2. Pada PostgreSQL dengan role non-superuser, sesi utama sudah mengeksekusi SET app.current_school_id
        //    sehingga RLS menyembunyikan baris madrasah lain. Gunakan koneksi read-only bersih (tanpa SET app.current_school_id,
        //    sehingga current_setting('app.current_school_id', true) IS NULL) khusus untuk pengecekan eksistensi boolean.
        if (\DB::getDriverName() === 'pgsql') {
            $lookupConn = $this->getGlobalIdentityLookupConnection();
            $lookupQuery = $lookupConn->table('teachers')
                ->where($column, $value)
                ->whereNull('deleted_at');
            if ($excludeTeacherId !== null) {
                $lookupQuery->where('id', '!=', $excludeTeacherId);
            }
            return $lookupQuery->exists();
        }

        return false;
    }

    /**
     * Dapatkan koneksi PostgreSQL bersih tanpa session variable app.current_school_id
     * khusus untuk pengecekan eksistensi konflik identitas global (read-only boolean).
     */
    private function getGlobalIdentityLookupConnection(): \Illuminate\Database\ConnectionInterface
    {
        $connName = 'pgsql_global_identity_lookup';
        if (!config()->has("database.connections.{$connName}")) {
            $baseConfig = config('database.connections.pgsql');
            $baseConfig['options'] = array_merge($baseConfig['options'] ?? [], [
                \PDO::ATTR_PERSISTENT => false,
            ]);
            config(["database.connections.{$connName}" => $baseConfig]);
        }

        return \DB::connection($connName);
    }

    /**
     * Tutup koneksi lookup identitas global bila sempat dibuka agar tidak menyisakan koneksi idle.
     */
    private function disconnectGlobalIdentityLookupConnection(): void
    {
        $connName = 'pgsql_global_identity_lookup';
        if (config()->has("database.connections.{$connName}")) {
            try {
                \DB::purge($connName);
            } catch (\Throwable) {
                // Best-effort cleanup
            }
        }
    }

    /**
     * Resolusi identitas guru secara ketat pada tahap commit (F-01):
     * 1. NIM (nomor_induk_maarif) adalah identitas pencocokan utama bila tersedia.
     *    - Bila NIM ada di madrasah lain -> conflict (422), tidak pernah menyentuh tenant lain.
     *    - Bila NIM tidak ditemukan di DB -> TIDAK fallback ke nama (mencegah NIM hijacking).
     * 2. NUPTK / NIP sebagai identifier kuat sekunder (dalam sekolah yang sama, dengan proteksi NIM).
     * 3. Tanpa identifier kuat: nama saja BUKAN identitas unik.
     *    - Wajib dilengkapi tanggal_lahir yang cocok persis (1 kandidat) untuk dianggap identik.
     *    - Bila ada guru bernama sama di sekolah sama tanpa tanggal_lahir pembeda (atau >1 kandidat) -> conflict (422).
     *
     * @return array{status: 'found'|'not_found'|'conflict'|'forbidden', teacher: ?Teacher, message: ?string}
     */
    private function resolveExistingTeacherForCommit(array $payload, bool $isOperator, int $operatorSchoolId): array
    {
        $schoolId = isset($payload['school_id']) && $payload['school_id'] !== '' ? (int) $payload['school_id'] : null;
        $nim   = isset($payload['nomor_induk_maarif']) && trim((string) $payload['nomor_induk_maarif']) !== '' ? trim((string) $payload['nomor_induk_maarif']) : null;
        $nuptk = isset($payload['nuptk']) && trim((string) $payload['nuptk']) !== '' ? trim((string) $payload['nuptk']) : null;
        $nip   = isset($payload['nip']) && trim((string) $payload['nip']) !== '' ? trim((string) $payload['nip']) : null;
        $nama  = isset($payload['nama']) && trim((string) $payload['nama']) !== '' ? trim((string) $payload['nama']) : null;
        $dob   = isset($payload['tanggal_lahir']) && trim((string) $payload['tanggal_lahir']) !== '' ? trim((string) $payload['tanggal_lahir']) : null;

        // 1. Pencocokan utama berdasarkan NIM (nomor_induk_maarif)
        if ($nim !== null) {
            $sameSchoolQuery = Teacher::withoutTenantScope()->where('nomor_induk_maarif', $nim);
            if ($schoolId !== null) {
                $sameSchoolQuery->where('school_id', $schoolId);
            } else {
                $sameSchoolQuery->whereNull('school_id');
            }
            if ($found = $sameSchoolQuery->first()) {
                return ['status' => 'found', 'teacher' => $found, 'message' => null];
            }

            // Cek konflik NIM pada madrasah/tenant lain (andal bahkan di bawah PostgreSQL RLS non-superuser; tidak pernah menyentuh tenant lain)
            if ($this->existsOtherTeacherWithIdentifier('nomor_induk_maarif', $nim)) {
                return [
                    'status'  => 'conflict',
                    'teacher' => null,
                    'message' => "Konflik identitas: NIM {$nim} sudah terdaftar pada madrasah lain dan tidak dapat ditimpa.",
                ];
            }

            // NIM baru tidak ada di DB -> guru baru yang berbeda; JANGAN fallback ke pencocokan nama
            return ['status' => 'not_found', 'teacher' => null, 'message' => null];
        }

        // 2. Pencocokan identifier kuat sekunder: NUPTK (dalam batas sekolah/tenant yang sama)
        if ($nuptk !== null) {
            $q = Teacher::withoutTenantScope()->where('nuptk', $nuptk);
            if ($schoolId !== null) {
                $q->where('school_id', $schoolId);
            } else {
                $q->whereNull('school_id');
            }
            if ($found = $q->first()) {
                if ($isOperator && (int) $found->school_id !== $operatorSchoolId) {
                    return [
                        'status'  => 'forbidden',
                        'teacher' => null,
                        'message' => 'Akses ditolak: Anda tidak memiliki wewenang memperbarui data guru madrasah lain.',
                    ];
                }
                return ['status' => 'found', 'teacher' => $found, 'message' => null];
            }

            if ($this->existsOtherTeacherWithIdentifier('nuptk', $nuptk)) {
                return [
                    'status'  => 'conflict',
                    'teacher' => null,
                    'message' => "Konflik identitas: NUPTK {$nuptk} sudah terdaftar pada madrasah lain.",
                ];
            }

            return ['status' => 'not_found', 'teacher' => null, 'message' => null];
        }

        // 3. Pencocokan identifier kuat sekunder: NIP (dalam batas sekolah/tenant yang sama)
        if ($nip !== null) {
            $q = Teacher::withoutTenantScope()->where('nip', $nip);
            if ($schoolId !== null) {
                $q->where('school_id', $schoolId);
            } else {
                $q->whereNull('school_id');
            }
            if ($found = $q->first()) {
                if ($isOperator && (int) $found->school_id !== $operatorSchoolId) {
                    return [
                        'status'  => 'forbidden',
                        'teacher' => null,
                        'message' => 'Akses ditolak: Anda tidak memiliki wewenang memperbarui data guru madrasah lain.',
                    ];
                }
                return ['status' => 'found', 'teacher' => $found, 'message' => null];
            }

            return ['status' => 'not_found', 'teacher' => null, 'message' => null];
        }

        // 4. Tanpa NIM/NUPTK/NIP: NAMA SAJA BUKAN IDENTITAS UNIK.
        //    Gunakan tanggal_lahir sebagai atribut pembeda/pendukung wajib bila nama sudah ada di sekolah yang sama.
        if ($nama !== null && $schoolId !== null) {
            $sameNameCandidates = Teacher::withoutTenantScope()
                ->where('school_id', $schoolId)
                ->whereRaw('LOWER(nama) = LOWER(?)', [$nama])
                ->get();

            if ($sameNameCandidates->isEmpty()) {
                return ['status' => 'not_found', 'teacher' => null, 'message' => null];
            }

            if ($dob === null) {
                return [
                    'status'  => 'conflict',
                    'teacher' => null,
                    'message' => "Identitas guru '{$nama}' ambigu: sudah terdapat guru dengan nama sama di madrasah ini tanpa NIM/NUPTK/NIP atau Tanggal Lahir pembeda. Lengkapi NIM atau Tanggal Lahir terlebih dahulu.",
                ];
            }

            $exactDobMatches = $sameNameCandidates->filter(fn(Teacher $t) => $t->tanggal_lahir === $dob);
            if ($exactDobMatches->count() === 1) {
                return ['status' => 'found', 'teacher' => $exactDobMatches->first(), 'message' => null];
            }
            if ($exactDobMatches->count() > 1) {
                return [
                    'status'  => 'conflict',
                    'teacher' => null,
                    'message' => "Identitas guru '{$nama}' ambigu: ditemukan lebih dari satu guru dengan nama dan tanggal lahir sama di madrasah ini. Gunakan NIM untuk membedakan.",
                ];
            }

            // Tidak ada kandidat dengan DOB yang sama: pastikan tidak ada kandidat eksisting yang DOB-nya kosong (tidak dapat dipastikan berbeda)
            $hasMissingDobCandidate = $sameNameCandidates->contains(fn(Teacher $t) => empty($t->tanggal_lahir));
            if ($hasMissingDobCandidate) {
                return [
                    'status'  => 'conflict',
                    'teacher' => null,
                    'message' => "Identitas guru '{$nama}' ambigu: terdapat guru eksisting bernama sama tanpa Tanggal Lahir di madrasah ini. Lengkapi NIM untuk menghindari bentrok data.",
                ];
            }

            // Seluruh kandidat bernama sama memiliki tanggal_lahir berbeda secara pasti -> guru berbeda (aman INSERT)
            return ['status' => 'not_found', 'teacher' => null, 'message' => null];
        }

        return ['status' => 'not_found', 'teacher' => null, 'message' => null];
    }

    /**
     * Backward-compatible wrapper untuk pencarian guru eksisting pada commit.
     */
    private function findExistingTeacherForCommit(array $payload): ?Teacher
    {
        $res = $this->resolveExistingTeacherForCommit($payload, false, 0);
        return $res['status'] === 'found' ? $res['teacher'] : null;
    }
}

