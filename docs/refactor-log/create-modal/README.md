# Create / edit nugget modal — refactor log

## Contracts

- [00-flag-contract.md](./00-flag-contract.md)
- [00-kpi-contract.md](./00-kpi-contract.md)
- [01-data-contract.md](./01-data-contract.md)

## Audit summary (baseline)

- **Create:** `App.tsx` / `WorkspaceHeader` / header open flow; `CreateNuggetModalLoadable` + dynamic `createNuggetModalChunk` preload.
- **Edit:** Most routes pass in-memory `Article` as `initialData`; **admin nuggets** still block on `getArticleById` before modal (unchanged in Phase 1).
- **Flags:** `VITE_FEATURE_NUGGET_MODAL_CHUNK_PRELOAD`, `VITE_NUGGET_MODAL_PRELOAD_ROLLOUT_PCT`, `VITE_FEATURE_NUGGET_MODAL_EDITOR_LAZY`, `VITE_NUGGET_MODAL_CTP_BUDGET_WARN_MS` via `src/config/nuggetPerformanceConfig.ts`.
- **Guards:** `npm run test:perf-guards` (chunk cache + rollout + markdown slim); e2e `tests/e2e/perf-guards-nugget-modal.spec.ts` asserts no duplicate `CreateNuggetModal` chunk fetch on second open.

## Phase 1 — Thin shell + spinner-first fix (done)

**Goal:** Paint modal chrome (backdrop, header, title, visibility, footer) immediately; load `NuggetComposerContent` async with skeleton.

**Implementation:**

- `src/components/modals/NuggetModalShell.tsx` — `ModalShell`, header, title input, excerpt placeholder copy + skeleton, public/private toggles, `FormFooter` (attach + draft/publish). `interactionDisabled` until composer reports ready.
- `src/components/CreateNuggetModalLoadable.tsx` — orchestrates shell state (`shellTitle`, `shellVisibility`), wires `ref` to composer for submit/file/visibility side-effects, Suspense + `NuggetComposerBodySkeleton`, moves **CTP** double-rAF warning here (same env + message as before).
- `src/components/NuggetComposerContent.tsx` — former body of `CreateNuggetModal.tsx` (lazy chunk); no outer `ModalShell`; title/visibility driven from shell props; `useImperativeHandle` for submit + file input + title/visibility side-effects.
- `src/components/CreateNuggetModal.tsx` — thin re-export to preserve `import('./CreateNuggetModal')` / chunk naming and preload URLs.
- `src/components/CreateNuggetModal/FormFooter.tsx` — `interactionDisabled` for preload gap.

**ShellDraft note:** Title + visibility are orchestrated from `CreateNuggetModalLoadable` today, still hydrated from full `initialData` / `prefillData` and composer init. Narrow `ShellDraft` types belong in Phase 2 per `01-data-contract.md`.

## Phase 2 — `ShellDraft` + `ContentDraft` boundary (done)

**Goal:** Shell paints from a **minimal summary type** only; full `Article` remains the integration fallback for `NuggetComposerContent` (image manager, normalize, save) until `AdvancedDetail` split.

**Types & mappers**

- `src/components/modals/shellDraft.ts` — `ShellDraft` (id, title, excerpt, status, visibility, optional `coverImageUrl`), `ContentDraft` (content, tags, tagIds), `shellDraftFromModalProps`, `articleToShellDraft`, `articleToContentDraft`, `emptyShellDraft`.

**Flow**

- `CreateNuggetModalLoadable` maps `initialData` / `prefillData` → `ShellDraft` on each mount (inner unmounts when the modal closes, so shell state resets without a sync `useEffect`). **`ContentDraft`** + `articleToContentDraft` live in `shellDraft.ts` for the deferred tier; the lazy composer still receives full **`initialData` / `prefillData`** in Phase 2 until an AdvancedDetail-only open path exists.
- `NuggetModalShell` accepts **`shellDraft` + `onShellDraftPatch`** only for chrome fields (no `Article` prop). Excerpt is a real optional field; empty excerpt on save still uses `generateExcerpt` in `normalizeArticleInput` unless `excerptOverride` is non-empty.
- `NuggetComposerContent` still receives **full `initialData` / `prefillData`** and **`shellExcerpt`** for `excerptOverride` on normalize.

**Before / after (data flow)**

```mermaid
flowchart TB
  subgraph before["Before Phase 2"]
    A1[Article in props] --> L1[Loadable]
    L1 --> S1[Shell props pieced from Article fields]
    L1 --> C1[lazy Composer + full Article]
  end

  subgraph after["After Phase 2"]
    A2[Article in props fallback] --> M[shellDraftFromModalProps]
    M --> SD[ShellDraft]
    A2 --> M2[articleToContentDraft typed tier]
    M2 --> CD[ContentDraft contract]
    SD --> NS[NuggetModalShell]
    NS -->|title visibility excerpt status| UserChrome[Instant chrome]
    A2 --> NC[NuggetComposerContent lazy]
    CD -.->|future hydrate| NC
    NC -->|full Article today| UserDeep[Deferred body + media]
  end
```

## Next tasks (ordered)

1. Reduce duplicated warning (title shell + editor panel) if UX feels noisy.
2. **AdvancedDetail** inside deferred islands; shell opens from list cache `ShellDraft` only (no full `Article` in loadable props).
3. **Admin path:** shell-first from row summary while `getArticleById` completes (explicitly out of Phase 1).
4. Optional: Playwright timing budgets once shell metrics are stable.

## Bundle snapshot (after Phase 1, `npm run build`)

Raw bytes from one local Vite 7 build (hashes will differ per build):

| Output | Bytes (raw) | Notes |
|--------|-------------|--------|
| `CreateNuggetModalLoadable-*.js` | ~17 330 | Shell + orchestration (loads with parent lazy boundary). |
| `CreateNuggetModal-*.js` | ~129 910 | Composer body (budget check still uses this file pattern). |
| `createNuggetModalChunk-*.js` | ~2 200 | Preload helper chunk. |

**Before (prior single load):** one `CreateNuggetModal-*.js` chunk (~similar total to shell+composer combined, but **full** modal including chrome had to download before any paint).

Risks for ShellDraft extraction: **dual sources** for title/visibility/excerpt (Loadable `shellDraft` vs composer init from `initialData`) — kept aligned by resetting shell from props on open and driving normalize `excerptOverride` from `shellExcerpt`. **Phase 2 admin risk:** admin still awaits full article before modal; unifying with **shell-first + `AdvancedDetail` fetch** may surface race windows between row summary and server detail (see Phase 2 **Next tasks**).
