# Run the full test suite locally on Windows (no cloud).
#
#   powershell -ExecutionPolicy Bypass -File scripts\run-tests.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\run-tests.ps1 -Docker
#
param([switch]$Docker)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if ($Docker) {
    docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from backend-tests
    exit $LASTEXITCODE
}

Write-Host "-- Backend (pytest) --" -ForegroundColor Cyan
python -m pip install -q -r backend/requirements-dev.txt
python -m pytest

Write-Host "`n-- Lib (vitest) --" -ForegroundColor Cyan
Push-Location lib
npm install --legacy-peer-deps --silent
npm test
npx tsc --noEmit
Pop-Location

Write-Host "`n-- Frontend (type-check) --" -ForegroundColor Cyan
Push-Location frontend
npm install --legacy-peer-deps --silent
npx tsc --noEmit
Pop-Location

Write-Host "`nAll suites passed." -ForegroundColor Green
