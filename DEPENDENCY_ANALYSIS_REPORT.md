# Dependency Analysis Report for server/src/

## Summary

Analysis of all imported packages in `server/src/` compared to `package.json` dependencies and devDependencies.

---

## 1. Imported in PRODUCTION code but MISSING from package.json

These packages are imported in production code (`server/src/`) but are not listed in `package.json`:

### Missing Dependencies (MUST ADD):
- **`multer`** - Used in `server/src/controllers/mediaController.ts` for file uploads
- **`cloudinary`** - Used in `server/src/services/cloudinaryService.ts` for image/media storage

### Fix:
Add these to `dependencies` in `package.json`:
```json
"multer": "^1.4.5-lts.1",
"cloudinary": "^2.0.0"
```

---

## 2. In devDependencies but should be in dependencies

**None** - All packages in devDependencies that are used in production code are correctly categorized.

---

## 3. In dependencies but NOT actually used in server/src/

These packages are in `dependencies` but are NOT imported anywhere in `server/src/`. They are likely frontend-only packages:

### Unused Dependencies (CAN REMOVE from dependencies):
- **`@sentry/react`** - React SDK, server uses `@sentry/node`
- **`@tanstack/react-query`** - Frontend data fetching library
- **`@tanstack/react-virtual`** - Frontend virtual scrolling
- **`lucide-react`** - React icon library
- **`papaparse`** - CSV parser (not used in server)
- **`pino-pretty`** - Pretty printer for pino (should be in devDependencies if used)
- **`react`** - React library (frontend only)
- **`react-dom`** - React DOM (frontend only)
- **`react-markdown`** - React markdown renderer (frontend only)
- **`react-router-dom`** - React router (frontend only)
- **`remark-gfm`** - GitHub Flavored Markdown plugin (frontend only)
- **`tailwind-merge`** - Tailwind utility (frontend only)
- **`xlsx`** - Excel file parser (not used in server)

### Node.js Built-ins (SHOULD REMOVE):
- **`path`** - Node.js built-in module (doesn't need to be in package.json)
- **`url`** - Node.js built-in module (doesn't need to be in package.json)

### Fix:
Remove these from `dependencies` in `package.json`. If some are used in the frontend, they should remain but this analysis only covers `server/src/`.

**Note**: `pino-pretty` is typically a devDependency for development logging. If it's used in production, it should stay, but consider moving it to devDependencies.

---

## 4. Test packages MISSING from package.json

These packages are imported in test files but are not listed in `package.json`:

### Missing Test Dependencies (MUST ADD to devDependencies):
- **`vitest`** - Used in `server/src/__tests__/ssrfProtection.test.ts`, `feedbackController.test.ts`, `escapeRegExp.test.ts`
- **`@jest/globals`** - Used in `server/src/__tests__/privacy.test.ts` (note: mixing Jest and Vitest in the same project)

### Fix:
Add these to `devDependencies` in `package.json`:
```json
"vitest": "^2.1.0",
"@jest/globals": "^29.7.0"
```

**Note**: You're using both Vitest and Jest in your test files. Consider standardizing on one test framework.

---

## 5. Test packages incorrectly in dependencies

**None** - All test-only packages are correctly categorized (express and mongoose are used in both production and tests, so they belong in dependencies).

---

## Recommended package.json Changes

### Add to dependencies:
```json
"multer": "^1.4.5-lts.1",
"cloudinary": "^2.0.0"
```

### Add to devDependencies:
```json
"vitest": "^2.1.0",
"@jest/globals": "^29.7.0"
```

### Remove from dependencies (if not used in frontend):
```json
"@sentry/react",
"@tanstack/react-query",
"@tanstack/react-virtual",
"lucide-react",
"papaparse",
"pino-pretty",  // Consider moving to devDependencies
"react",
"react-dom",
"react-markdown",
"react-router-dom",
"remark-gfm",
"tailwind-merge",
"url",  // Node.js built-in
"path", // Node.js built-in
"xlsx"
```

---

## Production Packages Currently Used (for reference)

These packages are correctly in dependencies and are used in `server/src/`:
- `@google/genai`
- `@sentry/node`
- `bcryptjs`
- `compression`
- `cors`
- `dotenv`
- `express`
- `express-rate-limit`
- `helmet`
- `jsonwebtoken`
- `mongoose`
- `morgan`
- `open-graph-scraper`
- `pino`
- `probe-image-size`
- `rate-limit-redis`
- `redis`
- `zod`

---

## Notes

1. **Frontend packages**: This analysis only covers `server/src/`. If packages like `react`, `react-dom`, etc. are used in the frontend code, they should remain in `dependencies` but may not be needed for server deployment.

2. **Node.js built-ins**: `path` and `url` are Node.js built-in modules and don't need to be in `package.json`. Modern Node.js (v12+) handles these automatically in ES modules.

3. **Test framework**: You're using both Vitest and Jest. Consider standardizing on one framework for consistency.

4. **pino-pretty**: Typically used only in development. Consider moving to `devDependencies` if not needed in production.


