# =============================================================================
# Project Nuggets - Setup Script for Windows (PowerShell)
# =============================================================================
# Run from project root: .\setup.ps1
# This script checks prerequisites and installs dependencies.
# You must install Node.js manually if not already installed.
# =============================================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Nuggets - Project Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------------
# 1. Check Node.js
# -----------------------------------------------------------------------------
Write-Host "[1/4] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>$null
    $npmVersion = npm --version 2>$null
    if ($nodeVersion -and $npmVersion) {
        Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green
        Write-Host "  npm:     $npmVersion" -ForegroundColor Green
        $nodeMajor = [int]($nodeVersion -replace 'v(\d+)\..*','$1')
        if ($nodeMajor -lt 18) {
            Write-Host "  WARNING: This project recommends Node.js 18 or newer. You have $nodeVersion" -ForegroundColor Yellow
        }
    } else {
        throw "Node or npm not found"
    }
} catch {
    Write-Host "  ERROR: Node.js is not installed or not in your PATH." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Please install Node.js 18+ from https://nodejs.org (LTS version)." -ForegroundColor White
    Write-Host "  After installing, close and reopen PowerShell/Cursor, then run this script again." -ForegroundColor White
    Write-Host ""
    exit 1
}

# -----------------------------------------------------------------------------
# 2. Check .env file
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "[2/4] Checking .env file..." -ForegroundColor Yellow
$envPath = Join-Path $ProjectRoot ".env"
if (-not (Test-Path $envPath)) {
    $examplePath = Join-Path $ProjectRoot ".env.example"
    if (Test-Path $examplePath) {
        Copy-Item $examplePath $envPath
        Write-Host "  Created .env from .env.example" -ForegroundColor Green
        Write-Host "  IMPORTANT: Edit .env and set MONGO_URI and JWT_SECRET (see RUN_GUIDE.md)" -ForegroundColor Yellow
    } else {
        Write-Host "  WARNING: No .env file found. Create one with MONGO_URI, JWT_SECRET, NODE_ENV=development" -ForegroundColor Yellow
    }
} else {
    Write-Host "  .env exists" -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# 3. Install dependencies
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "[3/4] Installing dependencies (npm install)..." -ForegroundColor Yellow
Set-Location $ProjectRoot
$npmResult = npm install 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: npm install failed." -ForegroundColor Red
    Write-Host $npmResult
    exit 1
}
Write-Host "  Dependencies installed successfully." -ForegroundColor Green

# -----------------------------------------------------------------------------
# 4. Summary
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "[4/4] Setup complete." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Ensure .env has MONGO_URI and JWT_SECRET (see RUN_GUIDE.md)" -ForegroundColor White
Write-Host "  2. Start the project: npm run dev:all" -ForegroundColor White
Write-Host "  3. Open http://localhost:3000 in your browser" -ForegroundColor White
Write-Host ""
Write-Host "To stop the app, press Ctrl+C in the terminal." -ForegroundColor Gray
Write-Host ""
