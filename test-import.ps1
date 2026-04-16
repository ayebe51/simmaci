# Test Teacher Import Endpoint

$baseUrl = "http://127.0.0.1:8000/api"

# Login sebagai super admin
Write-Host "=== Login sebagai Super Admin ===" -ForegroundColor Cyan
$loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body (@{
    email = "admin@example.com"
    password = "password"
} | ConvertTo-Json) -ContentType "application/json"

$token = $loginResponse.data.token
Write-Host "Token: $token" -ForegroundColor Green

# Test import dengan data guru
Write-Host "`n=== Test Import Guru ===" -ForegroundColor Cyan
$importData = @{
    teachers = @(
        @{
            nama = "Test Guru Import 1"
            nuptk = "1234567890123456"
            is_certified = $false
            email = "testguru1@example.com"
            phone_number = "081234567890"
        },
        @{
            nama = "Test Guru Import 2"
            nuptk = "9876543210987654"
            is_certified = $true
            email = "testguru2@example.com"
            phone_number = "081234567891"
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $importResponse = Invoke-RestMethod -Uri "$baseUrl/teachers/import" -Method Post `
        -Headers @{ Authorization = "Bearer $token" } `
        -Body $importData `
        -ContentType "application/json"
    
    Write-Host "Import Response:" -ForegroundColor Green
    $importResponse | ConvertTo-Json -Depth 10
    
    Write-Host "`nCreated: $($importResponse.created)" -ForegroundColor Green
    Write-Host "Errors: $($importResponse.errors.Count)" -ForegroundColor $(if ($importResponse.errors.Count -eq 0) { "Green" } else { "Yellow" })
    Write-Host "Summary: $($importResponse.summary)" -ForegroundColor Green
    
} catch {
    Write-Host "Error during import:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
}
