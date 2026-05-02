# DB / infra: Auth token validation

Hot path middleware:

- [`server/src/middleware/authenticateToken.ts`](../../server/src/middleware/authenticateToken.ts)

Supporting services:

- [`server/src/services/tokenService.ts`](../../server/src/services/tokenService.ts)
- Redis client: [`server/src/utils/redisClient.ts`](../../server/src/utils/redisClient.ts)

## Notes

- **`tokenVersion`:** Implemented in [`server/src/services/tokenService.ts`](../../server/src/services/tokenService.ts) as `getUserTokenVersionForAuth`, `upsertUserTokenVersionCache` (writes fresh value after bumps), `invalidateUserTokenVersionCache` (hard-delete user). TTL `AUTH_TOKEN_VERSION_CACHE_TTL_SECONDS` (10–600, default 120); disable with `AUTH_TOKEN_VERSION_CACHE_ENABLED=false`.
- Blacklist check semantics unchanged (`STRICT_TOKEN_REVOCATION`).
