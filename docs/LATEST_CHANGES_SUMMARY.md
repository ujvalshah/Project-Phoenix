# Latest Changes Summary

Date: 2026-04-15

## UX and Boot Path Improvements

- Added app boot performance marks in `src/main.tsx`:
  - `app:boot:start`
  - `app:boot:mounted`
  - `app:boot:mount` measure
- Deferred service worker registration to idle/next tick so first render path is less contested.
- Added route transition timing in `src/App.tsx`:
  - `route:change:start`
  - `route:change:paint`
  - `route:change:<path>` measures
- Replaced route-level suspense spinner fallback with a structure-matching skeleton shell to avoid near-blank transitions.
- Added first-content timing in `src/pages/HomePage.tsx`:
  - `home:feed:query-state`
  - `home:feed:first-content`
  - `home:feed:first-content-visible` measure

## Auth Selector Fanout Reduction (Focused Follow-up)

Migrated high-impact broad auth consumers from `useAuth()` to narrow `useAuthSelector(...)` slices:

- `src/hooks/usePulseUnseen.ts` -> selects only `isAuthenticated`
- `src/hooks/useNewsCard.ts` -> selects only admin role boolean
- `src/hooks/useNotifications.ts` -> selects only `currentUserId`
- `src/components/NotificationPrompt.tsx` -> selects only `currentUserId`
- `src/hooks/useRequireAuth.ts` -> selects `{ isAuthenticated, openAuthModal, featureFlags }`
- `src/components/CreateNuggetModal.tsx` -> selects `{ currentUser, currentUserId, isAdmin }`

Additional cleanup:

- Removed unused auth subscription from `src/hooks/useMasonryInteraction.ts`.

## Render-Fanout Audit Snapshot

- Broad `useAuth()` consumers reduced from 23 files to 17 files.
- `useAuthSelector(...)` adoption increased in hot paths (card logic, auth gating, notification hooks).
- `FilterStateContext` selector-store pattern was intentionally left unchanged.

## Build/Lint Verification

- Lint checks on edited files: no issues reported.
- Production build completed successfully after changes.
