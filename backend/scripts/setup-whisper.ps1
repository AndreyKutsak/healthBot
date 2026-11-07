# setup-whisper.ps1  (ASCII-only to avoid encoding issues with PS 5.1)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-whisper.ps1 -Model turbo
#   powershell -ExecutionPolicy Bypass -File scripts\setup-whisper.ps1 -Model medium
#   powershell -ExecutionPolicy Bypass -File scripts\setup-whisper.ps1 -Model large-v3
#
# Models:
#   turbo    -> ggml-large-v3-turbo.bin  ~809 MB  (recommended)
#   medium   -> ggml-medium.bin          ~1.5 GB
#   large-v3 -> ggml-large-v3.bin        ~3.1 GB

param(
    [ValidateSet('turbo', 'medium', 'large-v3')]
    [string]$Model = 'turbo'
)

$ErrorActionPreference = 'Stop'

$backendDir = Split-Path -Parent $PSScriptRoot
$binDir     = Join-Path $backendDir 'whisper\bin'
$modelDir   = Join-Path $backendDir 'whisper\models'

$modelFileMap = @{
    'turbo'    = 'ggml-large-v3-turbo.bin'
    'medium'   = 'ggml-medium.bin'
    'large-v3' = 'ggml-large-v3.bin'
}
$modelEnvMap = @{
    'turbo'    = 'large-v3-turbo'
    'medium'   = 'medium'
    'large-v3' = 'large-v3'
}

$modelFile    = $modelFileMap[$Model]
$modelPath    = Join-Path $modelDir $modelFile
$modelEnvVal  = $modelEnvMap[$Model]

New-Item -ItemType Directory -Force -Path $binDir, $modelDir | Out-Null

# ── 1. whisper-cli.exe ────────────────────────────────────────────────────────
$cliPath = Join-Path $binDir 'whisper-cli.exe'

if (Test-Path $cliPath) {
    Write-Host "[OK] whisper-cli.exe already present: $cliPath"
} else {
    Write-Host "`n=== Downloading whisper.cpp (Windows x64) ==="

    $headers = @{ 'User-Agent' = 'health-bot-setup/1.0' }
    $release = Invoke-RestMethod 'https://api.github.com/repos/ggerganov/whisper.cpp/releases/latest' -Headers $headers
    $tag = $release.tag_name
    Write-Host "Latest release: $tag"

    # Prefer BLAS (faster CPU inference), fall back to plain x64
    $asset = $release.assets | Where-Object { $_.name -eq 'whisper-blas-bin-x64.zip' } | Select-Object -First 1
    if (-not $asset) {
        $asset = $release.assets | Where-Object { $_.name -eq 'whisper-bin-x64.zip' } | Select-Object -First 1
    }
    if (-not $asset) {
        # Generic fallback: any x64 zip that is not cublas/Win32
        $asset = $release.assets |
            Where-Object { $_.name -match 'x64\.zip$' -and $_.name -notmatch 'cublas|Win32' } |
            Select-Object -First 1
    }

    if (-not $asset) {
        Write-Host "Available assets:"
        $release.assets | ForEach-Object { Write-Host "  - $($_.name)" }
        Write-Error ("No Windows x64 zip found in release $tag.`n" +
                     "Download manually: https://github.com/ggerganov/whisper.cpp/releases/tag/$tag`n" +
                     "Extract whisper-cli.exe and DLLs to: $binDir")
    }

    $sizeMB = [Math]::Round($asset.size / 1MB, 1)
    Write-Host "Downloading $($asset.name) ($sizeMB MB)..."

    $zipPath = Join-Path $env:TEMP "whisper-$tag.zip"
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath -UseBasicParsing

    Write-Host 'Extracting...'
    $extractDir = Join-Path $env:TEMP "whisper-extract-$tag"
    if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
    Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

    Get-ChildItem -Recurse $extractDir -Include '*.exe','*.dll' |
        Copy-Item -Destination $binDir -Force

    Remove-Item $zipPath, $extractDir -Recurse -Force -ErrorAction SilentlyContinue

    if (-not (Test-Path $cliPath)) {
        Write-Error ("whisper-cli.exe not found after extraction.`n" +
                     "Copy files manually to: $binDir")
    }
    Write-Host "[OK] Binary installed: $cliPath"
}

# ── 2. Model ──────────────────────────────────────────────────────────────────
if (Test-Path $modelPath) {
    Write-Host "`n[OK] Model already downloaded: $modelPath"
} else {
    $modelUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$modelFile"
    Write-Host "`n=== Downloading model: $modelFile ==="
    Write-Host "This may take several minutes..."
    Invoke-WebRequest -Uri $modelUrl -OutFile $modelPath -UseBasicParsing
    Write-Host "[OK] Model saved: $modelPath"
}

# ── 3. .env ───────────────────────────────────────────────────────────────────
$envPath = Join-Path $backendDir '.env'
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    if ($envContent -match 'WHISPER_MODEL=') {
        $envContent = $envContent -replace 'WHISPER_MODEL=\S*', "WHISPER_MODEL=$modelEnvVal"
    } else {
        $envContent = $envContent.TrimEnd() + "`nWHISPER_MODEL=$modelEnvVal`n"
    }
    [System.IO.File]::WriteAllText($envPath, $envContent, [System.Text.Encoding]::UTF8)
    Write-Host "`n[OK] .env updated: WHISPER_MODEL=$modelEnvVal"
}

Write-Host "`n========================================="
Write-Host "Done! Model: $Model -> $modelFile"
Write-Host "Restart the bot: node src/app.js"
Write-Host "========================================="
