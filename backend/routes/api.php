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
            Route::get('subjects',       [AttendanceController::class, 'subjectIndex']);
            Route::post('subjects',      [AttendanceController::class, 'subjectStore']);
            Route::put('subjects/{subject}', [AttendanceController::class, 'subjectUpdate']);
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
        Route::apiResource('users', UserController::class);
    });

    // SK Templates (global resource — no tenant isolation)
    // NOTE: /sk-templates/active must be registered before the {skTemplate} wildcard routes
    Route::get('sk-templates', [SkTemplateController::class, 'index']);
    Route::get('sk-templates/active', [SkTemplateController::class, 'active']);
    Route::middleware('role:super_admin')->group(function () {
        Route::post('sk-templates', [SkTemplateController::class, 'store']);
        Route::post('sk-templates/{skTemplate}/activate', [SkTemplateController::class, 'activate']);
        Route::delete('sk-templates/{skTemplate}', [SkTemplateController::class, 'destroy']);
        Route::get('sk-templates/{skTemplate}/download', [SkTemplateController::class, 'download']);
    });

    // File Upload
    Route::post('files/upload', [FileUploadController::class, 'upload']);
    Route::delete('files',      [FileUploadController::class, 'delete']);
    Route::get('files/view/{path}', [FileUploadController::class, 'view'])->where('path', '.*');

    // Data Audit
    Route::post('data-audit/health-check', [DataAuditController::class, 'runHealthCheck']);
});
