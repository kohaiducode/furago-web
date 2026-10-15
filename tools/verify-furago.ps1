$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Furago Verification ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] Running tests..." -ForegroundColor Cyan
npm test
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tests FAILED." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "[2/4] Running TypeScript..." -ForegroundColor Cyan
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Host "TypeScript FAILED." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "[3/4] Running ESLint..." -ForegroundColor Cyan
npm run lint
if ($LASTEXITCODE -ne 0) {
    Write-Host "ESLint FAILED." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "[4/4] Running production build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build FAILED." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "FURAGO VERIFICATION PASSED" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""