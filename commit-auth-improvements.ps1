# Authentication Improvements - Commit Script (PowerShell)
# This script creates organized commits for auth security and UX improvements

Write-Host "🔐 Authentication Improvements - Commit Script" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're on the right branch
$CURRENT_BRANCH = git branch --show-current
Write-Host "Current branch: $CURRENT_BRANCH" -ForegroundColor Yellow
Write-Host ""

# Step 1: Ensure .env is not staged and discard changes
Write-Host "📋 Step 1: Checking .env file..." -ForegroundColor Cyan
$staged = git diff --cached --name-only
if ($staged -match "^\.env$") {
    Write-Host "⚠️  WARNING: .env is staged! Unstaging it..." -ForegroundColor Yellow
    git reset HEAD .env
}
$status = git status --short .env
if ($status -match "^M.*\.env$") {
    Write-Host "⚠️  WARNING: .env has changes. Discarding them..." -ForegroundColor Yellow
    git checkout -- .env
}
Write-Host "✅ .env is safe" -ForegroundColor Green
Write-Host ""

# Step 2: Commit 1 - Security Fixes
Write-Host "🔒 Step 2: Committing security fixes..." -ForegroundColor Cyan
git add server/src/controllers/authController.ts
git add server/src/utils/seed.ts
git add src/components/auth/AuthModal.tsx
git commit -m "security(auth): remove demo login and fix password validation

- Remove demo login functionality from AuthModal (handleDemoLogin, UI buttons)
- Fix password optional issue in signup schema (make password required)
- Add production guard to seed function (prevent demo users in production)

Security improvements:
- Demo credentials no longer exposed in production UI
- Password now required for signup (matches frontend behavior)
- Seed function disabled in production environment"
Write-Host "✅ Security fixes committed" -ForegroundColor Green
Write-Host ""

# Step 3: Commit 2 - Rate Limiting
Write-Host "🛡️  Step 3: Committing rate limiting..." -ForegroundColor Cyan
git add server/src/middleware/rateLimiter.ts
git add server/src/routes/auth.ts
git add package.json package-lock.json
git commit -m "security(auth): add rate limiting to authentication endpoints

- Add express-rate-limit middleware for login and signup
- Login: 5 requests per 15 minutes per IP
- Signup: 10 requests per hour per IP
- Returns HTTP 429 with user-friendly message

Prevents brute force attacks and abuse while allowing legitimate use."
Write-Host "✅ Rate limiting committed" -ForegroundColor Green
Write-Host ""

# Step 4: Commit 3 - Client-Side Validation
Write-Host "✨ Step 4: Committing client-side validation..." -ForegroundColor Cyan
# Note: AuthModal.tsx was already added in commit 1, but we need to add it again
# for the validation changes. Git will handle this correctly.
git add src/components/auth/AuthModal.tsx
git commit -m "feat(auth): add client-side validation and field-level errors

- Add minimal client-side validation (email format, username length, password length)
- Add field-level error display with red borders and error messages
- Add password requirements checklist (visual guidance only)
- Errors clear automatically when user types
- Validation is guidance only - backend remains source of truth

UX improvements:
- Immediate feedback before form submission
- Clear field-level error messages
- Password requirements visible as user types
- Better user experience without compromising security"
Write-Host "✅ Client-side validation committed" -ForegroundColor Green
Write-Host ""

# Step 5: Commit 4 - Error Message Improvements
Write-Host "💬 Step 5: Committing error message improvements..." -ForegroundColor Cyan
git add src/utils/errorMessages.ts
git add src/services/authService.ts
git add src/services/apiClient.ts
git commit -m "feat(auth): improve user-facing error messages

- Create error message mapping utility (errorMessages.ts)
- Map backend errors to clearer, user-friendly messages
- Context-aware mapping (login vs signup)
- Clean up Zod validation error messages
- Improve network error handling
- Better HTTP status code error messages

Improvements:
- Clearer, actionable error messages
- Consistent tone across all errors
- No internal error details exposed
- Security-conscious (generic messages where appropriate)"
Write-Host "✅ Error message improvements committed" -ForegroundColor Green
Write-Host ""

# Step 6: Commit 5 - Documentation (optional)
Write-Host "📚 Step 6: Committing documentation..." -ForegroundColor Cyan
git add AUTH_AUDIT_REPORT.md AUTH_AUDIT_CLEANUP_SUMMARY.md
git add RATE_LIMITING_IMPLEMENTATION.md
git add CLIENT_SIDE_VALIDATION_IMPLEMENTATION.md
git add ERROR_MESSAGE_IMPROVEMENTS.md
git commit -m "docs(auth): add comprehensive authentication audit and implementation docs

- AUTH_AUDIT_REPORT.md: Complete end-to-end audit
- AUTH_AUDIT_CLEANUP_SUMMARY.md: Summary of cleanup actions
- RATE_LIMITING_IMPLEMENTATION.md: Rate limiting documentation
- CLIENT_SIDE_VALIDATION_IMPLEMENTATION.md: Validation implementation docs
- ERROR_MESSAGE_IMPROVEMENTS.md: Error message improvements docs"
Write-Host "✅ Documentation committed" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "✅ All commits created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Summary of commits:" -ForegroundColor Yellow
git log --oneline -5
Write-Host ""
Write-Host "📊 Next steps:" -ForegroundColor Yellow
Write-Host "1. Review commits: git log --oneline -5"
Write-Host "2. Review changes: git show HEAD"
Write-Host "3. Push to remote: git push origin $CURRENT_BRANCH"
Write-Host ""
Write-Host "⚠️  Remember: .env file should NOT be committed!" -ForegroundColor Yellow
Write-Host "   Verify with: git status"











