# Fix ALL files in the project that have process.env.VARIABLE! pattern

$allFiles = Get-ChildItem -Path . -Include "*.ts","*.tsx" -Recurse -File | Where-Object { $_.FullName -notmatch "node_modules" }

$count = 0
foreach ($file in $allFiles) {
    $content = Get-Content $file.FullName | Out-String
    $originalContent = $content
    
    # Replace ALL environment variable non-null assertions
    $content = $content -replace 'process\.env\.NEXT_PUBLIC_SUPABASE_URL!', 'process.env.NEXT_PUBLIC_SUPABASE_URL || '''''
    $content = $content -replace 'process\.env\.SUPABASE_SERVICE_ROLE_KEY!', 'process.env.SUPABASE_SERVICE_ROLE_KEY || '''''
    $content = $content -replace 'process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY!', 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '''''
    $content = $content -replace 'process\.env\.SUPABASE_URL!', 'process.env.SUPABASE_URL || '''''
    $content = $content -replace 'process\.env\.SUPABASE_ANON_KEY!', 'process.env.SUPABASE_ANON_KEY || '''''
    $content = $content -replace 'process\.env\.CLICKPESA_API_KEY!', 'process.env.CLICKPESA_API_KEY || '''''
    $content = $content -replace 'process\.env\.CLICKPESA_CLIENT_ID!', 'process.env.CLICKPESA_CLIENT_ID || '''''
    $content = $content -replace 'process\.env\.NEXT_PUBLIC_APP_URL!', 'process.env.NEXT_PUBLIC_APP_URL || '''''
    
    # Only write if content changed
    if ($content -ne $originalContent) {
        $content | Set-Content -Path $file.FullName
        Write-Host "Fixed: $($file.FullName)"
        $count++
    }
}

Write-Host "`n✅ Total files fixed: $count"

