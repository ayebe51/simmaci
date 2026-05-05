# PowerShell script untuk menjalankan command di Coolify backend container
# Container name: backend-yam0yy9a6l424v8j89hv7pqr-025135358293

$CONTAINER_NAME = "backend-yam0yy9a6l424v8j89hv7pqr-025135358293"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Mencari Sekolah dengan Status Jamiyyah Tidak Terdefinisi" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Container: $CONTAINER_NAME" -ForegroundColor Yellow
Write-Host ""

# Jalankan command
docker exec $CONTAINER_NAME php artisan school:find-undefined-jamiyyah

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Selesai!" -ForegroundColor Green
