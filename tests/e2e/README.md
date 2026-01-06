# E2E Tests - Setup Instructions

## Prerequisites

### 1. Create Test User

Before running E2E tests, you need to create a test user account:

**Option A: Via Signup (Recommended)**
1. Start the dev server: `npm run dev`
2. Navigate to the signup page
3. Create a test user with:
   - Email: `test@example.com` (or set `TEST_USER_EMAIL` env var)
   - Password: `testpassword123` (or set `TEST_USER_PASSWORD` env var)

**Option B: Via Database Script**
```bash
# Create test user directly in MongoDB
# (Use your existing user creation script)
```

**Option C: Use Existing User**
Set environment variables:
```bash
export TEST_USER_EMAIL=your-existing-user@example.com
export TEST_USER_PASSWORD=your-password
```

### 2. Start Servers

**Terminal 1: Backend**
```bash
npm run dev:server
```

**Terminal 2: Frontend**
```bash
npm run dev
```

**Terminal 3: Run Tests**
```bash
npm run test:e2e
```

## Running Tests

### Run All Tests
```bash
npm run test:e2e
```

### Run Specific Test File
```bash
npx playwright test tests/e2e/image-deletion.spec.ts
```

### Run in Headed Mode (See Browser)
```bash
npm run test:e2e:headed
```

### Run in UI Mode (Interactive)
```bash
npm run test:e2e:ui
```

## Test Files

- `image-deletion.spec.ts` - Tests image deletion persistence
- `image-duplication.spec.ts` - Tests image deduplication
- `masonry-toggle.spec.ts` - Tests masonry toggle persistence

## Troubleshooting

### "Failed to login" / "Invalid token"
- Ensure test user exists in database
- Check credentials match environment variables
- Verify backend server is running on port 5000

### "Timed out waiting for server"
- Ensure frontend dev server is running on port 5173
- Check `playwright.config.ts` webServer settings

### Tests skip automatically
- Tests will skip if authentication fails
- Check console output for skip reasons

