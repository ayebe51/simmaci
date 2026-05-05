# PowerShell script untuk menjalankan command di production server
# 
# Usage:
#   1. Edit $SSH_HOST, $SSH_USER, dan $SSH_PORT sesuai server Anda
#   2. Jalankan: .\scripts\run-production-command.ps1
#
# Requirements:
#   - OpenSSH Client (sudah built-in di Windows 10/11)
#   - Akses SSH ke server production

# ═══════════════════════════════════════════════════════════
# KONFIGURASI - Edit sesuai server production Anda
# ═══════════════════════════════════════════════════════════
$SSH_HOST = "your-production-server.com"  # Ganti dengan IP atau domain server
$SSH_USER = "root"                         # Ganti dengan username SSH
$SSH_PORT = "22"                           # Port SSH (default 22)
$CONTAINER_NAME = "simmaci-backend"        # Nama container backend

# ═══════════════════════════════════════════════════════════
# SCRIPT - Jangan edit bagian ini
# ═══════════════════════════════════════════════════════════

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Menjalankan Command di Production Server" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server: $SSH_USER@$SSH_HOST`:$SSH_PORT" -ForegroundColor Yellow
Write-Host "Container: $CONTAINER_NAME" -ForegroundColor Yellow
Write-Host ""
Write-Host "Command: php artisan school:find-undefined-jamiyyah" -ForegroundColor Green
Write-Host ""
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host ""

# Cek apakah SSH tersedia
$sshCommand = Get-Command ssh -ErrorAction SilentlyContinue
if (-not $sshCommand) {
    Write-Host "ERROR: SSH client tidak ditemukan!" -ForegroundColor Red
    Write-Host "Install OpenSSH Client terlebih dahulu:" -ForegroundColor Yellow
    Write-Host "  Settings > Apps > Optional Features > Add a feature > OpenSSH Client" -ForegroundColor Yellow
    exit 1
}

# Jalankan command via SSH
$command = "docker exec $CONTAINER_NAME php artisan school:find-undefined-jamiyyah"
ssh -p $SSH_PORT "$SSH_USER@$SSH_HOST" $command

Write-Host ""
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host "Selesai!" -ForegroundColor Green
Write-Host ""

# Tanya apakah ingin menyimpan output ke file
$save = Read-Host "Simpan output ke file? (y/n)"
if ($save -eq "y" -or $save -eq "Y") {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $outputFile = "scripts/output_$timestamp.txt"
    
    Write-Host "Menjalankan ulang dan menyimpan ke $outputFile..." -ForegroundColor Yellow
    ssh -p $SSH_PORT "$SSH_USER@$SSH_HOST" $command | Out-File -FilePath $outputFile -Encoding UTF8
    
    Write-Host "Output disimpan ke: $outputFile" -ForegroundColor Green
    
    # Buka file
    $open = Read-Host "Buka file? (y/n)"
    if ($open -eq "y" -or $open -eq "Y") {
        notepad $outputFile
    }
}
