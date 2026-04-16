<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Teacher\StoreTeacherRequest;
use App\Http\Requests\Teacher\UpdateTeacherRequest;
use App\Models\ActivityLog;
use App\Models\School;
use App\Models\Teacher;
use App\Services\NormalizationService;
use App\Services\TeacherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeacherController extends Controller
{
    public function __construct(
        private TeacherService $teacherService,
        private NormalizationService $normalizationService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Teacher::with('school');

        if ($request->search) {
            $query->whereRaw('LOWER(nama) LIKE LOWER(?)', ["%{$request->search}%"]);
        }
        if ($request->kecamatan) {
            $query->where('kecamatan', $request->kecamatan);
        }
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }
        if ($request->has('is_verified')) {
            $query->where('is_verified', $request->boolean('is_verified'));
        }

        // --- Tenant Isolation ---
        $user = $request->user();
        if ($user->role === 'operator' && $user->school_id) {
            $query->where('school_id', $user->school_id);
        } elseif ($request->school_id) {
            $query->where('school_id', $request->school_id);
        }

        $teachers = $query->orderByDesc('updated_at')
            ->paginate($request->integer('per_page', 25));

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

        // Normalize unit_kerja if present
        $originalUnitKerja = $data['unit_kerja'] ?? null;
        if (isset($data['unit_kerja'])) {
            $data['unit_kerja'] = $this->normalizationService->normalizeSchoolName($data['unit_kerja']);
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

        $this->teacherService->updateTeacher($teacher, $data);
        
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

    public function destroy(Teacher $teacher): JsonResponse
    {
        $this->authorize('delete', $teacher);
        $teacher->delete();
        return $this->successResponse(null, 'Guru berhasil dihapus.');
    }

    /**
     * POST /api/teachers/import — Bulk import from JSON array
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate(['teachers' => 'required|array']);

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
                $normalizedRow['nomor_induk_maarif'] = $nim ? trim((string)$nim) : null;

                // Parse NUPTK
                $nuptk = null;
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'nuptk') || str_contains($k, 'n_u_p_t_k') || str_contains($k, 'pegawai')) {
                        $nuptk = $v;
                        break;
                    }
                }
                $nuptk = $nuptk ? trim((string)$nuptk) : null;
                $normalizedRow['nuptk'] = $nuptk;

                // Parse NIP (Pegawai/NIY)
                $nip = null;
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'nip') || str_contains($k, 'niy') || str_contains($k, 'pegawai') || (str_contains($k, 'n_i_y'))) {
                        $nip = $v;
                        break;
                    }
                }
                $normalizedRow['nip'] = $nip ? trim((string)$nip) : null;

                // Parse Satminkal (unit_kerja)
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'satminkal') || str_contains($k, 'unit_kerja')) {
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
                        $normalizedRow['phone_number'] = $v;
                        break;
                    }
                }

                $schoolId = $normalizedRow['school_id'] ?? null;
                // Force user's school if operator
                if ($request->user()->role === 'operator') {
                    $schoolId = $request->user()->school_id;
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
                if ($sertifikasi !== null) {
                    $val = strtolower(trim((string)$sertifikasi));
                    $normalizedRow['is_certified'] = in_array($val, ['sudah', 'ya', '1', 'true', 'yes', 'v']);
                } else {
                    $normalizedRow['is_certified'] = false;
                }

                // Parse Tanggal Lahir (Mencegah Error 500 PostgreSQL dari Excel Serial Date)
                $tglLahirRaw = $normalizedRow['tanggal_lahir'] ?? $normalizedRow['tgl_lahir'] ?? null;
                if ($tglLahirRaw !== null && (string)$tglLahirRaw !== '') {
                    $tglStr = trim((string)$tglLahirRaw);
                    if (is_numeric($tglStr)) {
                        try {
                            $normalizedRow['tanggal_lahir'] = \Carbon\Carbon::createFromDate(1899, 12, 30)->addDays((int)$tglStr)->format('Y-m-d');
                        } catch (\Exception $e) { $normalizedRow['tanggal_lahir'] = null; }
                    } else {
                        // Jika string, coba diparse biasa, atau biarkan null
                        try {
                            $normalizedRow['tanggal_lahir'] = \Carbon\Carbon::parse($tglStr)->format('Y-m-d');
                        } catch (\Exception $e) { $normalizedRow['tanggal_lahir'] = null; }
                    }
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
                if ($pdpkpnuRaw !== null) {
                    $val2 = strtolower(trim((string)$pdpkpnuRaw));
                    $normalizedRow['pdpkpnu'] = in_array($val2, ['sudah', 'ya', '1', 'true', 'yes', 'v']) ? 'Sudah' : 'Belum';
                }

                // Parse TMT Date (Excel Serial OR String)
                $tmtRaw = null;
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'tmt') || str_contains($k, 'mulai_tugas') || str_contains($k, 'tanggal_tugas') || str_contains($k, 'penugasan')) {
                        $tmtRaw = $v;
                        break;
                    }
                }
                $tmtDate = null;
                if ($tmtRaw !== null && (string)$tmtRaw !== '') {
                    $tmtStr = trim((string)$tmtRaw);
                    if (is_numeric($tmtStr)) {
                        $tmtDate = \Carbon\Carbon::createFromDate(1899, 12, 30)->addDays((int)$tmtStr);
                    } else {
                        // Terjemahkan nama bulan Indonesia ke Inggris untuk Carbon
                        $indoMonths = [
                            'januari' => 'january', 'februari' => 'february', 'maret' => 'march',
                            'april' => 'april', 'mei' => 'may', 'juni' => 'june', 'juli' => 'july',
                            'agustus' => 'august', 'september' => 'september', 'oktober' => 'october',
                            'november' => 'november', 'desember' => 'december',
                            // Singkatan
                            'jan' => 'jan', 'feb' => 'feb', 'mar' => 'mar', 'apr' => 'apr',
                            'jun' => 'jun', 'jul' => 'jul', 'agu' => 'aug', 'sep' => 'sep', 'okt' => 'oct',
                            'nov' => 'nov', 'des' => 'dec'
                        ];
                        $translatedTmt = str_ireplace(array_keys($indoMonths), array_values($indoMonths), $tmtStr);

                        // Coba beberapa format tanggal populer di Indonesia / Excel
                        $formats = ['d/m/Y', 'Y-m-d', 'd-m-Y', 'Y/m/d', 'm/d/Y', 'd F Y', 'd M Y', 'd-M-Y', 'd/M/Y'];
                        foreach ($formats as $format) {
                            try {
                                $tmtDate = \Carbon\Carbon::createFromFormat($format, $translatedTmt);
                                if ($tmtDate !== false) break;
                            } catch (\Exception $e) { $tmtDate = null; }
                        }
                        // Fallback terakhir jika semua format gagal
                        if (!$tmtDate) {
                            try { $tmtDate = \Carbon\Carbon::parse($translatedTmt); } catch (\Exception $e) { $tmtDate = null; }
                        }
                    }
                    if ($tmtDate) {
                        $normalizedRow['tmt'] = $tmtDate->format('Y-m-d');
                    }
                }

                // Kalkulasi Status berdasarkan Pendidikan Terakhir, TMT Lama Pengabdian, dan Sertifikasi
                $pendidikan = null;
                foreach($normalizedRow as $k => $v) {
                    if (str_contains($k, 'pendidikan') || str_contains($k, 'ijazah') || str_contains($k, 'jenjang')) {
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
                    } else if ($tmtDate) {
                        // Jika sarjana -> Cek TMT >= 2 Tahun
                        $diffYears = $tmtDate->diffInYears(\Carbon\Carbon::now());
                        $normalizedRow['status'] = ($diffYears >= 2) ? 'GTY' : 'GTT';
                    } else {
                        // Jika sarjana tapi TMT kosong, pastikan Status tidak boleh "Honorer"
                        $currentStatus = $normalizedRow['status'] ?? null;
                        if (!$currentStatus || strtolower((string)$currentStatus) === 'honorer') {
                            $normalizedRow['status'] = 'GTY'; // Fallback default
                        }
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
                    $dataToSave['nama'] = $normalizedRow['nama_guru'] 
                        ?? $normalizedRow['nama_lengkap'] 
                        ?? $normalizedRow['nama_asli'] 
                        ?? $normalizedRow['guru']
                        ?? null;
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

                $savePayload = array_merge(array_filter($dataToSave, fn($v) => $v !== null && $v !== ''), ['school_id' => $schoolId]);
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
     * POST /api/teachers/{teacher}/generate-nim
     * Generate NIM (Nomor Induk Ma'arif) for a teacher without one.
     * Format: 1134{5-digit-sequence} — prefix 1134 is fixed (Cilacap code)
     */
    public function generateNim(Teacher $teacher): JsonResponse
    {
        if ($teacher->nomor_induk_maarif) {
            return $this->errorResponse('Guru ini sudah memiliki NIM: ' . $teacher->nomor_induk_maarif, [], 422);
        }

        // Find the highest existing NIM with prefix 1134
        $lastNim = Teacher::withoutTenantScope()
            ->where('nomor_induk_maarif', 'like', '1134%')
            ->whereRaw("LENGTH(nomor_induk_maarif) = 9")
            ->orderByRaw("CAST(nomor_induk_maarif AS BIGINT) DESC")
            ->value('nomor_induk_maarif');

        if ($lastNim) {
            $lastSeq = (int) substr($lastNim, 4); // last 5 digits
            $newSeq  = $lastSeq + 1;
        } else {
            $newSeq = 1; // start from 00001
        }

        $nim = '1134' . str_pad($newSeq, 5, '0', STR_PAD_LEFT);

        // Ensure uniqueness
        while (Teacher::withoutTenantScope()->where('nomor_induk_maarif', $nim)->exists()) {
            $newSeq++;
            $nim = '1134' . str_pad($newSeq, 5, '0', STR_PAD_LEFT);
        }

        $teacher->update(['nomor_induk_maarif' => $nim]);

        ActivityLog::log(
            description: "Generate NIM untuk guru: {$teacher->nama} → {$nim}",
            event: 'generate_nim',
            logName: 'master',
            subject: $teacher,
            causer: auth()->user(),
            schoolId: $teacher->school_id
        );

        return $this->successResponse(['nim' => $nim, 'teacher_id' => $teacher->id], "NIM berhasil digenerate: {$nim}");
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
     * Generate user accounts for teachers who don't have one.
     * Username: email (from NUPTK@maarif.nu if no email), Password: tanggal_lahir (ddmmyyyy).
     */
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
}

