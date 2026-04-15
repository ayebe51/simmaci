# Script to delete test SK submissions in production (PowerShell)
# Usage: .\delete-test-sk.ps1

Write-Host "=== Delete Test SK Submissions ===" -ForegroundColor Cyan
Write-Host ""

# Check if docker is available
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker not found. Please run this on the server." -ForegroundColor Red
    exit 1
}

# Check if backend container is running
$backendRunning = docker ps --filter "name=simmaci-backend" --filter "status=running" -q
if (-not $backendRunning) {
    Write-Host "❌ Backend container not running" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Backend container is running" -ForegroundColor Green
Write-Host ""

# Show options
Write-Host "Select deletion mode:" -ForegroundColor Yellow
Write-Host "1. Dry-run (show what would be deleted, no actual deletion)"
Write-Host "2. Delete pending test SK (nomor_sk starts with REQ/)"
Write-Host "3. Delete specific SK by nomor_sk"
Write-Host "4. Delete SK created after specific date"
Write-Host ""
$choice = Read-Host "Enter choice (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Running dry-run..." -ForegroundColor Yellow
        docker exec simmaci-backend php artisan sk:delete-test-submissions --dry-run
    }
    "2" {
        Write-Host ""
        Write-Host "This will delete all pending SK with nomor_sk starting with REQ/" -ForegroundColor Yellow
        docker exec simmaci-backend php artisan sk:delete-test-submissions --dry-run
        Write-Host ""
        $confirm = Read-Host "Proceed with deletion? (yes/no)"
        if ($confirm -eq "yes") {
            docker exec simmaci-backend php artisan sk:delete-test-submissions --force
            Write-Host "✓ Deletion complete" -ForegroundColor Green
        } else {
            Write-Host "Deletion cancelled" -ForegroundColor Yellow
        }
    }
    "3" {
        Write-Host ""
        $nomorSk = Read-Host "Enter nomor_sk to delete"
        Write-Host ""
        Write-Host "Preview:" -ForegroundColor Yellow
        docker exec simmaci-backend php artisan sk:delete-test-submissions --nomor_sk="$nomorSk" --dry-run
        Write-Host ""
        $confirm = Read-Host "Proceed with deletion? (yes/no)"
        if ($confirm -eq "yes") {
            docker exec simmaci-backend php artisan sk:delete-test-submissions --nomor_sk="$nomorSk" --force
            Write-Host "✓ Deletion complete" -ForegroundColor Green
        } else {
            Write-Host "Deletion cancelled" -ForegroundColor Yellow
        }
    }
    "4" {
        Write-Host ""
        $date = Read-Host "Enter date (YYYY-MM-DD)"
        Write-Host ""
        Write-Host "Preview:" -ForegroundColor Yellow
        docker exec simmaci-backend php artisan sk:delete-test-submissions --created-after="$date" --dry-run
        Write-Host ""
        $confirm = Read-Host "Proceed with deletion? (yes/no)"
        if ($confirm -eq "yes") {
            docker exec simmaci-backend php artisan sk:delete-test-submissions --created-after="$date" --force
            Write-Host "✓ Deletion complete" -ForegroundColor Green
        } else {
            Write-Host "Deletion cancelled" -ForegroundColor Yellow
        }
    }
    default {
        Write-Host "Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Cyan
