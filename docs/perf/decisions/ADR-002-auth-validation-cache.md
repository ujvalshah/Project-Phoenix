# ADR-002: Auth validation caching (proposal)

## Status

Accepted (partial) — `tokenVersion` Redis mirror shipped; broader auth fact caching still optional.

## Context

Authenticated traffic pays repeated validation I/O (Redis blacklist + Mongo `tokenVersion` read per request).

## Decision

Short-TTL Redis cache for **current** `User.tokenVersion` keyed by `userId` (`utv:`), Mongo read-through on miss, **`invalidateUserTokenVersionCache`** on every bump path. Env: `AUTH_TOKEN_VERSION_CACHE_ENABLED`, `AUTH_TOKEN_VERSION_CACHE_TTL_SECONDS`.

## Consequences

- Risk: stale accept up to TTL if invalidation is missed — mitigated by explicit invalidates + conservative TTL.
- Gain: fewer Mongo reads for steady authed traffic when Redis is available.

## References

- [`docs/perf/db/auth-token-validation.md`](../db/auth-token-validation.md)
