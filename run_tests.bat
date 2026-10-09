@echo off
REM ==============================================================================
REM SIMMACI — Windows Automated Test Suite Runner
REM ==============================================================================
REM Penggunaan:
REM   run_tests.bat
REM ==============================================================================

setlocal enabledelayedexpansion
echo ================================================================
echo   SIMMACI AUTOMATED TEST & HARDENING SUITE (WINDOWS)
echo ================================================================
echo.

REM 1. Frontend Offline Unit Tests
echo [1/3] Menjalankan Frontend Unit Tests (Offline Queue & Sync)...
call npm run test:offline
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend unit test gagal!
    exit /b %ERRORLEVEL%
)

REM 2. Frontend Production Build Check
echo.
echo [2/3] Menjalankan Frontend Production Build Check...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend production build gagal!
    exit /b %ERRORLEVEL%
)

REM 3. Backend Feature Tests
echo.
echo [3/3] Menjalankan Backend Feature Tests...
cd backend
call php artisan test tests/Feature/MeetingControllerTest.php tests/Feature/MeetingMinutesControllerTest.php tests/Feature/MeetingPhotoControllerTest.php tests/Feature/MeetingReportControllerTest.php tests/Feature/PublicMeetingScannerTest.php tests/Feature/PublicMeetingWalkInTest.php
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Backend feature test gagal!
    cd ..
    exit /b %ERRORLEVEL%
)
cd ..

echo.
echo ================================================================
echo   SEMUA PENGUJIAN OTOMATIS BERHASIL LULUS 100%% (ALL PASS)
echo ================================================================
exit /b 0
