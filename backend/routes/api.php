<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\SchoolController;
use App\Http\Controllers\Api\TeacherController;
use App\Http\Controllers\Api\StudentController;

// ── [SECURITY] Temporary diagnostic/migration routes REMOVED ──────────────────
// Routes removed on 2026-08-10 (Phase 1.5 Security Remediation):
//   - GET /temp-run-migrations  (artisan migrate --force without auth)
//   - GET /temp-check-nim       (NIM data leak without auth)
//   - GET /temp-fix-missing-teachers (DB write without auth)
// Use `php artisan` commands directly via server SSH/Coolify console instead.
// ──────────────────────────────────────────────────────────────────────────────

use Illuminate\Http\Request;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\SkDocumentController;
use App\Http\Controllers\Api\HeadmasterController;
use App\Http\Controllers\Api\HeadmasterRecommendationController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\NuptkSubmissionController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\FileUploadController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\DataAuditController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\ApprovalHistoryController;
use App\Http\Controllers\Api\TeacherMutationController;
use App\Http\Controllers\Api\SkTemplateController;
use App\Http\Controllers\Api\SkVerificationController;
use App\Http\Controllers\Api\TeacherVerificationController;
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
use App\Http\Controllers\Api\PublicMeetingWalkInController;
use App\Http\Controllers\Api\CompetitionController;
use App\Http\Controllers\Api\AnugerahRegistrationController;
use App\Http\Controllers\Api\PublicEventController;
use App\Http\Controllers\Api\StudentStatisticsController;
use App\Http\Controllers\Api\PublicPpdbController;
use App\Http\Controllers\Api\PpdbPeriodController;
use App\Http\Controllers\Api\PpdbManagementController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// ── [SECURITY] Temporary destructive routes REMOVED ──────────────────────────
// Routes removed on 2026-08-10 (Phase 1.5 Security Remediation):
//   - GET /temp-cleanup      (mass data modification across 7 tables without auth)
//   - GET /run-script-jenjang (artisan command execution without auth)
// Use `php artisan schools:populate-jenjang` via server SSH/Coolify console instead.
// ──────────────────────────────────────────────────────────────────────────────

// ── Public / Auth ──
Route::prefix('auth')->group(function () {
    Route::post('login',    [AuthController::class, 'login']);
    Route::post('register', [AuthController::class, 'register']);
});

// ── Public SK Verification ──
Route::get('verify/sk/{nomor}', [SkVerificationController::class, 'verifyBySk'])
    ->where('nomor', '.*');

// ── Public Teacher Verification ──
Route::get('verify/teacher/{nim}', [TeacherVerificationController::class, 'verifyByNim']);

// ── PPDB Public Portal ──
Route::prefix('ppdb')->group(function () {
    Route::get('schools',          [PublicPpdbController::class, 'getSchools']);
    Route::get('schools/{id}',     [PublicPpdbController::class, 'getSchoolDetail']);
    Route::post('register',        [PublicPpdbController::class, 'register']);
    Route::get('status',           [PublicPpdbController::class, 'checkStatus']);
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
    Route::post('staff-scan',  [\App\Http\Controllers\Api\StaffAttendanceController::class, 'scan']);
    Route::post('staff-check-qr', [\App\Http\Controllers\Api\StaffAttendanceController::class, 'checkQr']);
    Route::get('staff-settings', [\App\Http\Controllers\Api\StaffAttendanceController::class, 'publicSettings']);
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

// [SECURITY] test-minio debug route removed on 2026-08-10 (Phase 1.5 Security Remediation)

// ── Protected Routes ──
Route::middleware('auth:sanctum')->group(function () {
    // --- AUTHENTICATED ROUTES ---
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
    Route::patch('schools/{school}/sk-submission-unlock', [SchoolController::class, 'toggleSkSubmission'])
        ->middleware('role:super_admin,admin_yayasan');
    Route::patch('schools/sk-submission-reset-all', [SchoolController::class, 'resetAllSkSubmission'])
        ->middleware('role:super_admin,admin_yayasan');
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
        Route::post('teachers/import/preview', [TeacherController::class, 'importPreview']);
        Route::post('teachers/import/commit', [TeacherController::class, 'importCommit']);
        Route::post('teachers/deduplicate', [TeacherController::class, 'deduplicate']);
        Route::post('teachers/recalculate-status', [TeacherController::class, 'recalculateStatuses']);
        // NIM routes must be registered before apiResource to avoid {teacher} wildcard conflict
        Route::get('teachers/nim/generate', [TeacherController::class, 'previewNim']);
        Route::post('teachers/nim/bulk-generate', [TeacherController::class, 'bulkGenerateNim']);
        Route::post('teachers/nim/bulk-generate/preview', [TeacherController::class, 'previewBulkGenerateNim']);
        Route::patch('teachers/{teacher}/nim', [TeacherController::class, 'updateNim']);
        Route::apiResource('teachers', TeacherController::class);


        // Students
        Route::post('students/import', [StudentController::class, 'import']);
        Route::post('students/batch-transition', [StudentController::class, 'batchTransition']);
        Route::apiResource('students', StudentController::class);

        // SK Documents — specific routes MUST come before apiResource
        Route::post('sk-documents/reserve-nomor',   [SkDocumentController::class, 'reserveNomor']);
        Route::post('sk-documents/submit-request',  [SkDocumentController::class, 'submitRequest']);
        Route::post('sk-documents/bulk-request',    [SkDocumentController::class, 'bulkRequest']);
        Route::patch('sk-documents/batch-status',   [SkDocumentController::class, 'batchUpdateStatus']);
        Route::get('sk-documents-revisions', [SkDocumentController::class, 'revisions']);
        Route::get('sk-documents/{skDocument}/revisions', [SkDocumentController::class, 'revisions']);
        Route::apiResource('sk-documents', SkDocumentController::class)
            ->middleware('slow_queries');

        // Headmasters — route statis HARUS sebelum apiResource agar tidak bentrok dengan {headmaster} parameter
        Route::get('headmasters/expiring',                    [HeadmasterController::class, 'expiring']);
        Route::post('headmasters/{headmasterTenure}/approve', [HeadmasterController::class, 'approve']);
        Route::post('headmasters/{headmasterTenure}/reject',  [HeadmasterController::class, 'reject']);
        Route::apiResource('headmasters', HeadmasterController::class)->only(['index', 'show', 'store', 'update', 'destroy']);

        // NUPTK Submissions
        Route::apiResource('nuptk-submissions', NuptkSubmissionController::class)->only(['index', 'store']);
        Route::post('nuptk-submissions/{nuptkSubmission}/approve', [NuptkSubmissionController::class, 'approve']);
        Route::post('nuptk-submissions/{nuptkSubmission}/reject',  [NuptkSubmissionController::class, 'reject']);

        // Headmaster Recommendations
        Route::apiResource('headmaster-recommendations', HeadmasterRecommendationController::class)->only(['index', 'store', 'show']);
        Route::post('headmaster-recommendations/{headmasterRecommendation}/approve', [HeadmasterRecommendationController::class, 'approve']);
        Route::post('headmaster-recommendations/{headmasterRecommendation}/reject', [HeadmasterRecommendationController::class, 'reject']);

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
            Route::get('sk-belum-mengajukan',        [ReportController::class, 'skBelumMengajukan']);
            Route::get('sk-belum-mengajukan/export', [ReportController::class, 'exportSkBelumMengajukan']);
            Route::post('sk-belum-mengajukan/blast', [ReportController::class, 'blastSkBelumMengajukan']);
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
        Route::get('events/{event}/tally', [EventController::class, 'tally']);

        // Competitions (sub-resource of events)
        Route::get('events/{event}/competitions', [CompetitionController::class, 'index']);
        Route::post('events/{event}/competitions', [CompetitionController::class, 'store']);
        Route::post('events/{event}/seed-harlah97', [CompetitionController::class, 'seedHarlah97']);
        Route::get('competitions/{competition}', [CompetitionController::class, 'show']);
        Route::put('competitions/{competition}', [CompetitionController::class, 'update']);
        Route::delete('competitions/{competition}', [CompetitionController::class, 'destroy']);

        // Participants
        Route::get('competitions/{competition}/participants', [CompetitionController::class, 'participantsIndex']);
        Route::post('competitions/{competition}/participants', [CompetitionController::class, 'participantsStore']);
        Route::put('participants/{participant}', [CompetitionController::class, 'participantsUpdate']);
        Route::delete('participants/{participant}', [CompetitionController::class, 'participantsDestroy']);

        // Results
        Route::post('competitions/{competition}/results', [CompetitionController::class, 'resultsStore']);
        Route::post('competitions/{competition}/results/bulk', [CompetitionController::class, 'resultsBulkStore']);
        Route::post('competitions/{competition}/results/import', [CompetitionController::class, 'resultsImport']);

        // Jury PIN management (authenticated admin/operator)
        Route::get('competitions/{competition}/jury-pin', [CompetitionController::class, 'getJuryPin']);
        Route::post('competitions/{competition}/jury-pin', [CompetitionController::class, 'setJuryPin']);

        // Anugerah Pendidikan Registrations (Guru & Madrasah Berprestasi)
        Route::get('anugerah-registrations', [AnugerahRegistrationController::class, 'index']);
        Route::post('anugerah-registrations', [AnugerahRegistrationController::class, 'store']);
        Route::get('anugerah-registrations/{anugerahRegistration}', [AnugerahRegistrationController::class, 'show']);
        Route::put('anugerah-registrations/{anugerahRegistration}', [AnugerahRegistrationController::class, 'update']);
        Route::delete('anugerah-registrations/{anugerahRegistration}', [AnugerahRegistrationController::class, 'destroy']);
        Route::post('anugerah-registrations/{anugerahRegistration}/submit', [AnugerahRegistrationController::class, 'submit']);
        Route::post('anugerah-registrations/preview-score', [AnugerahRegistrationController::class, 'previewScore']);
        Route::post('anugerah-registrations/{anugerahRegistration}/review', [AnugerahRegistrationController::class, 'review']);

        // Approval History
        Route::get('approval-history', [ApprovalHistoryController::class, 'index']);

        // Teacher Mutations
        Route::apiResource('teacher-mutations', TeacherMutationController::class);
    });

    // Users (admin-level, no tenant isolation)
    Route::middleware('role:super_admin')->group(function () {
        Route::delete('users/{user}/force', [UserController::class, 'forceDestroy']);
        Route::apiResource('users', UserController::class);

        // Staff Management
        Route::post('staffs/{staff}/generate-qr', [\App\Http\Controllers\Api\StaffController::class, 'generateQr']);
        Route::post('staffs/{staff}/face', [\App\Http\Controllers\Api\StaffController::class, 'saveFace']);
        Route::apiResource('staffs', \App\Http\Controllers\Api\StaffController::class);

        // Staff Attendance Report
        Route::get('staff-attendances', [\App\Http\Controllers\Api\StaffAttendanceController::class, 'index']);
        Route::post('staff-attendances/manual', [\App\Http\Controllers\Api\StaffAttendanceController::class, 'storeManual']);
    });

    // Staff Self-Attendance Scan (Moved to public/attendance/staff-scan)

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
    Route::get('activity-logs', [ActivityLogController::class, 'index']);
    Route::get('activity-logs/export', [ActivityLogController::class, 'export']);

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
        Route::post('meetings/{meeting}/participants/{participant}/resend-wa', [MeetingController::class, 'resendWa']);
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

    // ── PPDB Management & Auto-Sync (super_admin, admin_yayasan, operator) ──
    Route::middleware('role:super_admin,admin_yayasan,operator,admin')
        ->prefix('ppdb')
        ->group(function () {
            Route::get('stats',                          [PpdbManagementController::class, 'stats']);
            Route::get('export',                         [PpdbManagementController::class, 'export']);
            Route::apiResource('periods',                PpdbPeriodController::class);
            Route::get('registrations',                  [PpdbManagementController::class, 'index']);
            Route::get('registrations/{id}',             [PpdbManagementController::class, 'show']);
            Route::post('registrations/{id}/verify',     [PpdbManagementController::class, 'verify']);
            Route::post('registrations/{id}/score',      [PpdbManagementController::class, 'score']);
            Route::post('registrations/{id}/reregister', [PpdbManagementController::class, 'reregister']);
        });

    // ── Student Statistics per Jenjang ──
    Route::middleware('role:super_admin,admin_yayasan,operator')
        ->prefix('student-statistics')
        ->group(function () {
            Route::get('/per-jenjang', [StudentStatisticsController::class, 'perJenjang']);
            Route::get('/per-jenjang/{jenjang}/madrasah', [StudentStatisticsController::class, 'madrasahByJenjang'])
                ->where('jenjang', '.*');
            Route::get('/per-jenjang/{jenjang}/export', [StudentStatisticsController::class, 'exportRekapPerJenjang'])
                ->where('jenjang', '.*');
            Route::get('/madrasah/{id}/per-kelas', [StudentStatisticsController::class, 'perKelas']);
            Route::get('/madrasah/{id}/per-kelas/export', [StudentStatisticsController::class, 'exportPerKelas']);
        });
});

// ── Public Events & Jury (no auth) ──────────────────────────────────────────
Route::prefix('public/events')->group(function () {
    Route::get('by-slug/{slug}', [PublicEventController::class, 'showBySlug']);
    Route::get('{event}', [PublicEventController::class, 'show']);
    // POST daftar: {idOrSlug} bisa ID angka atau slug
    Route::post('{idOrSlug}/daftar', [PublicEventController::class, 'registerByIdOrSlug']);
    Route::get('{event}/scoreboard/{competition}', [PublicEventController::class, 'scoreboard']);
});

// Jury panel (PIN-gated, no auth token needed)
Route::prefix('public/jury')->group(function () {
    Route::post('verify-pin', [PublicEventController::class, 'juryVerifyPin']);
    Route::get('{token}/participants', [PublicEventController::class, 'juryParticipants']);
    Route::post('{token}/score', [PublicEventController::class, 'juryScore']);
});

// ── Public Meeting Check-In Routes (No Auth — Route names used for QR URL generation) ──
Route::prefix('public/meetings')->group(function () {
    // GET — peserta personal: tampilkan QR code mereka (flow lama tetap berjalan)
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

    // GET — walk-in: return info rapat + geolocation settings untuk form
    Route::get('{meeting}/walk-in', function (\App\Models\Meeting $meeting) {
        // Validasi waktu: QR hanya berlaku H-24 hingga H+48
        $now = now();
        $startWindow = $meeting->started_at->copy()->subHours(24);
        $endWindow   = $meeting->ended_at->copy()->addHours(48);

        if ($now->isBefore($startWindow)) {
            return response()->json([
                'success' => false,
                'message' => 'Check-in walk-in dibuka 24 jam sebelum rapat dimulai.',
            ], 403);
        }

        if ($now->isAfter($endWindow)) {
            return response()->json([
                'success' => false,
                'message' => 'QR Code rapat sudah tidak berlaku (rapat telah berakhir).',
            ], 410);
        }

        return response()->json([
            'success' => true,
            'message' => 'Silakan isi data kehadiran Anda.',
            'data' => [
                'meeting' => [
                    'id'                       => $meeting->id,
                    'title'                    => $meeting->title,
                    'location'                 => $meeting->location,
                    'started_at'               => $meeting->started_at->format('Y-m-d\TH:i:s'),
                    'ended_at'                 => $meeting->ended_at->format('Y-m-d\TH:i:s'),
                    'geolocation_enabled'      => $meeting->geolocation_enabled,
                    'latitude'                 => $meeting->latitude,
                    'longitude'                => $meeting->longitude,
                    'geolocation_radius_meters' => $meeting->geolocation_radius_meters,
                ],
                'mode' => 'walk_in',
            ],
        ]);
    })->name('public.meetings.walk-in.show');

    // POST — walk-in: peserta submit form kehadiran sendiri
    Route::post('{meeting}/walk-in', [\App\Http\Controllers\Api\PublicMeetingWalkInController::class, 'store']);
});

// ── Emergency Backup & Restore ──
// [SECURITY 2026-08-10] Protected with authentication + super_admin role.
// These endpoints were previously unauthenticated. Now requires:
//   1. Valid Bearer token (auth:sanctum)
//   2. Role: super_admin
// To use: Login as super_admin, then call with Authorization: Bearer {token}
Route::middleware(['auth:sanctum', 'role:super_admin'])->prefix('emergency')->group(function () {
    Route::get('backup', [\App\Http\Controllers\Api\EmergencyBackupController::class, 'backup']);
    Route::post('restore', [\App\Http\Controllers\Api\EmergencyBackupController::class, 'restore']);
});
