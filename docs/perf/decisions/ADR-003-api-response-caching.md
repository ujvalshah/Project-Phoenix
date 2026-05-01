# ADR-003: API response caching (proposal)

## Status

Accepted (incremental rollout)

## Context

Read-heavy endpoints can benefit from shared cache layers and explicit `Cache-Control` semantics.

## Decision (target)

Introduce Redis-backed response caching for safe read paths with strict keying and mutation invalidation hooks.

## Current implementation

- Shared helper added: `server/src/services/apiResponseCacheService.ts`
  - `buildApiCacheKey`
  - `getOrSetCachedJson`
  - `invalidateApiResponseCachePrefix`
- Read paths on contract:
  - `GET /api/categories/taxonomy` in `server/src/controllers/tagsController.ts`
  - `GET /api/legal` and `GET /api/legal/:slug` in `server/src/controllers/legalController.ts`
  - key namespace: `tags:taxonomy:v1`
  - TTL: 60s
  - invalidated on create/update/delete/soft-delete/reorder/sync tag mutations
  - key namespace: `legal:pages:v1`
  - TTL: 120s
  - invalidated on admin legal page update

## Consequences

- Risk: stale reads if invalidation is incomplete
- Gain: lower DB load and improved tail latency under traffic spikes

## References

- [`docs/perf/apis/articles.md`](../apis/articles.md)
