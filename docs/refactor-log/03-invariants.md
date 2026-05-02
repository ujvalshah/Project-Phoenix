# System Invariants

## 1. Functional Integrity
- **Auth**: No changes to auth, token refresh, or session logic without an explicit task.
- **Pagination**: Preserve `lastPage?.hasMore ? lastPage.page + 1 : undefined` semantics.
- **Filters**: Search query, categories, tags, and feed mode must remain primary drivers for Home feed content.

## 2. Performance & Build
- **Bundle Budget**: No new initial-path dependencies.
- **Chunking**: Markdown-related rendering must not be moved into the initial critical path.
- **Type Safety**: `npm run typecheck` must pass after every task.
- **Verification**: Every UI task requires targeted automated verification.

## 3. Communication
- **No Silent Refactors**: If side-issues are discovered, log them as follow-up tasks instead of fixing them in the same prompt.
- **8-File Limit**: If more than 8 files are needed, stop and propose sub-tasks first.
