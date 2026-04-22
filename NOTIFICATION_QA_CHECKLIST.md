# Notification System — Real-Device QA Checklist

Verifies the P0/P1/P2 fixes shipped in commit `e103689`. Each section maps
to the specific fix it exercises, so if something fails you know which
change to dig into. Order matters — run top-to-bottom on a fresh device
profile.

---

## 0. Prerequisites

- [ ] Android phone with Chrome (stable). Disable battery optimization for Chrome for the duration of the test.
- [ ] USB cable + `chrome://inspect` on desktop Chrome so you can see the SW console.
- [ ] One admin test account (to read `/admin/notifications` diagnostics) and one non-admin account.
- [ ] Backend reachable over HTTPS (SW won't register otherwise). `localhost` over USB port-forwarding is fine.
- [ ] Server tail: keep `pino` output visible so you can grep `[Notifications]` lines.
- [ ] Before starting: in Chrome on the phone, long-press site → **Clear & reset** to wipe any stale SW/subscription/IDB state.

---

## A. Subscribe & baseline delivery

Establishes a known-good subscription.

- [ ] **A1. Fresh subscribe — web tab.** Sign in, open `/settings/notifications`, grant permission.
  - Expected: toggle lands on; browser prompt appears; SW console shows no errors.
  - Verify in DB: `db.pushsubscriptions.find({userId:<id>,active:true})` returns one doc with `platform:"web"`, `endpoint` starting `https://fcm.googleapis.com/` (Chrome) or matching another allowlisted host.
  - Verify timezone captured (**P1-7**): user doc `notificationPreferences.timezone` equals phone's IANA zone (e.g. `Asia/Kolkata`).

- [ ] **A2. Baseline push delivery.** As admin in another browser/account, create a new nugget with `visibility:"public"`. Confirm the phone receives the OS notification within ~5s.
  - Expected: notification shows icon `/icons/icon-192.png` and badge `/icons/badge-72.png`; no broken-image tile.
  - DB: `notificationdeliveries` row with `channel:"push"`, `status:"sent_to_provider"`; separate row `channel:"in_app"`, `status:"shown_in_app"`.
  - Tapping the notification focuses/opens the article page.

---

## B. Service worker lifecycle (P1-4: skipWaiting + clients.claim)

Confirms a newly deployed SW activates immediately instead of sitting behind the old one.

- [ ] **B1. SW replaces in-place.** In `chrome://inspect` → Service Workers for the site, note current SW hash. Bump `public/sw.js` with a trivial comment, redeploy, reload the page once.
  - Expected: a new SW appears and transitions to `activated` without needing all tabs to close. `clients.matchAll()` in DevTools console returns the current tab.
  - Fail signal: new SW stuck in `waiting` state — indicates `skipWaiting` didn't fire.

---

## C. Fan-out on findOneAndUpdate path (P0-1)

The bug being validated: admin/editor edit flows use `findByIdAndUpdate`, not `.save()`. Previously these silently skipped fan-out.

- [ ] **C1. Create-as-public.** Admin creates a nugget directly as `public`. Phone receives push.
  - Server log contains `[Notifications] post-publish dispatch` for the article.

- [ ] **C2. Private → Public via admin edit (the critical case).** Admin creates a nugget as `private`, then edits it to `public` from the admin edit UI (which hits `PUT /articles/:id` → `findByIdAndUpdate`).
  - Expected: phone receives exactly one push.
  - Exactly-once check: `notifications` collection has a single doc for this user+articleId pair; `notificationdeliveries` has one push row per subscription. **No duplicates.**

- [ ] **C3. Idempotency on re-save.** Save the same now-public article again with an unrelated field change (e.g. title typo).
  - Expected: **no** new push. (Hook gates on `previousVisibility === 'private'`.)
  - DB: no new rows in `notifications` / `notificationdeliveries` for this article.

- [ ] **C4. Public → Private → Public round-trip.** Toggle back to private, then public again.
  - Expected: one push on the second public transition. (Tests that `$locals`/`_notifyVisibilityState` doesn't leak between updates.)

---

## D. pushsubscriptionchange renewal (P1-1/2, P0-4)

The riskiest change. Tests the IDB-backed replay path.

- [ ] **D1. Forced renewal — happy path.** In `chrome://inspect` DevTools → Application → Service Workers → click **Push** → dispatch a synthetic `pushsubscriptionchange`. (Or: DevTools → Application → Service Workers → Unregister then reload, which triggers re-subscribe.)
  - Expected: SW console logs fetch to `/api/notifications/vapid-key` then POST to `/api/notifications/sw-renew-subscription`, response `200`.
  - DB: new `pushsubscriptions` doc with new `endpoint`, `active:true`; old doc has `active:false` and `invalidatedReason:"rotated_by_pushsubscriptionchange"`.
  - Push delivery resumes (re-run A2 and expect delivery on the new subscription).

- [ ] **D2. Renewal while auth expired (401 retry path).** Delete the auth cookie in DevTools, then trigger `pushsubscriptionchange`.
  - Expected: SW first POST returns 401; SW posts `/api/auth/refresh`; if refresh succeeds, renewal POST retries and returns 200. If refresh fails (cookie actually gone), renewal is parked in IDB, not retried in a tight loop.
  - Verify IDB: DevTools → Application → IndexedDB → `nugget-sw` → `pending-renewals` → `current` key exists with the payload on failure, is **absent** on success.

- [ ] **D3. SW killed mid-renewal (parking durability).** Trigger `pushsubscriptionchange` with the network disabled in DevTools (offline mode). Then kill the SW (Application → Service Workers → Stop).
  - Expected: IDB `pending-renewals.current` holds the payload.
  - Re-enable network, then trigger any push or force SW activation (reload page).
  - Expected: `flushPendingRenewal` runs on `activate`, renewal replays, backend 200, IDB entry cleared.

- [ ] **D4. Stale parked renewal (7-day cutoff).** Manually edit the IDB entry to set `queuedAt` to 8 days ago. Wake the SW.
  - Expected: entry is deleted without any network call. (Prevents replay of a rotation so old the server won't match `previousEndpoint`.)

- [ ] **D5. Terminal 4xx doesn't loop.** Block `/api/notifications/sw-renew-subscription` in DevTools network → return 400. Trigger renewal.
  - Expected: IDB entry is cleared after the 400 (non-retryable), no infinite retry.

- [ ] **D6. 5xx stays parked.** Block the same endpoint to return 503.
  - Expected: IDB entry remains; next `activate` or push re-attempts.

---

## E. Subscribe/renew hardening (P0-4, P2)

- [ ] **E1. Rogue endpoint host rejected.** With DevTools → Network → right-click `/api/notifications/subscribe` → Copy as fetch; modify `endpoint` to `https://evil.example.com/push/xyz` and resend.
  - Expected: `400` with message about allowlisted push endpoints. Nothing written to `pushsubscriptions`.

- [ ] **E2. HTTP endpoint rejected.** Same as above but `http://` scheme.
  - Expected: `400`.

- [ ] **E3. Web subscribe without keys.** POST `{platform:"web", endpoint:"https://fcm.googleapis.com/..."}` without `keys`.
  - Expected: `400` — Zod refine catches missing `keys`.

- [ ] **E4. Android subscribe without fcmToken.** POST `{platform:"android", endpoint:"https://fcm.googleapis.com/..."}` without `fcmToken`.
  - Expected: `400` — Zod refine catches missing token.

- [ ] **E5. Renewal for endpoint not owned by caller.** As user A, POST `/sw-renew-subscription` with `previousEndpoint` that belongs to user B.
  - Expected: `404` or `403` (no silent success). No mutation to user B's subscription.

- [ ] **E6. Renewal no-op when endpoint === previousEndpoint.** POST with both fields identical.
  - Expected: `200`, `lastSeenAt` bumped on existing doc, no duplicate created.

---

## F. Admin fleet diagnostics (P0-5)

- [ ] **F1. Fleet counts populate.** As admin, open `/admin/notifications`.
  - Expected panel shows: `enabled`, `queue initialized`, `vapid configured`, total active subscriptions, platform breakdown (`web: N`), 24h counts for `sent_to_provider` / `shown_in_app` / `provider_failures` / `subscriptions_removed`, 1h failure count (red if >0), and a `<details>` block listing up to 5 recent failures.
  - Values match raw DB queries against `pushsubscriptions` and `notificationdeliveries`.

- [ ] **F2. Non-admin blocked.** As a regular user, hit `GET /api/notifications/admin/diagnostics` directly.
  - Expected: `403`.

---

## G. Push delivery across all four contexts

Re-run A2's publish trigger in each state. All four must show the OS notification and route correctly on tap.

- [ ] **G1. Foreground tab** (Chrome app open, site tab visible).
- [ ] **G2. Background tab** (Chrome open, site tab backgrounded — switch to another app).
- [ ] **G3. Browser closed** (swipe Chrome from recents).
- [ ] **G4. Installed PWA** (Add to Home screen, launch from launcher). All of G1/G2/G3 again inside the installed PWA.
  - Extra for G4: tap the maskable icon on the launcher — should render cleanly without being cropped.
  - Notification icon and badge on G4 should not be the generic bell/default — should be the app's PNG.

For each, tap the notification → correct article page opens (not a new duplicate tab when the same URL is already open; this tests the `clients.matchAll` exact-URL match in `notificationclick`).

---

## H. Quiet hours (P1-7)

- [ ] **H1. Quiet hours suppress push.** Set `quietHoursStart`/`End` to bracket the current wall-clock time in the phone's timezone. Trigger a publish.
  - Expected: **no** push; in-app notification still created. `notificationdeliveries` row for push has status indicating suppression.
  - Key check: with `timezone` captured from the phone (verified in A1), suppression uses local wall clock, not UTC.

- [ ] **H2. Quiet hours off-window.** Move the window to not cover the current time. Trigger publish.
  - Expected: push delivers.

---

## I. Cleanup / regression

- [ ] **I1. Unsubscribe from UI.** Toggle off on `/settings/notifications`.
  - `pushsubscriptions` doc for this endpoint → `active:false`. SW `getSubscription()` returns null.

- [ ] **I2. Re-subscribe after unsubscribe.** Toggle back on without clearing site data.
  - New row inserted (or old row reactivated), push delivery resumes.

- [ ] **I3. Stale subscription pruning.** Manually set a subscription's endpoint to a valid-looking-but-dead FCM URL, then publish.
  - Expected: server receives 404/410 from FCM, subscription marked `active:false` with `invalidatedReason`, user's `notificationdeliveries` row has `status:"subscription_removed"`. No repeated failure loop on subsequent publishes.

---

## Sign-off

- [ ] All of A–I pass on the Android test device.
- [ ] All of G pass specifically inside the installed PWA (not just the browser tab).
- [ ] Server logs across the session contain **zero** `[Notifications] post-publish dispatch failed` errors for transitions that should have succeeded.
- [ ] Admin diagnostics `delivery24h.providerFailures` count matches expected (only failures you induced in E/I tests).

If any item fails, capture: the DevTools SW console, the server `pino` output for the matching 5-minute window, and the `notificationdeliveries` rows for the affected user + article.
