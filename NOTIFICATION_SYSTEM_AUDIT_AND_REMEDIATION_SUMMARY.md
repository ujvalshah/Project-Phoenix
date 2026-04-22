# Notification System Audit and Remediation Summary

## 1. Executive Summary

Phone push delivery for `nuggets.one` was unreliable even when browser permission was granted. Users could appear "enabled" in UI while notifications were no longer deliverable on Android Chrome/PWA and desktop browsers.

The audit identified six primary reliability failures:
- Subscription lifecycle fragility across reloads and browser-side subscription rotation.
- Service worker renewal/auth flow that was not robust for production cookie/CSRF constraints.
- Duplicate publish fan-out risk from article save lifecycle handling.
- Coupling between push transport health and in-app notification creation.
- Weak delivery observability (limited per-attempt diagnosis).
- Android notification asset weaknesses (icon/badge defaults not tuned for platform behavior).

Remediation focused on P0/P1 reliability: hardening subscription state/renewal, fixing fan-out idempotency and publish gating, decoupling in-app delivery from push transport availability, adding a delivery attempt ledger, and shipping dedicated PWA/notification assets.

## 2. System Overview

### Frontend
- React app boot registers service worker via `src/main.tsx` and `src/utils/serviceWorkerRegistration.ts`.
- Notification UX/state lives in `src/hooks/useNotifications.ts`, `src/services/notificationService.ts`, `src/components/NotificationPrompt.tsx`, `src/components/NotificationBell.tsx`, and settings/notifications pages.
- Permissions are browser-level (`Notification.requestPermission()`); subscription is Web Push (`PushManager.subscribe`) with VAPID key fetched from backend.

### Service Worker
- `public/sw.js` handles:
  - `push` event -> OS notification rendering.
  - `notificationclick` -> route/tab focus/navigation behavior.
  - `pushsubscriptionchange` -> re-subscribe and backend re-registration.

### Backend pipeline
- Notification API routes/controllers: `server/src/routes/notifications.ts`, `server/src/controllers/notificationsController.ts`.
- Publish trigger: article model hook in `server/src/models/Article.ts`.
- Queue/send pipeline: `server/src/services/notificationService.ts` (BullMQ + web-push provider).
- Subscription state: `server/src/models/PushSubscription.ts`.
- In-app inbox records: `server/src/models/Notification.ts`.
- Delivery-attempt tracking (new): `server/src/models/NotificationDelivery.ts`.

## 3. Root Causes

### Fragile subscription lifecycle
- **Impact:** Client could mis-detect local subscription status after reload/timing race.
- **Affected files/modules:** `src/utils/serviceWorkerRegistration.ts`, `src/services/notificationService.ts`, `src/hooks/useNotifications.ts`.
- **Detail:** Previous checks relied on volatile in-memory registration reference.

### Unsafe `pushsubscriptionchange` renewal
- **Impact:** Subscription rotation could fail silently, especially on mobile browsers.
- **Affected files/modules:** `public/sw.js`, backend notifications routes/controllers, CSRF middleware.
- **Detail:** Renewal path needed explicit VAPID `applicationServerKey` and production-safe authenticated backend re-registration.

### Subscription state drift (permission granted, backend registration missing)
- **Impact:** User saw granted permission but no push delivery due to stale/missing server-side subscription.
- **Affected files/modules:** `src/hooks/useNotifications.ts`, `src/components/NotificationPrompt.tsx`, `src/components/NotificationBell.tsx`, `src/pages/AccountSettingsPage.tsx`, notifications API.

### Duplicate publish fan-out
- **Impact:** Multiple fan-outs could be enqueued from repeated public article saves.
- **Affected files/modules:** `server/src/models/Article.ts`, `server/src/services/notificationService.ts`.
- **Detail:** Publish transition detection was insufficient; queue jobs lacked deterministic idempotency key.

### Push/in-app coupling
- **Impact:** In-app notifications could be skipped when queue or push transport prerequisites were unavailable.
- **Affected files/modules:** `server/src/services/notificationService.ts`.
- **Detail:** Early exits around queue/VAPID path could suppress in-app creation.

### Inaccurate delivery reporting
- **Impact:** `deliveredVia` could overstate push success.
- **Affected files/modules:** `server/src/services/notificationService.ts`, `server/src/models/Notification.ts`.

### Weak Android notification assets
- **Impact:** Notification icon/badge rendering quality and consistency risked degradation on Android.
- **Affected files/modules:** `public/sw.js`, `public/manifest.json`, `public/icons/*`.

### Missing delivery observability
- **Impact:** Limited ability to diagnose failure mode (provider fail vs stale endpoint vs no subscription).
- **Affected files/modules:** backend notification service/models/routes/controllers.

## 4. Actions Taken

### Frontend subscription recovery and drift checks
- Added non-volatile SW registration resolution (`navigator.serviceWorker.getRegistration('/')` fallback).
- Added server-side subscription status check endpoint integration.
- Added drift detection (`permission granted` + `subscription missing/desynced`) and surfaced recovery UX in prompt, bell, and settings.

### Service worker renewal and click routing
- Updated `pushsubscriptionchange` to:
  - fetch VAPID key,
  - resubscribe with explicit `applicationServerKey`,
  - re-register via authenticated backend endpoint.
- Added dedicated SW renewal endpoint path that is CSRF-exempt but auth-protected.
- Improved `notificationclick` routing to prioritize exact URL client before fallback navigation.

### Backend publish guard and queue idempotency
- Added publish transition logic in article model hook: trigger only on create-as-public or private->public transition.
- Added deterministic queue job id (`fanout:<articleId>`) to prevent duplicate fan-out enqueues.

### Decoupled in-app notifications from push transport health
- Removed push-only coupling in fan-out path.
- Added in-app fallback creation path when queue is unavailable.
- Ensured push failures do not suppress in-app inbox creation.

### Delivery ledger and diagnostics
- Added `NotificationDelivery` model for per-attempt status tracking.
- Logged push outcomes (`sent_to_provider`, `provider_failed`, `subscription_removed`) and in-app status (`shown_in_app`).
- Added notification diagnostics endpoint for admin/runtime visibility.
- Improved subscription model with activity/failure fields and ownership safeguards.

### Android icon/badge + manifest updates
- Added dedicated assets:
  - `public/icons/icon-192.png`
  - `public/icons/icon-512.png`
  - `public/icons/icon-512-maskable.png`
  - `public/icons/badge-72.png`
- Updated manifest icon set and badge declaration.
- Updated SW notification defaults to use root-relative Android-safe PNG paths.

## 5. Before vs After

| Area | Before | After | Result |
|---|---|---|---|
| Subscription lookup | In-memory registration only | SW registration resolve fallback added | Reduced false "not subscribed" states |
| SW renewal | Non-robust renewal path | Explicit VAPID key + auth-safe re-register endpoint | Improved subscription rotation reliability |
| Publish trigger | Could retrigger on public saves | Guarded publish transitions + queue idempotency key | Duplicate fan-out risk reduced |
| In-app creation | Could be skipped when push infra unhealthy | In-app creation decoupled/fallback path added | Inbox continuity improved |
| Delivery truth | `deliveredVia` could overclaim push | Delivery channel marked based on actual outcomes | Improved data correctness |
| Observability | Limited send diagnostics | `NotificationDelivery` attempt ledger + diagnostics endpoint | Faster failure diagnosis |
| Android assets | Weak/default icon-badge strategy | Dedicated PNG icon/maskable/badge assets | Better Android/PWA rendering consistency |

## 6. Validation

- **Build verification:** Production build completed successfully after changes.
- **Manifest/SW path checks:** All icon and badge paths are root-relative and present under `public/icons`.
- **Functional QA scenarios:**
  - Foreground tab delivery.
  - Background tab delivery.
  - Closed-app/browser delivery.
  - Android Chrome browser delivery.
  - Installed PWA delivery.
- **Subscription lifecycle QA:**
  - Token/subscription rotation via unsubscribe/re-subscribe and site data clear.
  - Stale endpoint cleanup path verification (invalid endpoint lifecycle).
- **Security/auth QA:**
  - Renewal flow via SW endpoint with auth-required routing.
  - CSRF behavior validated for new renewal endpoint contract.

## 7. Remaining Gaps

The following items remain for P2 architecture hardening:
- Worker separation (dedicated process separation from API runtime).
- Outbox/event-driven pattern for stronger publish->dispatch consistency.
- Fallback channels (e.g., email/SMS policies by priority).
- Delivery SLO dashboards and alerting (queue lag, provider failures, stale subscription rates).

## 8. Appendix

### Changed files
- `public/sw.js`
- `public/manifest.json`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/icon-512-maskable.png`
- `public/icons/badge-72.png`
- `src/utils/serviceWorkerRegistration.ts`
- `src/services/notificationService.ts`
- `src/hooks/useNotifications.ts`
- `src/components/NotificationPrompt.tsx`
- `src/components/NotificationBell.tsx`
- `src/pages/AccountSettingsPage.tsx`
- `src/pages/NotificationsPage.tsx`
- `server/src/models/Article.ts`
- `server/src/models/PushSubscription.ts`
- `server/src/models/Notification.ts`
- `server/src/models/NotificationDelivery.ts` (new)
- `server/src/services/notificationService.ts`
- `server/src/controllers/notificationsController.ts`
- `server/src/routes/notifications.ts`
- `server/src/middleware/csrf.ts`

### Endpoints added/modified
- Added:
  - `POST /api/notifications/sw-renew-subscription`
  - `GET /api/notifications/subscription-status`
  - `GET /api/notifications/admin/diagnostics`
- Modified behavior:
  - `POST /api/notifications/subscribe`
  - `POST /api/notifications/unsubscribe`

### Models added/modified
- Added:
  - `NotificationDelivery`
- Modified:
  - `PushSubscription` (activity/failure/ownership fields/index)
  - `Notification` (delivery truth/dedupe support)

### QA checklist (condensed)
- [ ] Browser permission granted + subscribed + push received.
- [ ] Permission granted but subscription missing -> recovery UX displayed.
- [ ] `pushsubscriptionchange` renews and backend registration updates.
- [ ] Publish event produces single fan-out per publish transition.
- [ ] In-app notifications still created when push path fails/degrades.
- [ ] Stale subscriptions cleaned up and logged appropriately.
- [ ] Android launcher icon (including maskable) renders correctly.
- [ ] Android notification icon and badge render correctly.
- [ ] Installed PWA receives background notifications and opens correct route on click.
