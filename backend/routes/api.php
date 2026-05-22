<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\SchoolController;
use App\Http\Controllers\Api\TeacherController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\SkDocumentController;
use App\Http\Controllers\Api\HeadmasterController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\NuptkSubmissionController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\FileUploadController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\DataAuditController;
use App\Http\Controllers\Api\ApprovalHistoryController;
use App\Http\Controllers\Api\TeacherMutationController;
use App\Http\Controllers\Api\SkTemplateController;
use App\Http\Controllers\Api\SkVerificationController;
use App\Http\Controllers\Api\MinioProxyController;
use App\Http\Controllers\Api\PublicAttendanceController;
use App\Http\Controllers\Api\WaBlastController;
use App\Http\Controllers\Api\WaBlastConfigController;
use App\Http\Controllers\Api\WaBlastTemplateController;
use App\Http\Controllers\Api\MeetingController;
use App\Http\Controllers\Api\MeetingReportController;
use App\Http\Controllers\Api\MeetingMinutesController;
use App\Http\Controllers\Api\MeetingPhotoController;
use App\Http\Controllers\Api\PublicMeetingScannerController;
use App\Http\Controllers\Api\StudentStatisticsController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// ── Temporary Cleanup Route (Delete after use) ──
Route::get('temp-cleanup', function () {
    $tables = ['schools', 'notifications', 'teachers', 'students', 'users', 'activity_logs', 'sk_documents'];
    $fixed  = 0;
    foreach ($tables as $table) {
        if (!\Illuminate\Support\Facades\Schema::hasTable($table)) continue;
        $rows = \Illuminate\Support\Facades\DB::table($table)->get();
        foreach ($rows as $row) {
            $updates = [];
            $id = $row->id ?? null;
            if (!$id) continue;
            foreach ($row as $key => $val) {
                if (is_string($val) && $val !== '') {
                    $clean = htmlspecialchars_decode(htmlspecialchars($val, ENT_SUBSTITUTE, 'UTF-8'));
                    if ($clean !== $val) {
                        $updates[$key] = $clean;
                    }
                }
            }
            if (!empty($updates)) {
                \Illuminate\Support\Facades\DB::table($table)->where('id', $id)->update($updates);
                $fixed++;
            }
        }
    }
    return response()->json(['success' => true, 'fixed_rows' => $fixed]);
});

// ── Public / Auth ──
Route::prefix('auth')->group(function () {
    Route::post('login',    [AuthController::class, 'login']);
    Route::post('register', [AuthController::class, 'register']);
});

// ── Public SK Verification ──
Route::get('verify/sk/{nomor}', [SkVerificationController::class, 'verifyBySk'])
    ->where('nomor', '.*');

// ── PPDB Public Registration ──
Route::prefix('ppdb')->group(function () {
    Route::get('schools',          [SchoolController::class, 'publicIndex']);
    Route::post('register',        [StudentController::class, 'ppdbRegister']);
    Route::post('upload-document', [FileUploadController::class, 'upload']);
});

// ── Public Routes ──
// MinIO proxy - accessible at /api/minio/*
Route::get('minio', [MinioProxyController::class, 'proxy'])->name('minio.proxy');
Route::get('minio/{path}', [MinioProxyController::class, 'proxy'])->where('path', '.*')->name('minio.proxy.path');

// ── Public Attendance (Scanner Standalone — PIN protected, no auth token) ──
Route::prefix('public/attendance')->group(function () {
    Route::get('schools',      [PublicAttendanceController::class, 'schools']);
    Route::post('verify-pin',  [PublicAttendanceController::class, 'verifyPin']);
    Route::get('classes',      [PublicAttendanceController::class, 'classes']);
    Route::get('subjects',     [PublicAttendanceController::class, 'subjects']);
    Route::get('schedules',    [PublicAttendanceController::class, 'schedules']);
    Route::get('students',     [PublicAttendanceController::class, 'students']);
    Route::get('student-log',  [PublicAttendanceController::class, 'studentLogShow']);
    Route::post('student-log', [PublicAttendanceController::class, 'studentLogStore']);
    Route::post('qr-scan',     [PublicAttendanceController::class, 'qrScan']);
});

// ── Public Meeting Scanner (PIN protected, no auth token) ──
Route::prefix('public/meetings')->group(function () {
    Route::post('verify-pin', [PublicMeetingScannerController::class, 'verifyPin']);
    Route::post('scan',       [PublicMeetingScannerController::class, 'scan']);
    Route::get('active',      [PublicMeetingScannerController::class, 'activeList']);
});

// ── Meeting Photo File Serving (no auth — photos are not sensitive) ──
Route::get('meetings/{meeting}/photos/{photo}/file', [MeetingPhotoController::class, 'show']);
Route::get('meetings/{meeting}/photos/{photo}/thumbnail', [MeetingPhotoController::class, 'thumbnail']);

// Test route untuk debug
Route::get('test-minio', function() {
    return response()->json(['status' => 'ok', 'message' => 'MinIO proxy test endpoint']);
})->name('test.minio');

// ── Protected Routes ──
Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::post('auth/logout',          [AuthController::class, 'logout']);
    Route::get('auth/me',               [AuthController::class, 'user']);
    Route::post('auth/change-password', [AuthController::class, 'changePassword']);


    // Schools (no tenant isolation — global resource)
    Route::middleware('role:super_admin')->group(function () {
        Route::delete('schools/delete-all',       [SchoolController::class, 'deleteAll']);
        Route::post('schools/generate-accounts',  [SchoolController::class, 'generateAccounts']);
        Route::post('schools/import',             [SchoolController::class, 'import']);
    });
    
    Route::get('schools/profile/me', [SchoolController::class, 'profile']);
    Route::get('schools/autocomplete', [SchoolController::class, 'autocomplete']);
    Route::apiResource('schools', SchoolController::class);


    // ── Tenant-Isolated Routes ──
    Route::middleware('tenant')->group(function () {
        // Dashboard (Tenant-Aware)
        Route::prefix('dashboard')->group(function () {
            Route::get('stats',            [DashboardController::class, 'stats']);
            Route::get('school-stats',     [DashboardController::class, 'schoolStats']);
            Route::get('school-statistics', [DashboardController::class, 'getSchoolStatistics']);
            Route::get('charts',           [DashboardController::class, 'charts']);
            Route::get('sk-statistics',    [DashboardController::class, 'skStatistics']);
            Route::get('sk-trend',         [DashboardController::class, 'skTrend']);
            Route::get('school-breakdown', [DashboardController::class, 'schoolBreakdown']);
        });
        // Teachers
        Route::middleware('role:super_admin')->group(function () {
            Route::delete('teachers/delete-all',        [TeacherController::class, 'deleteAll']);
            Route::post('teachers/generate-accounts',   [TeacherController::class, 'generateAccounts']);
        });
        
        Route::post('teachers/import', [TeacherController::class, 'import']);
        // NIM routes must be registered before apiResource to avoid {teacher} wildcard conflict
        Route::get('teachers/nim/generate', [TeacherController::class, 'previewNim']);
        Route::patch('teachers/{teacher}/nim', [TeacherController::class, 'updateNim']);
        Route::apiResource('teachers', TeacherController::class);


        // Students
        Route::post('students/import', [StudentController::class, 'import']);
        Route::post('students/batch-transition', [StudentController::class, 'batchTransition']);
        Route::apiResource('students', StudentController::class);

        // SK Documents — specific routes MUST come before apiResource
        Route::post('sk-documents/submit-request',  [SkDocumentController::class, 'submitRequest']);
        Route::post('sk-documents/bulk-request',    [SkDocumentController::class, 'bulkRequest']);
        Route::patch('sk-documents/batch-status',   [SkDocumentController::class, 'batchUpdateStatus']);
        Route::get('sk-documents-revisions', [SkDocumentController::class, 'revisions']);
        Route::get('sk-documents/{skDocument}/revisions', [SkDocumentController::class, 'revisions']);
        Route::apiResource('sk-documents', SkDocumentController::class);

        // Headmasters
        Route::apiResource('headmasters', HeadmasterController::class)->only(['index', 'show', 'store']);
        Route::post('headmasters/{headmasterTenure}/approve', [HeadmasterController::class, 'approve']);
        Route::get('headmasters/expiring',                    [HeadmasterController::class, 'expiring']);

        // NUPTK Submissions
        Route::apiResource('nuptk-submissions', NuptkSubmissionController::class)->only(['index', 'store']);
        Route::post('nuptk-submissions/{nuptkSubmission}/approve', [NuptkSubmissionController::class, 'approve']);
        Route::post('nuptk-submissions/{nuptkSubmission}/reject',  [NuptkSubmissionController::class, 'reject']);

        // Attendance
        Route::prefix('attendance')->group(function () {
            Route::get('teacher',        [AttendanceController::class, 'teacherIndex']);
            Route::post('teacher',       [AttendanceController::class, 'teacherStore']);
            Route::get('student-log',    [AttendanceController::class, 'studentLogIndex']);
            Route::post('student-log',   [AttendanceController::class, 'studentLogStore']);
            Route::post('qr-scan',       [AttendanceController::class, 'qrScan']);
            Route::post('verify-pin',    [AttendanceController::class, 'verifyPin']);
            Route::get('subjects',       [AttendanceController::class, 'subjectIndex']);
            Route::post('subjects',      [AttendanceController::class, 'subjectStore']);
            Route::put('subjects/{subject}', [AttendanceController::class, 'subjectUpdate']);
            Route::delete('subjects/{subject}', [AttendanceController::class, 'subjectDestroy']);
            Route::get('classes',        [AttendanceController::class, 'classIndex']);
            Route::post('classes',       [AttendanceController::class, 'classStore']);
            Route::put('classes/{class}', [AttendanceController::class, 'classUpdate']);
            Route::get('schedules',      [AttendanceController::class, 'scheduleIndex']);
            Route::post('schedules',     [AttendanceController::class, 'scheduleStore']);
            Route::get('settings',       [AttendanceController::class, 'settingsShow']);
            Route::put('settings',       [AttendanceController::class, 'settingsUpdate']);
            Route::get('student-report', [AttendanceController::class, 'studentReport']);
            Route::get('check-wa',       [AttendanceController::class, 'checkWaConnection']);
        });

        // Reports
        Route::prefix('reports')->group(function () {
            Route::get('sk',             [ReportController::class, 'skReport']);
            Route::get('sk-per-sekolah', [ReportController::class, 'skPerSekolah']);
            Route::get('teacher',        [ReportController::class, 'teacherReport']);
            Route::get('summary',        [ReportController::class, 'summaryReport']);
        });

        // Notifications
        Route::prefix('notifications')->group(function () {
            Route::get('/',                      [NotificationController::class, 'index']);
            Route::get('unread-count',           [NotificationController::class, 'unreadCount']);
            Route::patch('{notification}/read',  [NotificationController::class, 'markRead']);
            Route::post('{notification}/read',   [NotificationController::class, 'markRead']); // backward compat
            Route::patch('mark-all-read',        [NotificationController::class, 'markAllRead']);
            Route::post('mark-all-read',         [NotificationController::class, 'markAllRead']); // backward compat
        });

        // Settings — GET /settings (list) + GET /settings/{key} (show) + POST /settings (upsert)
        Route::get('settings/{key}',   [SettingController::class, 'show']);
        Route::apiResource('settings', SettingController::class)->only(['index', 'store', 'update']);


        // Events
        Route::apiResource('events', EventController::class);

        // Approval History
        Route::get('approval-history', [ApprovalHistoryController::class, 'index']);

        // Teacher Mutations
        Route::apiResource('teacher-mutations', TeacherMutationController::class);
    });

    // Users (admin-level, no tenant isolation)
    Route::middleware('role:super_admin')->group(function () {
        Route::delete('users/{user}/force', [UserController::class, 'forceDestroy']);
        Route::apiResource('users', UserController::class);
    });

    // SK Templates (global resource — no tenant isolation)
    // NOTE: /sk-templates/active must be registered before the {skTemplate} wildcard routes
    Route::get('sk-templates', [SkTemplateController::class, 'index']);
    Route::get('sk-templates/active', [SkTemplateController::class, 'active']);
    Route::get('sk-templates/{id}/download', [SkTemplateController::class, 'download']); // All authenticated users can download
    Route::middleware('role:super_admin')->group(function () {
        Route::post('sk-templates', [SkTemplateController::class, 'store']);
        Route::post('sk-templates/{id}/activate', [SkTemplateController::class, 'activate']);
        Route::delete('sk-templates/{id}', [SkTemplateController::class, 'destroy']);
    });

    // File Upload
    Route::post('files/upload', [FileUploadController::class, 'upload']);
    Route::delete('files',      [FileUploadController::class, 'delete']);
    Route::get('files/view/{path}', [FileUploadController::class, 'view'])->where('path', '.*');

    // Data Audit
    Route::post('data-audit/health-check', [DataAuditController::class, 'runHealthCheck']);

    // ── Meetings read-only (all authenticated users, operators see filtered results) ──
    Route::get('meetings', [MeetingController::class, 'index']);
    Route::get('meetings/{meeting}', [MeetingController::class, 'show']);
    Route::post('meetings/participants-from-schools', [MeetingController::class, 'participantsFromSchools']);

    // ── Meetings write operations (super_admin + admin_yayasan only) ──
    Route::middleware('role:super_admin,admin_yayasan')->group(function () {
        Route::post('meetings', [MeetingController::class, 'store']);
        Route::put('meetings/{meeting}', [MeetingController::class, 'update']);
        Route::delete('meetings/{meeting}', [MeetingController::class, 'destroy']);
        Route::post('meetings/{meeting}/participants/{participant}/check-in', [MeetingController::class, 'manualCheckIn']);
        Route::post('meetings/{meeting}/participants/{participant}/reset-check-in', [MeetingController::class, 'resetCheckIn']);
        Route::post('meetings/{meeting}/participants/{participant}/regenerate-qr', [MeetingController::class, 'regenerateQr']);
    });

    // ── WA Blast (super_admin + admin_yayasan only) ──
    Route::middleware('role:super_admin,admin_yayasan')->group(function () {
        // Blast sessions — preview-recipients must come before {id} wildcard
        Route::post('wa-blasts/preview-recipients', [WaBlastController::class, 'previewRecipients']);
        Route::get('wa-blasts', [WaBlastController::class, 'index']);
        Route::post('wa-blasts', [WaBlastController::class, 'store']);
        Route::get('wa-blasts/{id}', [WaBlastController::class, 'show']);
        Route::delete('wa-blasts/{id}', [WaBlastController::class, 'destroy']);
        Route::post('wa-blasts/{id}/retry', [WaBlastController::class, 'retry']);
        Route::get('wa-blasts/{id}/progress', [WaBlastController::class, 'progress']);

        // Message templates
        Route::get('wa-blast-templates', [WaBlastTemplateController::class, 'index']);
        Route::post('wa-blast-templates', [WaBlastTemplateController::class, 'store']);
        Route::get('wa-blast-templates/{id}', [WaBlastTemplateController::class, 'show']);
        Route::put('wa-blast-templates/{id}', [WaBlastTemplateController::class, 'update']);
        Route::delete('wa-blast-templates/{id}', [WaBlastTemplateController::class, 'destroy']);

        // Go-WA configuration — super_admin only
        Route::middleware('role:super_admin')->group(function () {
            Route::get('wa-blast-config', [WaBlastConfigController::class, 'show']);
            Route::post('wa-blast-config', [WaBlastConfigController::class, 'store']);
            Route::post('wa-blast-config/test', [WaBlastConfigController::class, 'testConnection']);
        });

        // Reports
        Route::get('meetings/{meeting}/report/pdf', [MeetingReportController::class, 'pdf']);
        Route::get('meetings/{meeting}/report/excel', [MeetingReportController::class, 'excel']);

        // ── Meeting Minutes (Notulensi) ──
        Route::get('meetings/{meeting}/minutes', [MeetingMinutesController::class, 'show']);
        Route::post('meetings/{meeting}/minutes', [MeetingMinutesController::class, 'store']);
        Route::put('meetings/{meeting}/minutes/{minutes}', [MeetingMinutesController::class, 'update']);
        Route::delete('meetings/{meeting}/minutes/{minutes}', [MeetingMinutesController::class, 'destroy']);

        // ── Meeting Photos (Foto Kegiatan) ──
        Route::get('meetings/{meeting}/photos', [MeetingPhotoController::class, 'index']);
        Route::post('meetings/{meeting}/photos', [MeetingPhotoController::class, 'store']);
        Route::get('meetings/{meeting}/photos/download', [MeetingPhotoController::class, 'download']);
        Route::delete('meetings/{meeting}/photos/{photo}', [MeetingPhotoController::class, 'destroy']);
    });

    // ── Student Statistics per Jenjang ──
    Route::middleware('role:super_admin,admin_yayasan,operator')
        ->prefix('student-statistics')
        ->group(function () {
            Route::get('/per-jenjang', [StudentStatisticsController::class, 'perJenjang']);
            Route::get('/per-jenjang/{jenjang}/madrasah', [StudentStatisticsController::class, 'madrasahByJenjang']);
            Route::get('/per-jenjang/{jenjang}/export', [StudentStatisticsController::class, 'exportRekapPerJenjang']);
            Route::get('/madrasah/{id}/per-kelas', [StudentStatisticsController::class, 'perKelas']);
            Route::get('/madrasah/{id}/per-kelas/export', [StudentStatisticsController::class, 'exportPerKelas']);
        });
});

// ── Public Meeting Check-In Routes (No Auth — Route names used for QR URL generation) ──
// Note: Self-service check-in has been removed. Check-in is only via panitia scanner.
// These routes exist so that URL::temporarySignedRoute() can generate QR URLs,
// and so participants can view their QR code on the frontend page.
Route::prefix('public/meetings')->group(function () {
    Route::get('{meeting}/check-in', function (\App\Models\Meeting $meeting, \Illuminate\Http\Request $request) {
        $participantId = $request->query('participant');
        $participant = $participantId ? \App\Models\MeetingParticipant::find($participantId) : null;
        return response()->json([
            'success' => true,
            'message' => 'Tunjukkan QR Code ini ke panitia untuk check-in.',
            'data' => [
                'meeting' => [
                    'id' => $meeting->id,
                    'title' => $meeting->title,
                    'location' => $meeting->location,
                    'started_at' => $meeting->started_at->format('Y-m-d\TH:i:s'),
                    'ended_at' => $meeting->ended_at->format('Y-m-d\TH:i:s'),
                ],
                'participant' => $participant ? [
                    'id' => $participant->id,
                    'name' => $participant->name,
                    'jabatan' => $participant->jabatan,
                    'instansi' => $participant->instansi,
                ] : null,
                'mode' => $participant ? 'personal' : 'walk_in',
            ],
        ]);
    })->name('public.meetings.check-in.show');

    Route::get('{meeting}/walk-in', function (\App\Models\Meeting $meeting) {
        return response()->json([
            'success' => true,
            'message' => 'Tunjukkan QR Code ini ke panitia untuk check-in.',
            'data' => [
                'meeting' => [
                    'id' => $meeting->id,
                    'title' => $meeting->title,
                    'location' => $meeting->location,
                    'started_at' => $meeting->started_at->format('Y-m-d\TH:i:s'),
                    'ended_at' => $meeting->ended_at->format('Y-m-d\TH:i:s'),
                ],
                'mode' => 'walk_in',
            ],
        ]);
    })->name('public.meetings.walk-in.show');
});
