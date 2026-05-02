# Cleanup ledger — create/edit modal refactor

**Purpose:** Deferred deletion queue for legacy flags, branches, and docs. **Rule:** Do not remove code unless an item is **Safe to remove** (and verification below passes).

**Statuses:** `Keep now` · `Candidate for deletion` · `Safe to remove` · `Removed`

## Rollout & dual-path code

| Item | Status | Cleanup trigger | Verification |
|------|--------|-----------------|--------------|
| Env `VITE_NUGGET_COMPOSER_V2` + `shouldEnableNuggetComposerV2ForUser` + `getNuggetComposerV2RolloutPercent` | Keep now | `100%` v2 in prod for **one full release cycle**; no rollback need | Smoke create + edit; spot-check cohort user ids; `npm test` (incl. `nuggetComposerV2Rollout`, `shellDraft` tests) |
| Legacy branch: omit `contentDraft`, `composerHydrationV2 === false` in `CreateNuggetModalLoadable`, `NuggetComposerContent`, `shellDraft` pickers | Candidate for deletion | Same as composer env removal | Dual-run: force `VITE_NUGGET_COMPOSER_V2=0` build vs `100` — parity on save payload + UI; then delete legacy branch only after trigger |
| Tests targeting legacy hydration (`shellDraft.test.ts` legacy cases) | Candidate for deletion | After legacy branch deleted | Test suite green; replace with v2-only assertions where needed |

## Preload & modal chunk path

| Item | Status | Cleanup trigger | Verification |
|------|--------|-----------------|--------------|
| `VITE_FEATURE_NUGGET_MODAL_CHUNK_PRELOAD` + `shouldEnableNuggetModalPreloadForUser` | Keep now | Product accepts **always-on** intent preload; incident runbook updated | Disable flag in staging: open modal from cold — acceptable UX; enable: no double-fetch regressions |
| `VITE_NUGGET_MODAL_PRELOAD_ROLLOUT_PCT` + `getNuggetModalPreloadRolloutPercent` | Keep now | Preload always `100%` or knob no longer needed ops-wise | Bucket test: `0` vs `100` with same user id; `performanceRollout` tests |
| `preloadCreateNuggetModalChunk` call sites (`App.tsx`, `Header.tsx`, `WorkspaceHeader`, etc.) | Keep now | Preload logic merged into a single orchestrator or always-on import | Network panel: one chunk graph; no duplicate `import()` races |
| `createNuggetModalChunk.ts` shared promises (`loadCreateNuggetModalModule`, editor prewarm) | Keep now | Only if superseded by explicit loading pipeline | Lazy boundary + chunk cache tests (`createNuggetModalChunkCache.test.ts`) |
| Session key `nuggets_preload_cohort` (`performanceRollout.ts`) | Keep now | Anonymous cohort no longer used | N/A unless preload rollout removed for anon |

## Editor chunking

| Item | Status | Cleanup trigger | Verification |
|------|--------|-----------------|--------------|
| `VITE_FEATURE_NUGGET_MODAL_EDITOR_LAZY` + `isNuggetEditorLazySplitEnabled` | Keep now | Team standardizes on **always lazy** or **always inlined** bundle | Bundle analyze: main modal chunk size; TTI on slow 4G; editor panel tests |
| `loadContentEditorModule` branch in `createNuggetModalChunk.ts` | Candidate for deletion | Lazy path is the only supported path (flag removed, dead `false` branch) | Build + `NuggetContentEditorPanel` integration |

## Observability

| Item | Status | Cleanup trigger | Verification |
|------|--------|-----------------|--------------|
| `VITE_NUGGET_MODAL_CTP_BUDGET_WARN_MS` + rAF probe in `CreateNuggetModalLoadable` | Keep now | Shell KPI stable; no local profiling need | Omit env: no console noise; set budget: warning fires when expected |

## Documentation

| Item | Status | Cleanup trigger | Verification |
|------|--------|-----------------|--------------|
| Duplicated flag tables in `docs/refactor-log/create-modal/README.md` vs `00-flag-contract.md` | Candidate for deletion | `00-flag-contract.md` agreed as sole env SOt | README links to contract; no conflicting values |
| Older KPI / handover docs mentioning pre-refactor modal | Candidate for deletion | Stakeholder archive or explicit “historical” | Links from active docs updated |

## Changelog

| Date | Item | Status |
|------|------|--------|
| 2026-05-02 | `NUGGET_COMPOSER_V2_ACTIVE` removed from `FEATURE_FLAGS` (unused; rollout unchanged) | Removed |
