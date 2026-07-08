# Business AI OS — Smoke test (PowerShell)
# Ejecuta el script Node con la URL indicada.
#
# Uso:
#   .\scripts\smoke-test.ps1
#   .\scripts\smoke-test.ps1 -Url "http://localhost:3000"
#   .\scripts\smoke-test.ps1 -Url "https://business-ai-os.vercel.app"

param(
    [string]$Url = "https://business-ai-os.vercel.app"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Push-Location $ProjectRoot
try {
    Write-Host ""
    Write-Host "Ejecutando smoke test contra: $Url" -ForegroundColor Cyan
    Write-Host ""
    node scripts/smoke-test.mjs --url $Url
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
