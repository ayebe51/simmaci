@echo off
title SIMMACI WhatsApp Gateway Server
color 0A

echo ========================================================
echo        MEMULAI SERVER WHATSAPP GATEWAY (SIMMACI)
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
echo   Selama jendela ini terbuka, notifikasi WA akan aktif.
echo.
echo   URL Webhook Anda HARI INI dan SETERUSNYA adalah:
echo   https://simmaci-gowa-tunnel.loca.lt
echo ========================================================
echo.

npx -y localtunnel --port 3000 --subdomain simmaci-gowa-tunnel
pause
