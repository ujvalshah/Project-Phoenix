# Flag contract — Nugget Composer vs editor infrastructure

**Audience:** Implementers and reviewers. **Status:** `VITE_NUGGET_COMPOSER_V2` is implemented (`nuggetPerformanceConfig`, `performanceRollout`, `CreateNuggetModalLoadable`).

## Canonical flags

| Flag | Scope | Owner |
|------|--------|--------|
| `VITE_NUGGET_COMPOSER_V2` | **Composer architecture only:** shell-first open path, data-tier boundaries (`ShellDraft` / deferred detail), and routing of create vs edit through the new shell. **Must not** change markdown engine, toolbar, or editor internals. | Frontend platform / nugget UX |
| `VITE_NUGGET_EDITOR_V2` | **Editor implementation only:** replacement or major rework of the rich-text body editor (e.g. new package, new toolbar, new serialization). **Must not** gate modal shell layout, preload orchestration, or “open before detail” behavior. | Editor owner |

**Naming note:** Some older docs or chats may say `VITENUGGETEDITORV2` (no underscores). In this repo, Vite client env vars are `VITE_*` with underscores. **`VITE_NUGGET_EDITOR_V2` is the canonical spelling when the editor flag is introduced.** Today that flag **does not exist** in code; the only editor-related toggle is chunk splitting (below).

## Temporary performance infrastructure (legacy preload / lazy)

These already exist and are defined in `src/config/nuggetPerformanceConfig.ts`, surfaced through `FEATURE_FLAGS` in `src/constants/featureFlags.ts` and `src/utils/performanceRollout.ts` (composer v2 cohort: `shouldEnableNuggetComposerV2ForUser`):

| Env | Responsibility |
|-----|----------------|
| `VITE_FEATURE_NUGGET_MODAL_CHUNK_PRELOAD` | Intent-based preload of the `CreateNuggetModal` dynamic chunk (`src/components/createNuggetModalChunk.ts`). |
| `VITE_NUGGET_MODAL_PRELOAD_ROLLOUT_PCT` | Canary cohorting for preload only (`stableBucket0to99` in `src/utils/performanceRollout.ts`). |
| `VITE_FEATURE_NUGGET_MODAL_EDITOR_LAZY` | Async `ContentEditor` chunk via `NuggetContentEditorPanel` (`src/components/CreateNuggetModal/NuggetContentEditorPanel.tsx`). |
| `VITE_NUGGET_MODAL_CTP_BUDGET_WARN_MS` | Dev observability: double-rAF “click-to-paint” warning inside `CreateNuggetModal` (`src/components/CreateNuggetModal.tsx`). |

**Treat these as rollback / observability knobs, not as “composer version” flags.** They must not be overloaded to mean “new shell architecture.”

## Rollout rules

1. **`VITE_NUGGET_COMPOSER_V2`:** unset or empty means **no v2 cohort** (legacy hydration only). Set **`true`** / **`1`** / **`100`** for full v2; partial % (`0.01`, `0.1`, `10`, …) uses the same cohort bucket as modal preload (`create-modal/README.md` rollout table).
2. **`VITE_NUGGET_EDITOR_V2`** (when added) may ship independently: editor swaps must work inside either composer, unless a technical dependency forces a joint release (document that exception in the PR).
3. Preload/lazy flags remain **independently toggleable** for incident response; turning them off must not imply composer V2 is on or off.

## Deprecation trigger

- **Preload / lazy envs:** Deprecate only when their behavior is inlined into an always-on composer pipeline *and* incident runbooks no longer need per-knob rollback—or when superseded by explicit composer “stage” loading with the same operational guarantees.
- **`VITE_NUGGET_COMPOSER_V2`:** Remove after shell-first is the only path in production for a full release cycle and old entry points are deleted.

## Forbidden overlaps

- **Do not** use `VITE_FEATURE_NUGGET_MODAL_EDITOR_LAZY` or a future `VITE_NUGGET_EDITOR_V2` to **hide** shell-first work or to **route** composer layout.
- **Do not** use `VITE_NUGGET_COMPOSER_V2` to swap TipTap/CodeMirror/alternate editors; that belongs on the editor flag.
- **Do not** add new “uber-flags” that conflate “fast modal” and “new editor.”

## Current repo state (verified)

- `VITE_NUGGET_COMPOSER_V2`: **present** — parsed as cohort % in `nuggetPerformanceConfig.ts`; gates `contentDraft` + `composerHydrationV2` in `CreateNuggetModalLoadable` / `NuggetComposerContent`.
- `VITE_NUGGET_EDITOR_V2`: **not present** — editor chunk behavior is `VITE_FEATURE_NUGGET_MODAL_EDITOR_LAZY` only.
