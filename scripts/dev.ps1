# Start backend (FastAPI, port 8000) and frontend (Next.js, port 3000) locally.
#
#   powershell -ExecutionPolicy Bypass -File scripts\dev.ps1
#
# Both run in the same window. Ctrl-C stops both.
# Stale processes holding :3000 / :8000 (or the Next dev lock) are killed first.

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$root = (Get-Location).Path

function Stop-Tree([int]$ParentPid) {
    # Kill a process and all of its descendants (npm.cmd -> node -> next dev)
    try {
        $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ParentPid" -ErrorAction SilentlyContinue
        foreach ($c in $children) { Stop-Tree $c.ProcessId }
        Stop-Process -Id $ParentPid -Force -ErrorAction SilentlyContinue
    } catch {}
}

function Free-Port([int]$Port) {
    $pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($p in $pids) {
        Write-Host "  freeing :$Port (pid $p)" -ForegroundColor DarkYellow
        Stop-Tree $p
    }
}

Write-Host "-- Clearing stale processes on :8000 and :3000 --" -ForegroundColor Cyan
Free-Port 8000
Free-Port 3000
# Remove Next.js dev lock if it points at a now-dead PID (safe to delete; Next recreates it)
$lock = Join-Path $root "frontend\.next\dev\next-dev.lock"
if (Test-Path $lock) { Remove-Item $lock -Force -ErrorAction SilentlyContinue }

Write-Host "-- Starting backend (uvicorn :8000) --"  -ForegroundColor Cyan
$backend = Start-Process -FilePath "python" `
    -ArgumentList "-m","uvicorn","backend.main:app","--reload","--port","8000" `
    -WorkingDirectory $root `
    -NoNewWindow -PassThru

Write-Host "-- Starting frontend (next dev :3000) --" -ForegroundColor Cyan
$frontend = Start-Process -FilePath "npm.cmd" `
    -ArgumentList "run","dev" `
    -WorkingDirectory (Join-Path $root "frontend") `
    -NoNewWindow -PassThru

Write-Host ""
Write-Host "Backend  -> http://localhost:8000  (docs at /docs)" -ForegroundColor Green
Write-Host "Frontend -> http://localhost:3000" -ForegroundColor Green
Write-Host "Press Ctrl-C to stop both." -ForegroundColor Yellow
Write-Host ""

try {
    while ($true) {
        if ($backend.HasExited)  { Write-Host "Backend exited (code $($backend.ExitCode))"  -ForegroundColor Red; break }
        if ($frontend.HasExited) { Write-Host "Frontend exited (code $($frontend.ExitCode))" -ForegroundColor Red; break }
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host "`n-- Shutting down --" -ForegroundColor Cyan
    foreach ($p in @($backend, $frontend)) {
        if ($p -and -not $p.HasExited) { Stop-Tree $p.Id }
    }
    # Belt-and-braces: anything still listening on the ports
    Free-Port 8000
    Free-Port 3000
}
