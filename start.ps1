# CityTwin — one-command launch.
# Builds the frontend and starts the backend, which serves the built UI + API
# together from http://localhost:8000.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "== CityTwin: installing & building frontend ==" -ForegroundColor Cyan
Push-Location (Join-Path $root "frontend")
if (-not (Test-Path "node_modules")) {
    npm install
}
npm run build
Pop-Location

Write-Host "== CityTwin: installing backend dependencies ==" -ForegroundColor Cyan
Push-Location (Join-Path $root "backend")
pip install -r requirements.txt | Out-Null

Write-Host "== CityTwin: starting server on http://localhost:8000 ==" -ForegroundColor Green
uvicorn main:app --host 0.0.0.0 --port 8000
Pop-Location
