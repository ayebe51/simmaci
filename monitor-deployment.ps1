# SK Submission Bugfix - Deployment Monitor (PowerShell)
# Usage: .\monitor-deployment.ps1

Write-Host "=== SIMMACI Deployment Monitor ===" -ForegroundColor Cyan
Write-Host "Monitoring SK Submission Bugfix Deployment"
Write-Host "Commit: 6f2c488"
Write-Host ""

# Check if docker is available
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker not found. Please run this on the server." -ForegroundColor Red
    exit 1
}

Write-Host "=== 1. Container Status ===" -ForegroundColor Yellow
docker ps --filter "name=simmaci" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Write-Host ""

Write-Host "=== 2. Backend Health Check ===" -ForegroundColor Yellow
$backendRunning = docker ps --filter "name=simmaci-backend" --filter "status=running" -q
if ($backendRunning) {
    Write-Host "✓ Backend container is running" -ForegroundColor Green
    
    # Check if Laravel is responding
    $laravelVersion = docker exec simmaci-backend php artisan --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Laravel is responding: $laravelVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Laravel not responding" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Backend container not running" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== 3. Recent Backend Logs (Last 20 lines) ===" -ForegroundColor Yellow
$logs = docker logs simmaci-backend --tail 20 2>&1
$errors = $logs | Select-String -Pattern "(error|Error|ERROR|exception|Exception|EXCEPTION|failed|Failed|FAILED)"
if ($errors) {
    $errors | ForEach-Object { Write-Host $_.Line -ForegroundColor Red }
} else {
    Write-Host "No errors found in recent logs" -ForegroundColor Green
}
Write-Host ""

Write-Host "=== 4. Laravel Error Logs (Last 10 entries) ===" -ForegroundColor Yellow
try {
    docker exec simmaci-backend tail -n 10 storage/logs/laravel.log 2>$null
} catch {
    Write-Host "⚠ Could not read Laravel logs" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "=== 5. Database Connection Test ===" -ForegroundColor Yellow
try {
    docker exec simmaci-backend php artisan tinker --execute="echo 'DB Connection: ' . (DB::connection()->getPdo() ? 'OK' : 'FAILED');" 2>$null
} catch {
    Write-Host "❌ Database connection test failed" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== 6. Test Suite Status ===" -ForegroundColor Yellow
Write-Host "Running tests..."
$testOutput = docker exec simmaci-backend php artisan test --filter=SkSubmission 2>&1
$testOutput | Select-Object -Last 5
Write-Host ""

Write-Host "=== Monitor Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "To watch logs in real-time:" -ForegroundColor Yellow
Write-Host "  docker logs -f simmaci-backend"
Write-Host ""
Write-Host "To check Laravel logs:" -ForegroundColor Yellow
Write-Host "  docker exec simmaci-backend tail -f storage/logs/laravel.log"
Write-Host ""
Write-Host "To run full test suite:" -ForegroundColor Yellow
Write-Host "  docker exec simmaci-backend php artisan test"
