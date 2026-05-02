# API / middleware: Auth and sessions

Protected routes flow through JWT validation and token/version checks:

- Middleware: [`server/src/middleware/authenticateToken.ts`](../../server/src/middleware/authenticateToken.ts)
- Token store: [`server/src/services/tokenService.ts`](../../server/src/services/tokenService.ts)

## Perf hotspots

Anything that repeats Redis + Mongo lookups on every authenticated request.

- `tokenVersion`: Redis mirror key `utv:{userId}` (see `getUserTokenVersionForAuth`) with invalidation on bumps; env `AUTH_TOKEN_VERSION_CACHE_*`.

[`../db/auth-token-validation.md`](../db/auth-token-validation.md)
