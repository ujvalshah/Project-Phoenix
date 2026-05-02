# Data contract — create / edit composer

**Goal:** Typed tiers so the **shell never depends on full article detail** or heavy graphs. Aligns with KPIs in `00-kpi-contract.md`.

## Tiers

### `ShellDraft` (required for paint)

Minimal fields to render composer chrome and **shell-level edits** (title, visibility toggles that do not require full media graph, stream targets if applicable, etc.). **Exact field list is implementation-defined** but must be a **narrow interface** — not `Article` / `IArticle`.

- **Source:** create = empty defaults; edit = summary row from feed/cache **or** explicit summary API response.
- **Shell components may only accept `ShellDraft` (+ ids / mode),** not “maybe full article.”

### `ContentDraft`

Body and inline content dependencies: markdown/source string, primary URL hints, tags/collections **identifiers** as needed for the form, without requiring full normalized media arrays for paint.

- Loaded **after** shell is interactive OR shown as skeleton inside a deferred region.

### `AdvancedDetail`

Full normalization: all media items, supporting media, layout visibility, external links, admin-only fields, collection membership diffs, etc.

- **Always** behind lazy boundaries or async fetch after shell open.
- `useImageManager`, masonry toggles, and similar **consume AdvancedDetail** when ready.

## Rules

1. **Shell depends only on `ShellDraft`.** No `initialData?: Article` on shell props in the target architecture.
2. **Forbidden:** passing **`Article` / `IArticle` through the shell tree **“for convenience.”** If a child needs one field, pass that field or a typed pick — **or** wait for `AdvancedDetail` inside a deferred island.
3. **Edit fetch failure:** If loading `AdvancedDetail` fails, **shell stays open**; show inline error in deferred panels; user may still edit shell-level fields and **manually save** when policy allows (e.g. title-only patch — subject to API validation).
4. **Create vs edit sharing:** Shared **pure normalizers** and **save pipelines** are encouraged; shared **state shape** should be the tiered contracts above, not a single megastate keyed on full `Article`.

## Persistence boundaries

| Path | Autos | Save model |
|------|-------|------------|
| **Modal composer** | **No autosave subscription** in the modal shell tree. | **Manual save** only (explicit submit). |
| **Deep full-page editor** (future) | May add autosave-capable session state. | Implementation TBD; **must not** leak autosave listeners into modal code. |

Modal code **must not** subscribe to global autosave or draft-sync stores meant for the full-page path.

## React Query / cache (current repo)

- Global defaults: `staleTime` **5 minutes** in `src/queryClient.ts`.
- Article identity keys: `articleKeys.detail`, `articleKeys.legacyDetail`, lists/infinite keys in `src/services/queryKeys/articleKeys.ts`.

**Target:** `ShellDraft` can be **hydrated from list/infinite cache**; `AdvancedDetail` **fetches or reads `articleKeys.detail`** only inside deferred boundaries. **Current:** most edit entry points pass an in-memory **`Article`** from the parent (`NewsCard.tsx`, `ArticleDetail.tsx`, `MasonryAtom.tsx`, `MySpacePage.tsx`) — effectively treating card/detail data as full enough to edit.

## Current vs target

| Area | **Current (verified)** | **Target** |
|------|------------------------|------------|
| Edit entry | Pass `initialData={article}` / `originalArticle` / `editingArticle` into `CreateNuggetModalLoadable`. | Pass **`ShellDraft`+** open shell; fetch/merge `AdvancedDetail` inside modal islands. |
| Admin edit | `AdminNuggetsPage` awaits `storageService.getArticleById` before mounting modal; loading/error in `AdminDrawer` (`src/admin/pages/AdminNuggetsPage.tsx`). | Optionally show shell immediately from admin row summary while detail loads; **failure** keeps shell with degraded panels. |
| Create / duplicate | `prefillData?: Article` for duplicate (`CreateNuggetModal.tsx` props). | **`ShellDraft` + `ContentDraft` prefill** from duplicate source without shipping full graph through shell. |
| Save | Manual; `updateArticle` / `addArticle` via `storageService` with query cache patch (`CreateNuggetModal.tsx`). | Same persistence semantics; stricter typing on payloads per tier. |
