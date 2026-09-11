<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceSetting;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentAttendanceLog;
use App\Models\Subject;
use App\Models\LessonSchedule;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Public Attendance Controller
 *
 * Endpoints accessible without full user login, but protected by verified scanner session token / PIN.
 * Used by the standalone /scan page for teachers to record student attendance.
 */
class PublicAttendanceController extends Controller
{
    /**
     * Validate whether the request has an active scanner session bound to the target school,
     * or is authenticated via Sanctum with appropriate tenant permissions.
     */
    protected function validateScannerSession(Request $request, int $schoolId): bool
    {
        // 1. Authenticated Sanctum user
        if ($user = $request->user()) {
            return $user->isSuperAdmin() || (int) $user->school_id === (int) $schoolId;
        }

        // 2. Token from header (X-Scanner-Token / Bearer) or query parameter
        $token = $request->header('X-Scanner-Token')
            ?? $request->bearerToken()
            ?? $request->query('scanner_token');

        if (! $token) {
            return false;
        }

        $session = Cache::get("scanner_session:{$token}");
        if (! $session || ! isset($session['school_id'])) {
            return false;
        }

        // Must match expected school_id and purpose
        if ((int) $session['school_id'] !== (int) $schoolId) {
            return false;
        }

        if (($session['purpose'] ?? '') !== 'attendance_scanner') {
            return false;
        }

        return true;
    }

    /**
     * List all schools (for school selector on login screen).
     */
    public function schools(): JsonResponse
    {
        $schools = School::select('id', 'nama', 'npsn', 'jenjang', 'kecamatan')
            ->orderBy('nama')
            ->get();

        return response()->json($schools);
    }

    /**
     * Verify PIN for a school.
     * Returns a short-lived cryptographically signed session token stored client-side.
     *
     * POST /api/public/attendance/verify-pin
     * Body: { school_id, pin }
     */
    public function verifyPin(Request $request): JsonResponse
    {
        $request->validate([
            'school_id' => 'required|integer|exists:schools,id',
            'pin'       => 'required|string',
        ]);

        $settings = AttendanceSetting::where('school_id', $request->school_id)->first();

        if (! $settings || ! $settings->scanner_pin) {
            return response()->json([
                'success' => false,
                'message' => 'PIN scanner belum dikonfigurasi untuk sekolah ini. Hubungi operator.',
            ], 400);
        }

        if ($request->pin !== $settings->scanner_pin) {
            return response()->json([
                'success' => false,
                'message' => 'PIN salah. Coba lagi.',
            ], 401);
        }

        $school = School::find($request->school_id);

        // Generate cryptographically secure scanner session token
        $scannerToken = hash_hmac('sha256', Str::random(40) . '|' . $request->school_id . '|' . now()->timestamp, config('app.key') ?: 'simmaci-secret-key');

        // Cache token for 8 hours with school binding & purpose
        Cache::put("scanner_session:{$scannerToken}", [
            'school_id'  => (int) $request->school_id,
            'purpose'    => 'attendance_scanner',
            'issued_at'  => now()->timestamp,
            'expires_at' => now()->addHours(8)->timestamp,
        ], now()->addHours(8));

        return response()->json([
            'success'       => true,
            'message'       => 'PIN valid',
            'scanner_token' => $scannerToken,
            'school_id'     => (int) $request->school_id,
            'school_name'   => $school->nama,
            'expires_in'    => 28800,
        ]);
    }

    /**
     * Get classes for a school (requires valid scanner session or user auth).
     *
     * GET /api/public/attendance/classes?school_id=1
     */
    public function classes(Request $request): JsonResponse
    {
        $request->validate(['school_id' => 'required|integer|exists:schools,id']);

        if (! $this->validateScannerSession($request, (int) $request->school_id)) {
            return response()->json([
                'message' => 'Unauthorized: Sesi scanner tidak valid atau telah kedaluwarsa. Masukkan PIN scanner terlebih dahulu.',
            ], 401);
        }

        $classes = SchoolClass::withoutGlobalScopes()
            ->where('school_id', $request->school_id)
            ->where('is_active', true)
            ->orderBy('tingkat')
            ->orderBy('nama')
            ->get(['id', 'nama', 'tingkat', 'tahun_ajaran']);

        return response()->json($classes);
    }

    /**
     * Get subjects for a school (requires valid scanner session or user auth).
     *
     * GET /api/public/attendance/subjects?school_id=1
     */
    public function subjects(Request $request): JsonResponse
    {
        $request->validate(['school_id' => 'required|integer|exists:schools,id']);

        if (! $this->validateScannerSession($request, (int) $request->school_id)) {
            return response()->json([
                'message' => 'Unauthorized: Sesi scanner tidak valid atau telah kedaluwarsa. Masukkan PIN scanner terlebih dahulu.',
            ], 401);
        }

        $subjects = Subject::withoutGlobalScopes()
            ->where('school_id', $request->school_id)
            ->where('is_active', true)
            ->orderBy('nama')
            ->get(['id', 'nama', 'kode']);

        return response()->json($subjects);
    }

    /**
     * Get lesson schedules for a school (requires valid scanner session or user auth).
     *
     * GET /api/public/attendance/schedules?school_id=1
     */
    public function schedules(Request $request): JsonResponse
    {
        $request->validate(['school_id' => 'required|integer|exists:schools,id']);

        if (! $this->validateScannerSession($request, (int) $request->school_id)) {
            return response()->json([
                'message' => 'Unauthorized: Sesi scanner tidak valid atau telah kedaluwarsa. Masukkan PIN scanner terlebih dahulu.',
            ], 401);
        }

        $schedules = LessonSchedule::withoutGlobalScopes()
            ->where('school_id', $request->school_id)
            ->orderBy('jam_ke')
            ->get(['id', 'jam_ke', 'jam_mulai', 'jam_selesai']);

        return response()->json($schedules);
    }

    /**
     * Get students for a class (requires valid scanner session or user auth).
     * PII minimized: only returns necessary identifiers for scanning (id, nama, kelas).
     *
     * GET /api/public/attendance/students?school_id=1&class_id=2
     */
    public function students(Request $request): JsonResponse
    {
        $request->validate([
            'school_id' => 'required|integer|exists:schools,id',
            'class_id'  => 'required|integer',
        ]);

        if (! $this->validateScannerSession($request, (int) $request->school_id)) {
            return response()->json([
                'message' => 'Unauthorized: Sesi scanner tidak valid atau telah kedaluwarsa. Masukkan PIN scanner terlebih dahulu.',
            ], 401);
        }

        $class = SchoolClass::withoutGlobalScopes()
            ->where('id', $request->class_id)
            ->where('school_id', $request->school_id)
            ->first();

        if (! $class) {
            return response()->json(['message' => 'Kelas tidak ditemukan'], 404);
        }

        $students = Student::withoutGlobalScopes()
            ->where('school_id', $request->school_id)
            ->where('kelas', $class->nama)
            ->orderBy('nama')
            ->get(['id', 'nama', 'kelas']);

        return response()->json($students);
    }

    /**
     * Get existing attendance log for a class/subject/date (requires valid scanner session or user auth).
     *
     * GET /api/public/attendance/student-log?school_id=1&class_id=2&subject_id=3&tanggal=2024-01-15
     */
    public function studentLogShow(Request $request): JsonResponse
    {
        $request->validate([
            'school_id'  => 'required|integer|exists:schools,id',
            'class_id'   => 'required|integer',
            'subject_id' => 'required|integer',
            'tanggal'    => 'required|date',
        ]);

        if (! $this->validateScannerSession($request, (int) $request->school_id)) {
            return response()->json([
                'message' => 'Unauthorized: Sesi scanner tidak valid atau telah kedaluwarsa. Masukkan PIN scanner terlebih dahulu.',
            ], 401);
        }

        $log = StudentAttendanceLog::withoutGlobalScopes()
            ->where('school_id', $request->school_id)
            ->where('class_id', $request->class_id)
            ->where('subject_id', $request->subject_id)
            ->where('tanggal', \Carbon\Carbon::parse($request->tanggal)->toDateString())
            ->first();

        if (! $log) {
            return response()->json(['logs' => []]);
        }

        return response()->json(['logs' => $log->logs ?? []]);
    }

    /**
     * Save student attendance log (bulk).
     * PIN is re-validated on every save for security.
     *
     * POST /api/public/attendance/student-log
     * Body: { school_id, pin, class_id, subject_id, tanggal, jam_ke?, logs: [{student_id, status}] }
     */
    public function studentLogStore(Request $request): JsonResponse
    {
        $request->validate([
            'school_id'  => 'required|integer|exists:schools,id',
            'pin'        => 'required|string',
            'class_id'   => 'required|integer',
            'subject_id' => 'required|integer',
            'tanggal'    => 'required|date',
            'jam_ke'     => 'nullable|integer',
            'logs'       => 'required|array',
            'logs.*.student_id' => 'required|integer',
            'logs.*.status'     => 'required|string|in:Hadir,Sakit,Izin,Alpa',
        ]);

        // Re-validate PIN on every save
        $settings = AttendanceSetting::withoutGlobalScopes()
            ->where('school_id', $request->school_id)
            ->first();

        if (! $settings || $request->pin !== $settings->scanner_pin) {
            return response()->json([
                'success' => false,
                'message' => 'PIN tidak valid. Silakan login ulang.',
            ], 401);
        }

        $tanggal = \Carbon\Carbon::parse($request->tanggal)->toDateString();

        $log = StudentAttendanceLog::withoutGlobalScopes()->updateOrCreate(
            [
                'school_id'  => $request->school_id,
                'class_id'   => $request->class_id,
                'subject_id' => $request->subject_id,
                'tanggal'    => $tanggal,
            ],
            [
                'school_id'  => $request->school_id,
                'class_id'   => $request->class_id,
                'subject_id' => $request->subject_id,
                'tanggal'    => $tanggal,
                'jam_ke'     => $request->jam_ke,
                'logs'       => $request->logs,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Absensi berhasil disimpan',
            'id'      => $log->id,
        ], 201);
    }

    /**
     * QR scan for teacher attendance (public, PIN-protected).
     *
     * POST /api/public/attendance/qr-scan
     * Body: { school_id, pin, code, type: 'teacher'|'student' }
     */
    public function qrScan(Request $request): JsonResponse
    {
        $request->validate([
            'school_id' => 'required|integer|exists:schools,id',
            'pin'       => 'required|string',
            'code'      => 'required|string',
            'type'      => 'required|in:teacher,student',
        ]);

        // Validate PIN
        $settings = AttendanceSetting::withoutGlobalScopes()
            ->where('school_id', $request->school_id)
            ->first();

        if (! $settings || $request->pin !== $settings->scanner_pin) {
            return response()->json([
                'success' => false,
                'message' => 'PIN tidak valid.',
            ], 401);
        }

        $today = now()->toDateString();
        $time  = now()->format('H:i');

        if ($request->type === 'teacher') {
            $teacher = Teacher::withoutGlobalScopes()
                ->where('school_id', $request->school_id)
                ->where(function ($q) use ($request) {
                    $q->where('nuptk', $request->code)
                      ->orWhere('id', $request->code);
                })
                ->first();

            if (! $teacher) {
                return response()->json([
                    'success' => false,
                    'message' => 'Guru tidak ditemukan di sekolah ini.',
                ], 404);
            }

            $attendance = TeacherAttendance::withoutGlobalScopes()->updateOrCreate(
                [
                    'teacher_id' => $teacher->id,
                    'tanggal'    => $today,
                    'school_id'  => $request->school_id,
                ],
                [
                    'school_id'  => $request->school_id,
                    'jam_masuk'  => $time,
                    'status'     => 'Hadir',
                    'scanned_by' => 'Scanner Publik',
                ]
            );

            return response()->json([
                'success'    => true,
                'message'    => "Absensi {$teacher->nama} tercatat",
                'user_name'  => $teacher->nama,
                'attendance_status' => 'Hadir',
                'attendance' => $attendance,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'QR siswa tercatat',
        ]);
    }
}
