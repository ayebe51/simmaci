@echo off
chcp 65001 >nul
title Pindahkan Cache Windows Update ke Drive D

echo ========================================================
echo   BANTUAN OTOMATIS: PINDAHKAN UPDATE KE DRIVE D:
echo ========================================================
echo.

:: 1. Cek apakah dijalankan sebagai Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [PERHATIAN] Script ini butuh izin Administrator!
    echo.
    echo CARA MENJALANKAN:
    echo 1. Tutup jendela ini.
    echo 2. Klik KANAN pada file ini (pindahkan-update-ke-D.bat).
    echo 3. Pilih "Run as administrator" (atau "Jalankan sebagai administrator").
    echo.
    echo ========================================================
    pause
    exit /b
)

echo [1/5] Membebaskan ruang di C: dengan mematikan hibernate...
powercfg -h off >nul 2>&1
echo       -> Berhasil (biasanya langsung membebaskan 8 - 16 GB di C:).

echo.
echo [2/5] Menghentikan sementara layanan Windows Update...
net stop wuauserv >nul 2>&1
net stop bits >nul 2>&1
echo       -> Layanan dihentikan.

echo.
echo [3/5] Menyiapkan folder baru di D:\WindowsUpdateDownload...
if not exist "D:\WindowsUpdateDownload" (
    mkdir "D:\WindowsUpdateDownload"
)
echo       -> Folder di Drive D siap.

echo.
echo [4/5] Menghubungkan jalur download C: ke Drive D:...
if exist "C:\Windows\SoftwareDistribution\Download" (
    rmdir /S /Q "C:\Windows\SoftwareDistribution\Download"
)
mklink /J "C:\Windows\SoftwareDistribution\Download" "D:\WindowsUpdateDownload"

echo.
echo [5/5] Menyalakan kembali layanan Windows Update...
net start wuauserv >nul 2>&1
net start bits >nul 2>&1
echo       -> Layanan kembali aktif.

echo.
echo ========================================================
echo [SELESAI!] 
echo Semua file download update sekarang otomatis masuk ke D:
echo dan Drive C: Anda sudah lebih lega.
echo.
echo Silakan buka:
echo Settings -> Windows Update -> lalu klik "Check for updates" / "Retry".
echo ========================================================
echo.
pause
