# Project Phoenix - Claude.md

## Project
Full-stack React 19 + Express 5: articles and nugget workflows.

## Primary guidance
- Canonical policy: **`AGENTS.md`**.
- Scoped rules: **`.cursor/rules/*.mdc`** when editing matching paths.

## Read first when relevant
Use the table in **`AGENTS.md`** (same paths: perf, modal, data layer, query, backend, flags/env).

**Read-first pass required** before: flags/env; caches or query/fetch changes; create/edit modal loading/shell/chunks; adapter–API contract changes.

## Architecture
- Data: `storageService` + `IAdapter`; keep `IAdapter` aligned with backend when contracts change.
- Logic in services/adapters/controllers; thin React and Express handlers.
- TypeScript strict; no `any`.

## Commands
`npm install` · `npm run build` · `npm run build:server` · `npm run lint` · `npm run typecheck` · `npm test`

## Guardrails
Zod or existing validation before business logic. Project logger (`pino` patterns), not `console.log`. No duplicate ad-hoc caches over React Query baseline. Production server: compiled output, not runtime TS. Narrow, reversible changes; update docs when flags, rollouts, perf, or contracts change.
