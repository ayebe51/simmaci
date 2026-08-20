<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Student\StoreStudentRequest;
use App\Http\Requests\Student\UpdateStudentRequest;
use App\Models\Student;
use App\Services\StudentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    public function __construct(private StudentService $studentService) {}
    public function index(Request $request): JsonResponse
    {
        $query = Student::with('school');

        if ($request->search) {
            $query->where('nama', 'ilike', "%{$request->search}%");
        }
        if ($request->status && $request->status !== 'all') {
            if ($request->status === 'Lulus') {
                $query->withTrashed()->where('status', 'Lulus');
            } else {
                $query->byStatus($request->status);
            }
        }
        if ($request->kelas) {
            $query->where('kelas', $request->kelas);
        }

        // --- Tenant Isolation ---
        // Operators CANNOT override their school_id via request parameter.
        $user = $request->user();
        if (! in_array($user->role, ['super_admin', 'admin_yayasan'], true)) {
            if ($user->school_id) {
                $query->where('school_id', $user->school_id);
            }
        } elseif ($request->school_id) {
            $query->where('school_id', $request->school_id);
        }

        $students = $query->orderByDesc('updated_at')->paginate($request->integer('per_page', 25));

        // Sanitize output to prevent UTF-8 errors
        $students->getCollection()->transform(function ($student) {
            foreach ($student->getAttributes() as $key => $value) {
                if (is_string($value)) {
                    $student->$key = htmlspecialchars_decode(htmlspecialchars($value, ENT_SUBSTITUTE, 'UTF-8'));
                }
            }
            return $student;
        });

        return response()->json($students);
    }

    public function show(Student $student): JsonResponse
    {
        $this->authorize('view', $student);
        return $this->successResponse($student->load('school'));
    }

    public function store(StoreStudentRequest $request): JsonResponse
    {
        $data = $request->validated();

        return $this->successResponse($this->studentService->createStudent($data), 'Siswa berhasil ditambahkan.', 201);
    }

    public function update(UpdateStudentRequest $request, Student $student): JsonResponse
    {
        $this->authorize('update', $student);
        $this->studentService->updateStudent($student, $request->validated());

        return $this->successResponse($student->fresh(), 'Siswa berhasil diperbarui.');
    }

    public function destroy(Student $student): JsonResponse
    {
        $this->authorize('delete', $student);
        $student->delete();
        return $this->successResponse(null, 'Siswa berhasil dihapus.');
    }

    /**
     * POST /api/students/import — Bulk import from JSON array (EMIS)
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate(['students' => 'required|array']);

        $schoolId = auth()->user()->school_id;
        
        // If the user is Super Admin (no specific school), they cannot import without specifying it 
        // Or if we must import globally, this logic sets schoolId to null which might be acceptable if nullable
        if (!$schoolId && auth()->user()->role !== 'operator') {
            // Optional: You could extract school_id from payload if needed for Super Admins
        }

        $created = 0;
        $errors = [];

        $allowedFields = [
            'nisn', 'nik', 'nama', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir',
            'nama_ayah', 'nama_ibu', 'alamat', 'nama_sekolah', 'npsn',
            'school_id', 'kelas', 'status', 'is_verified', 'nomor_telepon', 'nama_wali'
        ];

        foreach ($request->students as $index => $row) {
            try {
                // Normalize keys: trim, lowercase, replace non-alphanumeric with underscore
                $normalizedRow = [];
                foreach ($row as $key => $value) {
                    $cleanKey = preg_replace('/[^a-z0-9]/', '_', trim(strtolower($key)));
                    $cleanKey = preg_replace('/_+/', '_', $cleanKey);
                    $cleanKey = trim($cleanKey, '_');
                    $normalizedRow[$cleanKey] = $value;
                }

                // Intelligent Fuzzy Header Matching
                $dataToSave = [];
                foreach ($normalizedRow as $key => $value) {
                    if (is_null($value) || $value === '') continue; // Skip strictly null/empty cells
                    
                    // Try to catch common aliases found in typical EMIS/Dapodik/Custom sheets
                    if (str_contains($key, 'nisn') || str_contains($key, 'n_i_s_n') || str_contains($key, 'induk_siswa_nasional')) {
                        $dataToSave['nisn'] = ltrim(trim((string)$value), "'");
                    } elseif (str_contains($key, 'nik') || str_contains($key, 'n_i_k') || str_contains($key, 'induk_kependudukan')) {
                        $dataToSave['nik'] = ltrim(trim((string)$value), "'");
                    } elseif ((str_contains($key, 'nama') || $key === 'siswa' || $key === 'santri') && !str_contains($key, 'sekolah') && !str_contains($key, 'ayah') && !str_contains($key, 'ibu') && !str_contains($key, 'wali') && !str_contains($key, 'panggilan')) {
                        $dataToSave['nama'] = $value;
                    } elseif (str_contains($key, 'rombel') || str_contains($key, 'kelas') || str_contains($key, 'tingkat')) {
                        $dataToSave['kelas'] = $value;
                    } elseif (str_contains($key, 'status') || str_contains($key, 'aktif')) {
                        // Normalize status to Aktif/Lulus/Keluar
                        $valLower = strtolower(trim((string)$value));
                        if (str_contains($valLower, 'aktif') || str_contains($valLower, 'ya') || $valLower === '1') {
                            $dataToSave['status'] = 'Aktif';
                        } elseif (str_contains($valLower, 'lulus')) {
                            $dataToSave['status'] = 'Lulus';
                        } elseif (str_contains($valLower, 'keluar') || str_contains($valLower, 'pindah') || str_contains($valLower, 'mutasi')) {
                            $dataToSave['status'] = 'Keluar';
                        } else {
                            $dataToSave['status'] = 'Aktif'; // Default fallback for unknown status
                        }
                    } elseif (str_contains($key, 'jk') || str_contains($key, 'kelamin') || str_contains($key, 'gender') || str_contains($key, 'l_p') || $key === 'lp' || $key === 'sex') {
                        $valLower = strtolower(trim((string)$value));
                        if (str_contains($valLower, 'laki') || $valLower === 'l' || $valLower === '1' || str_contains($valLower, 'cowok') || $valLower === 'm') {
                            $dataToSave['jenis_kelamin'] = 'L';
                        } elseif (str_contains($valLower, 'perempuan') || str_contains($valLower, 'wanita') || $valLower === 'p' || $valLower === '2' || str_contains($valLower, 'cewek') || $valLower === 'f') {
                            $dataToSave['jenis_kelamin'] = 'P';
                        }
                    } elseif (str_contains($key, 'ayah') || str_contains($key, 'bapak') || str_contains($key, 'ortu_laki')) {
                        $dataToSave['nama_ayah'] = $value;
                    } elseif (str_contains($key, 'ibu') || str_contains($key, 'bunda') || str_contains($key, 'mama') || str_contains($key, 'ortu_perempuan')) {
                        $dataToSave['nama_ibu'] = $value;
                    } elseif (str_contains($key, 'wali')) {
                        $dataToSave['nama_wali'] = $value;
                    } elseif (str_contains($key, 'hp') || str_contains($key, 'telepon') || str_contains($key, 'ponsel') || str_contains($key, 'kontak') || str_contains($key, 'telp') || str_contains($key, 'wa_')) {
                        $dataToSave['nomor_telepon'] = ltrim(trim((string)$value), "'");
                    } elseif (str_contains($key, 'alamat') || str_contains($key, 'jalan') || str_contains($key, 'domisili')) {
                        $dataToSave['alamat'] = $value;
                    } elseif (str_contains($key, 'sekolah') || str_contains($key, 'lembaga') || str_contains($key, 'asal') || str_contains($key, 'instansi')) {
                        $dataToSave['nama_sekolah'] = $value;
                    } elseif (str_contains($key, 'npsn') || str_contains($key, 'n_p_s_n') || str_contains($key, 'pokok_sekolah')) {
                        $dataToSave['npsn'] = $value;
                    } elseif ((str_contains($key, 'tempat') || str_contains($key, 'tmp') || str_contains($key, 'kota') || str_contains($key, 'kab')) && (str_contains($key, 'lahir') || str_contains($key, 'tpt'))) {
                        $dataToSave['tempat_lahir'] = $value;
                    } elseif ((str_contains($key, 'tanggal') || str_contains($key, 'tgl') || str_contains($key, 'waktu') || str_contains($key, 'birth')) && str_contains($key, 'lahir')) {
                        // Attempt to parse Excel serial date if numeric, or parse string
                        if (is_numeric($value)) {
                            try {
                                $dataToSave['tanggal_lahir'] = \Carbon\Carbon::createFromTimestamp(\PhpOffice\PhpSpreadsheet\Shared\Date::excelToTimestamp($value))->format('Y-m-d');
                            } catch (\Exception $e) {
                                $dataToSave['tanggal_lahir'] = $value; // Fallback to raw string
                            }
                        } else {
                            try {
                                $dataToSave['tanggal_lahir'] = \Carbon\Carbon::parse($value)->format('Y-m-d');
                            } catch (\Exception $e) {
                                $dataToSave['tanggal_lahir'] = $value; // Fallback for unparseable natively
                            }
                        }
                    } else {
                        // Allow exact matches from our explicit allowlist if it didn't trigger fuzzy logic
                        if (in_array($key, $allowedFields)) {
                            $dataToSave[$key] = $value; 
                        }
                    }
                }

                \Illuminate\Support\Facades\Log::info("Import Row $index processed. Final mapping:", $dataToSave);

                $nisn = $dataToSave['nisn'] ?? null;
                $nisn = $nisn ? ltrim(trim((string)$nisn), "'") : null;

                // Fallback for NISN from NIS if NISN is missing
                if (!$nisn && isset($normalizedRow['nis'])) {
                    $nisn = $normalizedRow['nis'];
                    $dataToSave['nisn'] = $nisn;
                }

                // Force ownership based on authenticated user
                $actualSchoolId = $request->user()->school_id;
                
                if (!$actualSchoolId && $request->user()->role !== 'operator') {
                    // If super admin (null schoolId), try to find school from the row data
                    if (!empty($dataToSave['npsn'])) {
                        $sch = \App\Models\School::where('npsn', $dataToSave['npsn'])->first();
                        if ($sch) $actualSchoolId = $sch->id;
                    } 
                    
                    if (!$actualSchoolId && !empty($dataToSave['nama_sekolah'])) {
                        $sch = \App\Models\School::where('nama', 'ilike', '%' . $dataToSave['nama_sekolah'] . '%')->first();
                        if ($sch) $actualSchoolId = $sch->id;
                    }
                }

                // Fallback for nama (safety net if str_contains failed)
                if (empty($dataToSave['nama'])) {
                    $dataToSave['nama'] = $normalizedRow['nama_siswa'] 
                        ?? $normalizedRow['nama_lengkap'] 
                        ?? $normalizedRow['nama_santri'] 
                        ?? $normalizedRow['santri']
                        ?? $normalizedRow['nama']
                        ?? null;
                }

                if (empty($dataToSave['nama'])) {
                    // Skip if completely empty row (no name, no data)
                    if (count(array_filter($dataToSave)) === 0) continue;
                    $dataToSave['nama'] = "Siswa Baru (Tanpa Nama)";
                }

                if ($nisn) {
                    \App\Models\Student::updateOrCreate(
                        ['nisn' => $nisn], 
                        array_merge(
                            array_filter($dataToSave, fn($v) => !is_null($v)), 
                            ['school_id' => $actualSchoolId]
                        )
                    );
                } else {
                    \App\Models\Student::create(
                        array_merge(
                            array_filter($dataToSave, fn($v) => !is_null($v)), 
                            ['school_id' => $actualSchoolId]
                        )
                    );
                }
                $created++;
            } catch (\Throwable $e) {
                $errors[] = [
                    'row' => $index + 1,
                    'nisn' => (string)($row['nisn'] ?? $row['NISN'] ?? 'empty'), 
                    'error' => $e->getMessage()
                ];
            }
        }

        return response()->json([
            'created' => $created, 
            'errors' => $errors,
            'summary' => "Berhasil: $created, Gagal: " . count($errors)
        ]);
    }

    /**
     * POST /api/students/batch-transition — Naik kelas / Lulus
     */
    public function batchTransition(Request $request): JsonResponse
    {
        $request->validate([
            'school_id' => 'nullable|exists:schools,id',
            'action' => 'required|in:promote,graduate',
            'student_ids' => 'nullable|array',
            'student_ids.*' => 'exists:students,id'
        ]);

        $user = $request->user();

        // Operator must be scoped to their own school
        $schoolId = $request->school_id;
        if ($user->role === 'operator') {
            $schoolId = $user->school_id;
        }

        $query = Student::query()->with('school')->where('status', 'Aktif');
        if ($schoolId) {
            $query->where('school_id', $schoolId);
        }

        if (!empty($request->student_ids)) {
            $query->whereIn('id', $request->student_ids);
        }

        $students = $query->get();

        $count = 0;
        foreach ($students as $student) {
            if ($request->action === 'graduate') {
                $student->update([
                    'status' => 'Lulus',
                    'last_transition_at' => now(),
                ]);
                // Option A: Soft delete when graduating
                $student->delete();
            } elseif ($request->action === 'promote') {
                $oldClass = (string)($student->kelas ?? '');
                $jenjang = $student->school->jenjang ?? null;
                $transition = $this->incrementClass($oldClass, $jenjang);

                if ($transition['status'] === 'Lulus') {
                    $student->update([
                        'status' => 'Lulus',
                        'last_transition_at' => now(),
                    ]);
                    // Option A: Soft delete when graduating
                    $student->delete();
                } else {
                    $student->update([
                        'kelas' => $transition['kelas'],
                        'last_transition_at' => now(),
                    ]);
                }
            }
            $count++;
        }

        return response()->json(['count' => $count]);
    }

    private function incrementClass(string $class, ?string $jenjang = null): array
    {
        $trimmed = trim($class);
        if ($trimmed === '') {
            return ['status' => 'Aktif', 'kelas' => $class];
        }

        // Determine max grade threshold based on school jenjang
        $maxGrade = 12;
        $jenjangUpper = strtoupper((string)$jenjang);
        if (str_contains($jenjangUpper, 'MI') || str_contains($jenjangUpper, 'SD')) {
            $maxGrade = 6;
        } elseif (str_contains($jenjangUpper, 'MTS') || str_contains($jenjangUpper, 'SMP')) {
            $maxGrade = 9;
        } elseif (str_contains($jenjangUpper, 'MA') || str_contains($jenjangUpper, 'SMA') || str_contains($jenjangUpper, 'SMK')) {
            $maxGrade = 12;
        }

        // 1. Check Roman Numerals (Order from longest to shortest: XII down to I)
        $romanOrder = ['XII', 'XI', 'X', 'IX', 'VIII', 'VII', 'VI', 'V', 'IV', 'III', 'II', 'I'];
        $romanNext = [
            'I' => 'II', 'II' => 'III', 'III' => 'IV', 'IV' => 'V', 'V' => 'VI',
            'VI' => 'VII', 'VII' => 'VIII', 'VIII' => 'IX', 'IX' => 'X',
            'X' => 'XI', 'XI' => 'XII', 'XII' => 'Lulus'
        ];
        $romanVal = [
            'I' => 1, 'II' => 2, 'III' => 3, 'IV' => 4, 'V' => 5,
            'VI' => 6, 'VII' => 7, 'VIII' => 8, 'IX' => 9,
            'X' => 10, 'XI' => 11, 'XII' => 12
        ];

        foreach ($romanOrder as $rom) {
            if (preg_match("/\b" . preg_quote($rom, '/') . "\b/i", $trimmed)) {
                $numVal = $romanVal[$rom];
                // Check if current grade reaches or exceeds maxGrade boundary for this level
                if ($numVal >= $maxGrade || (empty($jenjang) && in_array($numVal, [6, 9, 12], true))) {
                    return ['status' => 'Lulus', 'kelas' => $trimmed];
                }
                $nextRom = $romanNext[$rom] ?? $rom;
                $newClass = preg_replace("/\b" . preg_quote($rom, '/') . "\b/i", $nextRom, $trimmed, 1);
                return ['status' => 'Aktif', 'kelas' => $newClass];
            }
        }

        // 2. Check Arabic Numerals (1-12)
        if (preg_match('/(\d+)/', $trimmed, $matches)) {
            $num = (int)$matches[1];
            if ($num >= $maxGrade || (empty($jenjang) && in_array($num, [6, 9, 12], true))) {
                return ['status' => 'Lulus', 'kelas' => $trimmed];
            }
            $newNum = $num + 1;
            $newClass = preg_replace('/' . $num . '/', (string)$newNum, $trimmed, 1);
            return ['status' => 'Aktif', 'kelas' => $newClass];
        }

        return ['status' => 'Aktif', 'kelas' => $trimmed];
    }
}
