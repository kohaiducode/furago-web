$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Furago Gemini Patch ===" -ForegroundColor Cyan
Write-Host ""

$repoRoot = git rev-parse --show-toplevel 2>$null

if (-not $repoRoot) {
    Write-Host "ERROR: Not inside a Git repository." -ForegroundColor Red
    exit 1
}

Set-Location $repoRoot

$status = git status --porcelain

if ($status) {
    Write-Host "ERROR: Git working tree is not clean." -ForegroundColor Red
    Write-Host ""
    git status --short
    exit 1
}

$clipboard = Get-Clipboard -Raw

if ([string]::IsNullOrWhiteSpace($clipboard)) {
    Write-Host "ERROR: Clipboard is empty." -ForegroundColor Red
    exit 1
}

$start = $clipboard.IndexOf("diff --git ")

if ($start -lt 0) {
    Write-Host "ERROR: No unified git diff found in clipboard." -ForegroundColor Red
    Write-Host "Ask Gemini to return a unified git diff." -ForegroundColor Yellow
    exit 1
}

$patch = $clipboard.Substring($start).Trim()

$patchPath = "$env:TEMP\furago-gemini-patch.diff"

$patch | Set-Content -Path $patchPath -Encoding utf8

Write-Host "Patch extracted successfully." -ForegroundColor Green
Write-Host ""

Write-Host "Checking patch..." -ForegroundColor Cyan

git apply --check $patchPath

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "PATCH REJECTED." -ForegroundColor Red
    Write-Host "No project files were modified." -ForegroundColor Green
    exit 1
}

Write-Host "Patch check: OK" -ForegroundColor Green
Write-Host ""

Write-Host "Applying patch..." -ForegroundColor Cyan

git apply $patchPath

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Patch application failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Patch applied successfully." -ForegroundColor Green
Write-Host ""

Write-Host "=== Modified files ===" -ForegroundColor Cyan
git status --short

Write-Host ""
Write-Host "=== Diff summary ===" -ForegroundColor Cyan
git diff --stat

Write-Host ""
Write-Host "Next: review with git diff and run the tests." -ForegroundColor Yellow
