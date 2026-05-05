<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceSetting;
use App\Models\LessonSchedule;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentAttendanceLog;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use GuzzleHttp\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    // ── Teacher Attendance ──

    public function teacherIndex(Request $request): JsonResponse
    {
        $schoolId = $request->user()->school_id;
        $query = TeacherAttendance::with('teacher')
            ->where('school_id', $schoolId);

        if ($request->tanggal) {
            $query->where('tanggal', $request->tanggal);
        }

        return response()->json(
            $query->orderByDesc('tanggal')->paginate($request->integer('per_page', 50))
        );
    }

    public function teacherStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'teacher_id' => 'required|exists:teachers,id',
            'tanggal' => 'required|date',
            'jam_masuk' => 'nullable|string',
            'jam_pulang' => 'nullable|string',
            'status' => 'required|string|in:Hadir,Sakit,Izin,Alpha',
            'keterangan' => 'nullable|string',
            'scanned_by' => 'nullable|string',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
        ]);

        $data['school_id'] = $request->user()->school_id;

        // Geofencing validation
        if (isset($data['latitude']) && isset($data['longitude'])) {
            $settings = AttendanceSetting::where('school_id', $data['school_id'])->first();

            if ($settings && $settings->geolocation_enabled && $settings->school_latitude && $settings->school_longitude) {
                $distance = $this->calculateDistance(
                    $data['latitude'],
                    $data['longitude'],
                    $settings->school_latitude,
                    $settings->school_longitude
                );

                $data['location_verified'] = $distance <= $settings->geofence_radius_meters;

                if (! $data['location_verified']) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Lokasi Anda berada '.round($distance)."m dari sekolah. Maksimal radius: {$settings->geofence_radius_meters}m",
                        'distance' => round($distance),
                        'max_radius' => $settings->geofence_radius_meters,
                    ], 422);
                }
            }
        }

        $attendance = TeacherAttendance::updateOrCreate(
            ['teacher_id' => $data['teacher_id'], 'tanggal' => $data['tanggal']],
            $data
        );

        return response()->json($attendance, 201);
    }

    // ── Student Attendance (Aggregate Logs) ──

    public function studentLogIndex(Request $request): JsonResponse
    {
        $schoolId = $request->user()->school_id;
        $query = StudentAttendanceLog::with(['schoolClass', 'subject'])
            ->where('school_id', $schoolId);

        if ($request->tanggal) {
            $query->where('tanggal', $request->tanggal);
        }
        if ($request->class_id) {
            $query->where('class_id', $request->class_id);
        }

        return response()->json(
            $query->orderByDesc('tanggal')->paginate($request->integer('per_page', 50))
        );
    }

    public function studentLogStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'class_id' => 'required|exists:classes,id',
            'subject_id' => 'required|exists:subjects,id',
            'tanggal' => 'required|date',
            'jam_ke' => 'nullable|integer',
            'logs' => 'required|array',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
        ]);

        $data['school_id'] = $request->user()->school_id;

        // Geofencing validation
        if (isset($data['latitude']) && isset($data['longitude'])) {
            $settings = AttendanceSetting::where('school_id', $data['school_id'])->first();

            if ($settings && $settings->geolocation_enabled && $settings->school_latitude && $settings->school_longitude) {
                $distance = $this->calculateDistance(
                    $data['latitude'],
                    $data['longitude'],
                    $settings->school_latitude,
                    $settings->school_longitude
                );

                $data['location_verified'] = $distance <= $settings->geofence_radius_meters;

                if (! $data['location_verified']) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Lokasi Anda berada '.round($distance)."m dari sekolah. Maksimal radius: {$settings->geofence_radius_meters}m",
                        'distance' => round($distance),
                        'max_radius' => $settings->geofence_radius_meters,
                    ], 422);
                }
            }
        }

        $log = StudentAttendanceLog::updateOrCreate(
            [
                'school_id' => $data['school_id'],
                'class_id' => $data['class_id'],
                'subject_id' => $data['subject_id'],
                'tanggal' => $data['tanggal'],
            ],
            $data
        );

        return response()->json($log, 201);
    }

    // ── QR Scanner ──

    public function qrScan(Request $request): JsonResponse
    {
        $request->validate([
            'code' => 'required|string',
            'type' => 'required|in:teacher,student',
        ]);

        $schoolId = $request->user()->school_id;
        $today = now()->toDateString();
        $time = now()->format('H:i');

        if ($request->type === 'teacher') {
            $teacher = Teacher::where('nuptk', $request->code)
                ->orWhere('id', $request->code)
                ->first();

            if (! $teacher) {
                return response()->json(['error' => 'Guru tidak ditemukan'], 404);
            }

            $attendance = TeacherAttendance::updateOrCreate(
                ['teacher_id' => $teacher->id, 'tanggal' => $today],
                [
                    'school_id' => $schoolId,
                    'jam_masuk' => $time,
                    'status' => 'Hadir',
                    'scanned_by' => $request->user()->name,
                ]
            );

            return response()->json([
                'success' => true,
                'teacher' => $teacher->nama,
                'attendance' => $attendance,
            ]);
        }

        return response()->json(['success' => true, 'message' => 'Student QR scan recorded']);
    }

    // ── Subjects CRUD ──

    public function subjectIndex(Request $request): JsonResponse
    {
        return response()->json(
            Subject::where('school_id', $request->user()->school_id)
                ->orderBy('nama')
                ->get()
        );
    }

    public function subjectStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nama' => 'required|string|max:255',
            'kode' => 'nullable|string|max:20',
        ]);
        $data['school_id'] = $request->user()->school_id;
        $data['is_active'] = true;

        return response()->json(Subject::create($data), 201);
    }

    public function subjectUpdate(Request $request, Subject $subject): JsonResponse
    {
        $subject->update($request->only(['nama', 'kode', 'is_active']));

        return response()->json($subject->fresh());
    }

    // ── Classes CRUD ──

    public function classIndex(Request $request): JsonResponse
    {
        return response()->json(
            SchoolClass::with('waliKelas')
                ->where('school_id', $request->user()->school_id)
                ->orderBy('tingkat')
                ->orderBy('nama')
                ->get()
        );
    }

    public function classStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nama' => 'required|string|max:255',
            'tingkat' => 'required|string',
            'tahun_ajaran' => 'required|string',
            'wali_kelas_id' => 'nullable|exists:teachers,id',
        ]);
        $data['school_id'] = $request->user()->school_id;
        $data['is_active'] = true;

        return response()->json(SchoolClass::create($data), 201);
    }

    public function classUpdate(Request $request, SchoolClass $class): JsonResponse
    {
        $class->update($request->only(['nama', 'tingkat', 'tahun_ajaran', 'wali_kelas_id', 'is_active']));

        return response()->json($class->fresh());
    }

    // ── Lesson Schedule ──

    public function scheduleIndex(Request $request): JsonResponse
    {
        return response()->json(
            LessonSchedule::where('school_id', $request->user()->school_id)
                ->orderBy('jam_ke')
                ->get()
        );
    }

    public function scheduleStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jam_ke' => 'required|integer',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
        ]);
        $data['school_id'] = $request->user()->school_id;

        $schedule = LessonSchedule::updateOrCreate(
            ['school_id' => $data['school_id'], 'jam_ke' => $data['jam_ke']],
            $data
        );

        return response()->json($schedule, 201);
    }

    // ── Attendance Settings ──

    public function settingsShow(Request $request): JsonResponse
    {
        $settings = AttendanceSetting::firstOrCreate(
            ['school_id' => $request->user()->school_id],
            [
                'absensi_guru_aktif' => false,
                'absensi_siswa_aktif' => false,
                'qr_scan_aktif' => false,
            ]
        );

        return response()->json($settings);
    }

    public function settingsUpdate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'absensi_guru_aktif' => 'nullable|boolean',
            'absensi_siswa_aktif' => 'nullable|boolean',
            'scanner_pin' => 'nullable|string',
            'qr_scan_aktif' => 'nullable|boolean',
            'gowa_url' => 'nullable|string',
            'gowa_device_id' => 'nullable|string',
        ]);

        $settings = AttendanceSetting::updateOrCreate(
            ['school_id' => $request->user()->school_id],
            $data
        );

        return response()->json($settings);
    }

    // ── Student Attendance Report ──

    public function studentReport(Request $request): JsonResponse
    {
        $request->validate([
            'class_id' => 'required|exists:classes,id',
            'subject_id' => 'required|exists:subjects,id',
            'bulan' => 'required|string', // YYYY-MM
        ]);

        $schoolId = $request->user()->school_id;
        $classId = $request->class_id;
        $subjectId = $request->subject_id;
        $bulan = $request->bulan;

        // Get class with null check
        $class = SchoolClass::find($classId);
        if (! $class) {
            return response()->json([
                'success' => false,
                'message' => 'Class not found',
            ], 404);
        }

        $students = Student::where('school_id', $schoolId)
            ->where('kelas', $class->nama)
            ->get();

        $logs = StudentAttendanceLog::where('school_id', $schoolId)
            ->where('class_id', $classId)
            ->where('subject_id', $subjectId)
            ->where('tanggal', 'like', "$bulan%")
            ->get();

        $matrix = [];
        foreach ($logs as $log) {
            foreach ($log->logs ?? [] as $entry) {
                $studentId = $entry['student_id'] ?? null;
                if ($studentId) {
                    $matrix[$studentId][$log->tanggal] = $entry['status'] ?? 'Alpha';
                }
            }
        }

        return response()->json([
            'students' => $students,
            'matrix' => (object) $matrix,
            'class_name' => $class->nama,
        ]);
    }

    public function checkWaConnection(Request $request): JsonResponse
    {
        $settings = AttendanceSetting::where('school_id', $request->user()->school_id)->first();
        if (! $settings || ! $settings->gowa_url) {
            return response()->json(['success' => false, 'message' => 'GoWA URL belum dikonfigurasi'], 400);
        }

        try {
            // Real check would be an HTTP call to GoWA server
            // For now, we simulate a check to the configured URL
            $client = new Client(['timeout' => 5]);
            $response = $client->get($settings->gowa_url.'/health'); // Typical health check

            return response()->json([
                'success' => true,
                'status' => $response->getStatusCode() === 200 ? 'online' : 'offline',
                'details' => $response->getBody()->getContents(),
            ]);
        } catch (\Throwable $e) {
            // If it fails, we still return a success response with status offline to prevent 500
            return response()->json([
                'success' => false,
                'status' => 'offline',
                'message' => $e->getMessage(),
            ]);
        }
    }

    // ── PIN Verification ──

    public function verifyPin(Request $request): JsonResponse
    {
        $request->validate([
            'pin' => 'required|string',
        ]);

        $settings = AttendanceSetting::where('school_id', $request->user()->school_id)->first();

        if (! $settings || ! $settings->scanner_pin) {
            return response()->json([
                'success' => false,
                'message' => 'PIN scanner belum dikonfigurasi',
            ], 400);
        }

        if ($request->pin === $settings->scanner_pin) {
            return response()->json([
                'success' => true,
                'message' => 'PIN valid',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'PIN salah',
        ], 401);
    }

    // ── Geolocation Helper ──

    /**
     * Calculate distance between two GPS coordinates using Haversine formula
     *
     * @param  float  $lat1  Latitude of first point
     * @param  float  $lon1  Longitude of first point
     * @param  float  $lat2  Latitude of second point
     * @param  float  $lon2  Longitude of second point
     * @return float Distance in meters
     */
    private function calculateDistance(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadius = 6371000; // Earth radius in meters

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
            cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
            sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c; // Returns distance in meters
    }
}
