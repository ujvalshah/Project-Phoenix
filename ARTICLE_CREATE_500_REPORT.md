# POST /api/articles 500 — Root Cause and Fix

## Exact Root Cause

**Error:** `TypeError: next is not a function`  
**Location:** `server/src/models/Article.ts` line 351, inside the `pre('save')` hook, during `Article.create()`.

**Cause:** The `pre('save')` hook was defined as `async function(next)` and called `next()` / `return next()`. In Mongoose 9 with Kareem 2, **async** pre hooks are driven by the returned Promise; Kareem does **not** pass a `next` callback in that path. The first parameter to the handler is therefore `undefined`, so `next()` throws `TypeError: next is not a function`.

---

## Code Fixes Applied

### 1. `server/src/models/Article.ts` — All three pre hooks

- **`pre('save')`** (line 348): `async function(next)` → `async function()`. Replaced every `return next()` with `return` and removed the final `next()`.
- **`pre('updateOne')`** (line 392): same change.
- **`pre('findOneAndUpdate')`** (line 438): same change.

Rule: for **async** Mongoose middleware, do **not** use `next`; use `return` for early exit and let the Promise resolve to continue.

### 2. `server/src/controllers/articlesController.ts` — createArticle error handling

- Replaced the final `sendInternalError(res)` in the `createArticle` catch with:
  - `console.error('ARTICLE_CREATE_FAILED', error);`
  - `return res.status(500).json({ code: 'ARTICLE_CREATE_FAILED', message: error.message });`

### 3. `server/src/controllers/articlesController.ts` — tagIds assignment

- Tag resolution was writing to `(createData as any).tagIds` before `createData` existed. Switched to `(data as any).tagIds` so `tagIds` are included when `createData = { ...data, publishedAt, isCustomCreatedAt }` is built.

---

## DB Schema vs Local

- The failure occurs **in the pre-save hook**, before any MongoDB insert. The payload and Mongoose document were accepted; the error is in the hook, not in schema/validation.
- **Conclusion:** No production-only schema mismatch, required columns, enums, or nullable-field issues were involved.

---

## Env Vars Used During Article Creation

| Env var        | Used in                         | Required for create |
|----------------|----------------------------------|---------------------|
| `MONGO_URI` / `MONGODB_URI` | `db.ts`                          | Yes (DB connection) |
| `REDIS_URL`    | Rate limiter, index health       | No (optional)       |
| `ENABLE_TAG_IDS_WRITE` | `tagHelpers.isTagIdsWriteEnabled()` | No (tagIds resolution) |
| `ENABLE_TAG_IDS`      | `tagHelpers`                     | No                  |
| `ENABLE_TAG_IDS_READ` | `tagHelpers`                     | No                  |
| `DISABLE_LEGACY_TAGS` | `tagHelpers`                     | No                  |

- `logContentTruncation` (used only when the pre-save hook does **not** early-exit, i.e. on **updates**, not creates) uses `getLogger()`; the logger may use `LOG_LEVEL` etc. None of these are in the failing create path.
- **Conclusion:** No missing or misconfigured env var in the create path; the 500 was not caused by env.

---

## Why It Only Failed in Production

1. **Mongoose/Kareem behavior with async + `next`:**  
   In Mongoose 9 / Kareem 2, async pre hooks are Promise-based. The `next` callback is not passed (or is not a function) in that mode. Calling `next()` then throws. This can depend on the exact Mongoose/Kareem and Node versions and how the middleware is invoked.

2. **Environment differences:**  
   Render may resolve different Mongoose/Kareem (or Node) versions than local (e.g. lockfile not deployed, or different resolution), making the “no `next` in async hooks” behavior show up only in production.

3. **`Article.create()` always runs `pre('save')`:**  
   `Model.create()` uses `doc.save()` internally, so the pre-save hook runs on every create. For **new** docs, the hook’s first branch is `if (this.isNew) return next();`. That `next()` is what threw; the bug is in the hook contract, not in the payload.

4. **Local might have been on a different Mongoose/Kareem version** where `next` was still passed to async hooks, so the same code did not throw locally.

---

## POST /api/articles Handler and Generic Error

- **Handler:** `createArticle` in `server/src/controllers/articlesController.ts` (e.g. around line 600 for `Article.create`, 603+ for the catch).
- **Generic 500:** The catch’s last branch called `sendInternalError(res)`, which sends a generic internal server error. The real `TypeError: next is not a function` was only in Render/logs until the new `console.error` and `res.status(500).json({ code, message })` were added.

---

## Summary

- **Root cause:** `pre('save')` (and the two other hooks) used `async function(next)` and `next()` in a Mongoose 9 / Kareem 2 async middleware path where `next` is not a function.
- **Fix:** Use `async function()` and `return` / normal completion only; structured 500 with `ARTICLE_CREATE_FAILED` and `error.message`; fix `tagIds` to write to `data` instead of `createData`.
- **Schema / env:** No production-only schema or env issues; the failure was entirely in the Article pre hooks.
