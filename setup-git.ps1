# Git Setup Script for Nuggets v60
# Run this script after Git is installed to initialize the repository

Write-Host "Initializing Git repository..." -ForegroundColor Green
git init

Write-Host "Adding all files to staging area..." -ForegroundColor Green
git add .

Write-Host "Creating initial commit..." -ForegroundColor Green
git commit -m "Initial commit: Add nuggets v60 project"

Write-Host "`nGit repository initialized successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Add a remote repository (if needed):" -ForegroundColor Cyan
Write-Host "   git remote add origin <your-repository-url>" -ForegroundColor White
Write-Host "2. Push to remote:" -ForegroundColor Cyan
Write-Host "   git push -u origin main" -ForegroundColor White
Write-Host "`nCurrent status:" -ForegroundColor Yellow
git status


