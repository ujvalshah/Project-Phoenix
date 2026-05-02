# AGENTS.md — Project Phoenix guidance

## Purpose
Repo-specific operating model for safe, coherent changes.

## Source-of-truth order
1. User task for this chat.
2. Governance docs in **Read first** below.
3. `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*.mdc`.
4. Legacy plans / ad-hoc notes.

## Read first when relevant
Read before changing the matching area:

| Area | Files |
|------|--------|
| Perf / bundling | `docs/perf/PERF_MASTER.md`, `docs/perf/LLM_HANDOFF.md`, `vite.config.ts`, `scripts/check-bundle-budget.mjs` |
| Create/edit modal | `docs/refactor-log/create-modal/00-flag-contract.md`, `docs/refactor-log/create-modal/99-cleanup-ledger.md`, `src/config/nuggetPerformanceConfig.ts`, `src/utils/performanceRollout.ts`, relevant modal chunk/shell files |
| Data layer | `src/services/storageService.ts`, `src/services/adapters/IAdapter.ts` |
| Query / fetch | `src/queryClient.ts`, `src/constants/reactQueryTiming.ts`, related hooks / query keys |
| Backend / API | `server/src/index.ts`, relevant route/controller/service files |
| Flags / env | `vite.config.ts`, `.env.example`, `src/constants/featureFlags.ts` |

**Required read-first pass** before: new or repurposed flags/env; new caches or React Query/fetch plumbing; modal loading/chunk/shell changes; frontend–backend contract changes; backend changes that affect adapters.

## Repo shape
- Frontend: `src/` · Backend: `server/src/` · Scripts: `scripts/` · Governance: `docs/perf/**`, `docs/refactor-log/**`

## Operating rules
Narrow, reversible scope. Extend existing patterns. Keep adapter + services + API aligned. Do not repurpose rollout flags casually. Document rollback for risky work. One bottleneck per perf change.

## Safe workflow
1. Read the rows that apply.
2. Smallest change that fixes the problem.
3. Ship without scope creep.
4. Validate minimally first; broaden only if needed.
5. Update docs when flags, rollouts, perf behavior, or contracts change.
