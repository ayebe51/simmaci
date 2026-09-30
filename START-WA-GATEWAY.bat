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

echo [1/1] Menyalakan Mesin Docker (WAHA Gateway)...
docker-compose -f docker-compose.waha.yml up -d
echo.

echo ========================================================
echo   SERVER SUDAH MENYALA DI LATAR BELAKANG!
echo   Notifikasi WhatsApp Yayasan Pusat sekarang aktif.
echo   Anda bisa menutup jendela hijau ini.
echo ========================================================
echo.

pause
