# Start Form Engine in Mode B -- local Ollama LLM + few-shot exemplars.
#
#   powershell -ExecutionPolicy Bypass -File scripts\dev-local-ai.ps1
#
# Hybrid setup (matches scripts\dev.ps1 patterns):
#   - api + ollama run in Docker (so the api container can talk to ollama by name)
#   - frontend runs bare-metal via 'npm run dev' so the @form-engine/* tsconfig
#     alias to ../lib/src/* resolves on the host filesystem
#     (the web Dockerfile can't see ../lib because its build context is ./frontend)
#
# Override the model:        $env:OLLAMA_MODEL = "llama3.1:8b"
# Use a fine-tuned model:    $env:OLLAMA_MODEL = "form-engine-qwen"

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$root = (Get-Location).Path

$model = if ($env:OLLAMA_MODEL) { $env:OLLAMA_MODEL } else { "qwen2.5-coder:7b" }
$env:LLM_PROVIDER = "ollama"
$env:OLLAMA_MODEL = $model
# The api container needs to reach ollama by service name on the compose network.
$env:OLLAMA_BASE_URL = "http://ollama:11434"

Write-Host "-- Mode B: local Ollama LLM --" -ForegroundColor Cyan
Write-Host "   provider = ollama"           -ForegroundColor DarkGray
Write-Host "   model    = $model"           -ForegroundColor DarkGray
Write-Host ""

# Re-used from dev.ps1 -- kill anything holding our ports.
function Stop-Tree([int]$ParentPid) {
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

# 1. Docker reachable?
try { docker info --format '{{.ServerVersion}}' | Out-Null }
catch {
    Write-Host "ERROR: Docker is not running. Start Docker Desktop and retry." -ForegroundColor Red
    exit 1
}

# 2. Free the host port we'll bind for the frontend.
Write-Host "-- Clearing stale process on :3000 --" -ForegroundColor Cyan
Free-Port 3000
$lock = Join-Path $root "frontend\.next\dev\next-dev.lock"
if (Test-Path $lock) { Remove-Item $lock -Force -ErrorAction SilentlyContinue }

# 3. Bring up only api + ollama (skip the broken web container intentionally).
Write-Host "-- Starting api + ollama containers --" -ForegroundColor Cyan
docker compose --profile local-ai up -d --build api ollama
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 4. Wait for Ollama to be reachable before pulling.
Write-Host "-- Waiting for Ollama daemon on :11434 --" -ForegroundColor Cyan
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
    try {
        Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 2 | Out-Null
        break
    } catch { Start-Sleep -Seconds 2 }
}
if ((Get-Date) -ge $deadline) {
    Write-Host "ERROR: Ollama did not come up within 60s. Check: docker compose logs ollama" -ForegroundColor Red
    exit 1
}

# 5. Pull the model if it isn't already present.
$installed = docker compose exec -T ollama ollama list 2>$null
if ($installed -match [regex]::Escape($model)) {
    Write-Host "   model '$model' already pulled" -ForegroundColor DarkGray
} else {
    Write-Host "-- Pulling $model (one-time, ~5GB) --" -ForegroundColor Cyan
    docker compose exec -T ollama ollama pull $model
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: model pull failed." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

# 6. Sanity-check the wiring (also confirms the api container restarted with
#    the new env vars).
try {
    $cfg = Invoke-RestMethod -Uri "http://localhost:8000/api/ai/config" -TimeoutSec 5
    Write-Host ""
    Write-Host "-- /api/ai/config --"        -ForegroundColor Cyan
    Write-Host "   provider:   $($cfg.provider)"   -ForegroundColor Green
    Write-Host "   model:      $($cfg.model)"      -ForegroundColor Green
    Write-Host "   configured: $($cfg.configured)" -ForegroundColor Green
} catch {
    Write-Host "   (api not yet ready -- 'docker compose logs api' if it stays down)" -ForegroundColor DarkYellow
}

# 6b. Warm up the model -- the very first call after pull has to load 5GB into
#     RAM/VRAM and can take 60-90s on CPU. Doing it here means the first user
#     request from the chat UI is fast.
Write-Host ""
Write-Host "-- Warming up model (first load can take ~60s on CPU) --" -ForegroundColor Cyan
$warmBody = @{
    model    = $model
    messages = @(@{ role = "user"; content = "hi" })
    stream   = $false
} | ConvertTo-Json -Compress
try {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    Invoke-RestMethod -Method Post `
        -Uri "http://localhost:11434/v1/chat/completions" `
        -ContentType "application/json" `
        -Body $warmBody `
        -TimeoutSec 240 | Out-Null
    $sw.Stop()
    Write-Host "   model loaded in $([math]::Round($sw.Elapsed.TotalSeconds, 1))s -- ready for fast responses" -ForegroundColor Green
} catch {
    Write-Host "   warmup failed: $($_.Exception.Message)" -ForegroundColor DarkYellow
    Write-Host "   (the chat will still work, but the first request will be slow)" -ForegroundColor DarkYellow
}

# 7. Start frontend bare-metal so it can resolve @form-engine/* -> ../lib/src/*.
Write-Host ""
Write-Host "-- Starting frontend (next dev :3000) --" -ForegroundColor Cyan
$frontend = Start-Process -FilePath "npm.cmd" `
    -ArgumentList "run","dev" `
    -WorkingDirectory (Join-Path $root "frontend") `
    -NoNewWindow -PassThru

Write-Host ""
Write-Host "Frontend -> http://localhost:3000/chat"  -ForegroundColor Green
Write-Host "API docs -> http://localhost:8000/docs"  -ForegroundColor Green
Write-Host ""
Write-Host "Ctrl-C stops frontend. Containers keep running -- stop them with:"   -ForegroundColor Yellow
Write-Host "  docker compose --profile local-ai down"                            -ForegroundColor Yellow
Write-Host ""

try {
    while ($true) {
        if ($frontend.HasExited) { Write-Host "Frontend exited (code $($frontend.ExitCode))" -ForegroundColor Red; break }
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host "`n-- Stopping frontend --" -ForegroundColor Cyan
    if ($frontend -and -not $frontend.HasExited) { Stop-Tree $frontend.Id }
    Free-Port 3000
}
