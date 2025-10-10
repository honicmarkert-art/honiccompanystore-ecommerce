# Fix ALL createClient calls at module level to use conditional creation

$files = Get-ChildItem -Path "app\api" -Filter "route.ts" -Recurse -File

foreach ($file in $files) {
    $content = Get-Content $file.FullName | Out-String
    $originalContent = $content
    
    # Pattern 1: const supabase = createClient(url, key)
    # Replace with: const supabase = url && key ? createClient(url, key) : null as any
    
    $pattern = '(?s)const supabase = createClient\(\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL \|\| '''',\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY \|\| ''''\s*\)'
    $replacement = 'const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''''`nconst supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''''`n`nconst supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null as any'
    
    $content = $content -replace $pattern, $replacement
    
    # Only write if content changed
    if ($content -ne $originalContent) {
        $content | Set-Content -Path $file.FullName
        Write-Host "Fixed: $($file.Name)"
    }
}

Write-Host "`nDone!"

