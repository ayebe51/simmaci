@echo off
title SIMMACI WhatsApp Gateway Server (PUSAT)
color 0A

echo ========================================================
echo   MEMULAI SERVER WHATSAPP GATEWAY (YAYASAN PUSAT)
echo ========================================================
echo.
echo Sistem sedang menyalakan Docker dan Terowongan Internet...
echo Pastikan aplikasi Docker Desktop sudah dalam keadaan RUNNING!
echo.

cd /d "d:\SIMMACI"

echo [1/2] Menyalakan Docker Container (GoWA)...
docker-compose up -d
echo.

echo [2/2] Membuka Terowongan ke Internet (Localtunnel)...
echo.
echo ========================================================
echo   PENTING: JANGAN TUTUP JENDELA HITAM INI!
echo   Selama PC Yayasan ini menyala, notifikasi dari SEMUA
echo   Cabang Madrasah akan terkirim.
echo.
echo   Silakan Copy URL di bawah ini ke seluruh pengaturan
echo   Madrasah di halaman admin SIMMACI:
echo   https://simmaci-gowa-pusat.loca.lt
echo ========================================================
echo.

npx -y localtunnel --port 3000 --subdomain simmaci-gowa-pusat
pause
