# Generate encryption key using PowerShell
# Run: .\scripts\generate-key.ps1

$key = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🔐 Secure Encryption Key Generated" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Add this to your .env.local file:" -ForegroundColor Yellow
Write-Host ""
Write-Host "PAYOUT_ENCRYPTION_KEY=$key" -ForegroundColor White
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  IMPORTANT SECURITY NOTES:" -ForegroundColor Red
Write-Host "   1. Keep this key SECRET - never commit it to version control" -ForegroundColor Yellow
Write-Host "   2. Store it securely in your environment variables" -ForegroundColor Yellow
Write-Host "   3. Use different keys for development and production" -ForegroundColor Yellow
Write-Host "   4. If the key is lost, encrypted data cannot be recovered" -ForegroundColor Yellow
Write-Host ""


