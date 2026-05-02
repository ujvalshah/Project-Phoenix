# Flag contract — create/edit nugget modal

**Audience:** Implementers, reviewers, and the next agent. **Status:** Create/edit modal passes production smoke (save/edit, no failed requests). Rollout env vars and **legacy vs v2 hydration** branches remain until cleanup (see `99-cleanup-ledger.md`).

## Composer vs editor

| Class | Meaning |
|-------|---------|
| **Composer (architecture)** | Shell, open path, hydration boundaries (`ContentDraft` vs Article-first), deferred work — **not** the rich-text implementation. |
| **Editor (implementation)** | Editor chunking, package, toolbar, serialization — **not** shell layout or composer routing. |
| **Modal loading / perf** | Chunk preload and cohorting for faster open — **not** “composer version” and **not** editor internals. |

## Canonical env vars (build-time)

| Env | Class | Controls | Default (if unset) |
|-----|--------|----------|----------------------|
| `VITE_NUGGET_COMPOSER_V2` | Composer | Cohort % for **ContentDraft-first** hydration (`shouldEnableNuggetComposerV2ForUser`). Gates `contentDraft` + `composerHydrationV2` in `CreateNuggetModalLoadable` → `NuggetComposerContent`. | `0` (legacy Article-first path) |
| `VITE_NUGGET_EDITOR_V2` | Editor | **Reserved / not in repo yet.** Canonical name for a future editor swap. Today, editor delivery is only `VITE_FEATURE_NUGGET_MODAL_EDITOR_LAZY`. | — |
| `VITE_FEATURE_NUGGET_MODAL_CHUNK_PRELOAD` | Modal loading | Master switch for **intent preload** of the modal chunk (`preloadCreateNuggetModalChunk` → `createNuggetModalChunk.ts`). | on (`true`) |
| `VITE_NUGGET_MODAL_PRELOAD_ROLLOUT_PCT` | Modal loading | **Preload-only** canary: `stableBucket0to99(userId)` vs this % (`performanceRollout.ts`). | `100` |
| `VITE_FEATURE_NUGGET_MODAL_EDITOR_LAZY` | Editor | When on, preloads/loads `ContentEditor` in a **separate async chunk**; when off, editor is inlined in the main modal chunk (`createNuggetModalChunk.ts`, `NuggetContentEditorPanel.tsx`). | on (`true`) |
| `VITE_NUGGET_MODAL_CTP_BUDGET_WARN_MS` | Observability | Double-rAF **click-to-paint** console warning budget after open (`CreateNuggetModalLoadable.tsx`). `0` or omit = off. | `0` |

## Runtime feature keys (`src/constants/featureFlags.ts`)

Composer v2 rollout is **not** exposed as an `isFeatureEnabled` key — use `shouldEnableNuggetComposerV2ForUser` (re-exported from this module) or `NUGGET_PERFORMANCE.composerV2RolloutPercent`.

| Key | Source | Notes |
|-----|--------|--------|
| `NUGGET_MODAL_CHUNK_PRELOAD` | `NUGGET_PERFORMANCE.chunkPreload` | Same as `VITE_FEATURE_NUGGET_MODAL_CHUNK_PRELOAD`. |
| `NUGGET_MODAL_EDITOR_LAZY` | `NUGGET_PERFORMANCE.editorLazySplit` | Same as `VITE_FEATURE_NUGGET_MODAL_EDITOR_LAZY`. |

## Chat / shorthand → canonical spelling

| Informal (no underscores) | Canonical env |
|---------------------------|---------------|
| `VITENUGGETCOMPOSERV2` | `VITE_NUGGET_COMPOSER_V2` |
| `VITENUGGETEDITORV2` | `VITE_NUGGET_EDITOR_V2` (future) |
| `VITENUGGETMODALPRELOADROLLOUTPCT` | `VITE_NUGGET_MODAL_PRELOAD_ROLLOUT_PCT` |
| `VITEFEATURENUGGETMODALCHUNKPRELOAD` | `VITE_FEATURE_NUGGET_MODAL_CHUNK_PRELOAD` |
| `VITEFEATURENUGGETMODALEDITORLAZY` | `VITE_FEATURE_NUGGET_MODAL_EDITOR_LAZY` |
| `VITENUGGETMODALCTPBUDGETWARNMS` | `VITE_NUGGET_MODAL_CTP_BUDGET_WARN_MS` |

## Single source in code

All `VITE_*` reads: `src/config/nuggetPerformanceConfig.ts`. Cohort helpers: `src/utils/performanceRollout.ts`. Chunk/preload: `src/components/createNuggetModalChunk.ts`.

## Rules

| Do | Don’t |
|----|--------|
| Use **composer** flags for shell / hydration / `contentDraft` routing. | Use composer flags to swap TipTap/editor packages. |
| Use **editor** flags for chunking and (later) editor implementation. | Use editor flags to hide shell-first work or change composer layout. |
| Use **modal loading** flags only for preload / cohorting; rollback per knob. | Treat preload % or chunk preload as “composer v2” or “editor v2”. |
| Turn off preload/lazy flags for **incident rollback** independently of composer v2. | Conflate “fast modal” and “new editor” in one uber-flag. |
