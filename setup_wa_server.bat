@echo off
:: ==============================================================
:: SETUP SERVER WHATSAPP (GOWA) & AUTO-SHUTDOWN
:: ==============================================================
:: HARAP JALANKAN SCRIPT INI DENGAN KLIK KANAN -> "RUN AS ADMINISTRATOR"

echo ==============================================================
echo 1. MENGATUR JADWAL OTOMATIS MATI (JAM 18:00)
echo ==============================================================
schtasks /create /tn "Server_AutoShutdown" /tr "shutdown.exe /s /t 60 /c \"Server WhatsApp akan mati otomatis dalam 1 menit\"" /sc daily /st 18:00 /f
if %errorlevel% == 0 (
    echo [v] Jadwal Auto-Shutdown berhasil dibuat!
) else (
    echo [X] GAGAL: Pastikan Anda menjalankan ini sebagai Administrator!
    pause
    exit /b
)
echo.

echo ==============================================================
echo 2. MENJALANKAN GOWA (WHATSAPP API) DI DOCKER
echo ==============================================================
echo Mengecek koneksi Docker...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] ERROR: Docker Desktop belum jalan atau belum diinstall.
    echo Silakan install dulu dari https://docs.docker.com/desktop/install/windows-install/
    echo Jika sudah diinstall, buka aplikasinya dulu sebelum lanjut.
    pause
    exit /b
)

echo.
echo Sedang mendownload dan menjalankan GoWA container...
docker run -d --name gowa --restart unless-stopped -p 3000:3000 aldinokemal/go-whatsapp-web-multidevice
if %errorlevel% == 0 (
    echo [v] GoWA berhasil dijalankan di port 3000!
) else (
    echo Container gowa mungkin sudah ada, mencoba menyalakan lagi...
    docker start gowa
)
echo.

echo ==============================================================
echo 3. MENGHUBUNGKAN KE INTERNET (CLOUDFLARE TUNNEL)
echo ==============================================================
echo Mendownload Cloudflare Tunnel (cloudflared.exe)...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'C:\cloudflared.exe'"

echo.
echo [v] SEMUA SELESAI!
echo -------------------------------------------------------------
echo Aplikasi GoWA Bapak berjalan di: http://localhost:3000
echo.
echo HARAP BACA:
echo Untuk membuat GoWA bisa diakses lewat internet terus-menerus, 
echo Bapak bisa daftar Cloudflare Tunnel gratis atau jalan perintah ini:
echo C:\cloudflared.exe tunnel --url http://localhost:3000
echo.
echo -------------------------------------------------------------
pause
