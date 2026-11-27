@echo off
chcp 65001 >nul
title Pembersih Darurat & Cek Ukuran Drive C

echo ================================================================
echo          PEMBERSIH DARURAT DRIVE C (SISA KRITIS 200MB)
echo ================================================================
echo.

:: Cek Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [PERHATIAN] Harap jalankan sebagai Administrator:
    echo Klik kanan file ini -> "Run as administrator"
    echo.
    pause
    exit /b
)

echo [1/4] Mengosongkan Keranjang Sampah (Recycle Bin)...
powershell -NoProfile -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"
echo       -> Selesai.

echo.
echo [2/4] Membersihkan File Sampah Sementara (Temp)...
del /s /f /q "%temp%\*.*" >nul 2>&1
for /d %%p in ("%temp%\*.*") do rmdir "%%p" /s /q >nul 2>&1
del /s /f /q "C:\Windows\Temp\*.*" >nul 2>&1
for /d %%p in ("C:\Windows\Temp\*.*") do rmdir "%%p" /s /q >nul 2>&1
echo       -> Selesai membersihkan file temp.

echo.
echo [3/4] Membersihkan Cache Delivery Optimization Windows...
net stop dosvc >nul 2>&1
del /s /f /q "C:\Windows\SoftwareDistribution\DeliveryOptimization\*.*" >nul 2>&1
net start dosvc >nul 2>&1
echo       -> Selesai.

echo.
echo [4/4] Menganalisis folder-folder besar di user Anda...
echo       (Mohon tunggu sebentar...)
echo.
powershell -NoProfile -Command ^
  "$paths = @(" ^
  "  (Join-Path $env:USERPROFILE 'Downloads')," ^
  "  (Join-Path $env:USERPROFILE '.android')," ^
  "  (Join-Path $env:USERPROFILE '.conda')," ^
  "  (Join-Path $env:USERPROFILE 'AppData\Local\Docker')," ^
  "  (Join-Path $env:USERPROFILE 'AppData\Local\Packages')," ^
  "  (Join-Path $env:USERPROFILE 'Desktop')," ^
  "  (Join-Path $env:USERPROFILE 'Videos')" ^
  ");" ^
  "foreach ($p in $paths) {" ^
  "  if (Test-Path $p) {" ^
  "    $s = (Get-ChildItem -Path $p -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum;" ^
  "    $gb = [math]::Round($s/1GB, 2);" ^
  "    Write-Host ('   -> ' + $p + ' : ' + $gb + ' GB') -ForegroundColor Yellow;" ^
  "  }" ^
  "};" ^
  "$drive = Get-PSDrive C;" ^
  "$freeGB = [math]::Round($drive.Free/1GB, 2);" ^
  "Write-Host ('`n=== RUANG KOSONG DRIVE C SEKARANG: ' + $freeGB + ' GB ===') -ForegroundColor Green;"

echo.
echo ================================================================
echo Selesai! Periksa hasil di atas untuk melihat folder apa yang
echo memakan ukuran paling besar (GB).
echo ================================================================
pause
