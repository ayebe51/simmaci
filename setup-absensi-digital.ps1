# ============================================================
# Setup Script: Absensi Digital - Clean Standalone Project
# Jalankan dari folder SIMMACI: .\setup-absensi-digital.ps1
# ============================================================

$SIMMACI = $PSScriptRoot
$TARGET   = "$env:USERPROFILE\Documents\absensi-digital"

# Refresh PATH agar gh CLI tersedia tanpa restart terminal
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
$BE_SRC   = "$SIMMACI\backend"
$FE_SRC   = "$SIMMACI\src"
$BE_DST   = "$TARGET\backend"
$FE_DST   = "$TARGET\frontend"
$REPO     = "https://github.com/ayebe51/Absensi-Digital.git"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Absensi Digital - Clean Project Setup" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ── Helper ──
function EnsureDir($path) { if (!(Test-Path $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null } }
function CopyFile($src, $dst) { if (Test-Path $src) { EnsureDir (Split-Path $dst); Copy-Item $src $dst -Force } }

# ============================================================
# STEP 1: Scaffold Laravel backend (clean)
# ============================================================
Write-Host "[1/7] Membuat struktur backend Laravel..." -ForegroundColor Yellow

$beDirs = @(
    "app\Http\Controllers\Api",
    "app\Http\Middleware",
    "app\Http\Requests\Auth",
    "app\Models\Scopes",
    "app\Traits",
    "app\Services",
    "app\Jobs",
    "database\migrations",
    "database\seeders",
    "routes",
    "config",
    "bootstrap",
    "public",
    "resources\views",
    "storage\app\public",
    "storage\framework\cache",
    "storage\framework\sessions",
    "storage\framework\views",
    "storage\logs"
)
foreach ($d in $beDirs) { EnsureDir "$BE_DST\$d" }

# ── Copy core Laravel files ──
$coreFiles = @(
    "artisan", "composer.json", "composer.lock",
    "phpunit.xml", ".gitignore", ".gitattributes", ".editorconfig"
)
foreach ($f in $coreFiles) { CopyFile "$BE_SRC\$f" "$BE_DST\$f" }

# Copy directories
foreach ($dir in @("bootstrap", "config", "public", "resources")) {
    if (Test-Path "$BE_SRC\$dir") {
        Copy-Item "$BE_SRC\$dir" "$BE_DST\$dir" -Recurse -Force
    }
}

# ── Copy only attendance-relevant PHP files ──

# Controllers
$controllers = @("AttendanceController.php", "AuthController.php", "SchoolController.php",
                 "TeacherController.php", "StudentController.php")
foreach ($c in $controllers) {
    CopyFile "$BE_SRC\app\Http\Controllers\Api\$c" "$BE_DST\app\Http\Controllers\Api\$c"
}
CopyFile "$BE_SRC\app\Http\Controllers\Controller.php" "$BE_DST\app\Http\Controllers\Controller.php"

# Middleware
foreach ($m in @("CheckRole.php", "TenantScope.php", "EnsureTenantIsValid.php", "LogApiRequests.php")) {
    CopyFile "$BE_SRC\app\Http\Middleware\$m" "$BE_DST\app\Http\Middleware\$m"
}

# Requests
foreach ($r in @("Auth\LoginRequest.php", "Auth\RegisterRequest.php")) {
    CopyFile "$BE_SRC\app\Http\Requests\$r" "$BE_DST\app\Http\Requests\$r"
}

# Models
$models = @("User.php", "School.php", "Teacher.php", "Student.php",
            "TeacherAttendance.php", "StudentAttendanceLog.php",
            "AttendanceSetting.php", "LessonSchedule.php",
            "SchoolClass.php", "Subject.php", "AttendanceArchive.php",
            "ActivityLog.php")
foreach ($m in $models) { CopyFile "$BE_SRC\app\Models\$m" "$BE_DST\app\Models\$m" }
CopyFile "$BE_SRC\app\Models\Scopes\TenantScope.php" "$BE_DST\app\Models\Scopes\TenantScope.php"

# Traits
foreach ($t in @("HasTenantScope.php", "AuditLogTrait.php", "ApiResponse.php")) {
    CopyFile "$BE_SRC\app\Traits\$t" "$BE_DST\app\Traits\$t"
}

# Services
CopyFile "$BE_SRC\app\Services\AuthService.php" "$BE_DST\app\Services\AuthService.php"

# Repositories (needed by AuthService)
if (Test-Path "$BE_SRC\app\Repositories") {
    Copy-Item "$BE_SRC\app\Repositories" "$BE_DST\app\Repositories" -Recurse -Force
}

# Migrations — only attendance-related
$migrations = @(
    "0000_01_01_000000_create_schools_table.php",
    "0001_01_01_000000_create_users_table.php",
    "0001_01_01_000001_create_cache_table.php",
    "0001_01_01_000002_create_jobs_table.php",
    "2024_01_02_000001_create_teachers_table.php",
    "2024_01_02_000002_create_students_table.php",
    "2024_01_02_000006_create_attendance_tables.php",
    "2026_03_13_064235_create_activity_logs_table.php",
    "2026_03_14_023534_create_attendance_archives_table.php",
    "2026_03_14_034142_create_personal_access_tokens_table.php",
    "2026_04_15_000001_add_performance_indexes.php"
)
foreach ($m in $migrations) {
    CopyFile "$BE_SRC\database\migrations\$m" "$BE_DST\database\migrations\$m"
}

# Seeders
if (Test-Path "$BE_SRC\database\seeders") {
    Copy-Item "$BE_SRC\database\seeders" "$BE_DST\database\seeders" -Recurse -Force
}

Write-Host "  Backend files copied (clean)" -ForegroundColor Green

# ============================================================
# STEP 2: Buat routes/api.php yang bersih (hanya absensi)
# ============================================================
Write-Host "`n[2/7] Membuat routes/api.php..." -ForegroundColor Yellow

$apiRoutes = @'
<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\SchoolController;
use App\Http\Controllers\Api\TeacherController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\AttendanceController;

// ── Public Auth ──
Route::prefix('auth')->group(function () {
    Route::post('login',    [AuthController::class, 'login']);
    Route::post('register', [AuthController::class, 'register']);
});

// ── Protected Routes ──
Route::middleware('auth:sanctum')->group(function () {
    Route::post('auth/logout',          [AuthController::class, 'logout']);
    Route::get('auth/user',             [AuthController::class, 'user']);
    Route::post('auth/change-password', [AuthController::class, 'changePassword']);

    // Schools
    Route::get('schools/autocomplete', [SchoolController::class, 'autocomplete']);
    Route::apiResource('schools', SchoolController::class);

    // Tenant-scoped routes
    Route::middleware('tenant')->group(function () {
        // Teachers
        Route::apiResource('teachers', TeacherController::class);

        // Students
        Route::apiResource('students', StudentController::class);

        // Attendance
        Route::prefix('attendance')->group(function () {
            Route::get('teacher',              [AttendanceController::class, 'teacherIndex']);
            Route::post('teacher',             [AttendanceController::class, 'teacherStore']);
            Route::get('student-logs',         [AttendanceController::class, 'studentLogIndex']);
            Route::post('student-logs',        [AttendanceController::class, 'studentLogStore']);
            Route::post('qr-scan',             [AttendanceController::class, 'qrScan']);
            Route::get('student-report',       [AttendanceController::class, 'studentReport']);
            Route::get('settings',             [AttendanceController::class, 'settingsShow']);
            Route::post('settings',            [AttendanceController::class, 'settingsUpdate']);
            Route::post('check-wa',            [AttendanceController::class, 'checkWaConnection']);
        });

        // Master data attendance
        Route::get('subjects',          [AttendanceController::class, 'subjectIndex']);
        Route::post('subjects',         [AttendanceController::class, 'subjectStore']);
        Route::put('subjects/{subject}',[AttendanceController::class, 'subjectUpdate']);

        Route::get('classes',           [AttendanceController::class, 'classIndex']);
        Route::post('classes',          [AttendanceController::class, 'classStore']);
        Route::put('classes/{class}',   [AttendanceController::class, 'classUpdate']);

        Route::get('lesson-schedules',  [AttendanceController::class, 'scheduleIndex']);
        Route::post('lesson-schedules', [AttendanceController::class, 'scheduleStore']);
    });
});
'@
Set-Content -Path "$BE_DST\routes\api.php" -Value $apiRoutes
Write-Host "  routes/api.php created" -ForegroundColor Green

# ============================================================
# STEP 3: Buat .env
# ============================================================
Write-Host "`n[3/7] Membuat .env..." -ForegroundColor Yellow

$env = @'
APP_NAME="Absensi Digital"
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000

LOG_CHANNEL=stack
LOG_LEVEL=debug

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=absensi_digital
DB_USERNAME=postgres
DB_PASSWORD=

CACHE_DRIVER=database
QUEUE_CONNECTION=database
SESSION_DRIVER=database

SANCTUM_STATEFUL_DOMAINS=localhost:5173,localhost:3000
FRONTEND_URL=http://localhost:5173

# WhatsApp Gateway
WA_GATEWAY_DRIVER=fonnte
WA_GATEWAY_URL=
WA_GATEWAY_TOKEN=
WA_DEVICE_ID=
'@
Set-Content -Path "$BE_DST\.env" -Value $env
Set-Content -Path "$BE_DST\.env.example" -Value $env
Write-Host "  .env created" -ForegroundColor Green

# ============================================================
# STEP 4: Setup Frontend
# ============================================================
Write-Host "`n[4/7] Setup frontend React..." -ForegroundColor Yellow

EnsureDir "$FE_DST\src\features\attendance"
EnsureDir "$FE_DST\src\lib"
EnsureDir "$FE_DST\src\components\ui"

# Attendance pages
Copy-Item "$FE_SRC\features\attendance\*" "$FE_DST\src\features\attendance\" -Recurse -Force

# api.ts
CopyFile "$FE_SRC\lib\api.ts" "$FE_DST\src\lib\api.ts"

# UI components
Copy-Item "$FE_SRC\components\ui\*" "$FE_DST\src\components\ui\" -Recurse -Force

# Config files
foreach ($f in @("package.json","vite.config.ts","tsconfig.json","index.html","components.json")) {
    CopyFile "$SIMMACI\$f" "$FE_DST\$f"
}
foreach ($f in @("tailwind.config.js","postcss.config.js","tsconfig.app.json","tsconfig.node.json")) {
    CopyFile "$SIMMACI\$f" "$FE_DST\$f"
}

# index.css
CopyFile "$FE_SRC\index.css" "$FE_DST\src\index.css"

# .env
Set-Content -Path "$FE_DST\.env.example" -Value "VITE_API_URL=http://localhost:8000/api"
Set-Content -Path "$FE_DST\.env.local"   -Value "VITE_API_URL=http://localhost:8000/api"

Write-Host "  Frontend files copied" -ForegroundColor Green

# ============================================================
# STEP 5: README + .gitignore
# ============================================================
Write-Host "`n[5/7] Membuat README dan .gitignore..." -ForegroundColor Yellow

$readme = @'
# Absensi Digital

SaaS sistem absensi digital multi-sekolah.

## Fitur
- Absensi guru & siswa (manual + QR scan)
- Geotagging validasi lokasi
- Face Recognition (face-api.js)
- Notifikasi WhatsApp otomatis ke wali murid saat Alpha
- Multi-tenancy (banyak sekolah)
- Laporan bulanan + export Excel

## Tech Stack
- **Backend**: Laravel 12, PostgreSQL, Sanctum, Queue
- **Frontend**: React 19, Vite, TypeScript, Tailwind, Shadcn/UI
- **WA**: Fonnte / GoWA

## Setup

### Backend
```bash
cd backend
composer install
cp .env.example .env   # isi DB_* dan APP_KEY
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Roadmap
- [ ] Face Recognition (face-api.js)
- [ ] Geotagging radius validation
- [ ] WA auto-notif Alpha → wali murid
- [ ] Real-time dashboard (Laravel Reverb)
- [ ] PWA support
'@
Set-Content -Path "$TARGET\README.md" -Value $readme

$gitignore = @'
backend/vendor/
backend/.env
backend/storage/logs/*.log
backend/storage/framework/cache/
backend/storage/framework/sessions/
backend/storage/framework/views/
backend/.phpunit.result.cache
frontend/node_modules/
frontend/dist/
frontend/.env.local
.DS_Store
Thumbs.db
'@
Set-Content -Path "$TARGET\.gitignore" -Value $gitignore
Write-Host "  README.md + .gitignore created" -ForegroundColor Green

# ============================================================
# STEP 6: Git init + push
# ============================================================
Write-Host "`n[6/7] Git init dan push ke GitHub..." -ForegroundColor Yellow

Set-Location $TARGET
git init
git add .
git commit -m "feat: initial commit - absensi digital standalone

Stack: Laravel 12 + React 19 + PostgreSQL
Features: QR attendance, multi-school SaaS, WA notif
Roadmap: face recognition, geotagging"

git branch -M main
git remote add origin $REPO
git push -u origin main

# ============================================================
# STEP 7: Done
# ============================================================
Write-Host "`n[7/7] Selesai!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Repo: $REPO" -ForegroundColor White
Write-Host "  Folder: $TARGET" -ForegroundColor White
Write-Host "========================================`n" -ForegroundColor Cyan
Write-Host "Langkah selanjutnya:" -ForegroundColor Yellow
Write-Host "  cd $BE_DST" -ForegroundColor White
Write-Host "  composer install" -ForegroundColor White
Write-Host "  # Edit .env (DB credentials)" -ForegroundColor DarkGray
Write-Host "  php artisan key:generate" -ForegroundColor White
Write-Host "  php artisan migrate" -ForegroundColor White
Write-Host "  php artisan serve" -ForegroundColor White
Write-Host ""
Write-Host "  cd $FE_DST" -ForegroundColor White
Write-Host "  npm install" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor White
