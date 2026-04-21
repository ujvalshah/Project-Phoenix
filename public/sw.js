// Nugget News — Push Notification Service Worker
// This file is served as-is from /sw.js (not bundled by Vite)

// Activate new SW immediately rather than waiting for all tabs to close —
// otherwise a fix to push handling can sit behind a stale worker for days.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // Take control of pages already open under the previous SW so they get the
  // new push/notificationclick handlers without needing a hard reload.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'Nugget News',
      body: event.data.text(),
      data: { url: '/' },
    };
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/badge-72.png',
    data: payload.data || {},
    tag: payload.data?.articleId || 'nugget-notification',
    renotify: true,
    actions: [
      { action: 'open', title: 'Read' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Nugget News', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil((async () => {
    const absoluteUrl = new URL(url, self.location.origin).toString();
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });

    // First try exact URL match to avoid hijacking unrelated tabs.
    for (const client of clientList) {
      if (client.url === absoluteUrl && 'focus' in client) {
        return client.focus();
      }
    }
    // Then any same-origin client; navigate it to target.
    for (const client of clientList) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        client.navigate(absoluteUrl);
        return client.focus();
      }
    }
    return clients.openWindow(absoluteUrl);
  })());
});

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Tiny IDB wrapper for parking a pending renewal across SW restarts. The SW
// can be terminated mid-renewal (e.g., user closes the last tab, OS reclaims
// memory). Persisting the new subscription means the next push or page load
// can replay the renewal instead of dropping it on the floor.
const DB_NAME = 'nugget-sw';
const STORE = 'pending-renewals';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key, value) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // IDB is best-effort — losing the durable copy doesn't break the live attempt.
  }
}

async function idbGet(key) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbDelete(key) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* ignore */ }
}

async function refreshAuthOnce() {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// POSTs the renewal and retries once after an auth refresh on 401. On other
// 4xx (validation, unknown previous endpoint) we don't retry — the backend
// has rejected for a structural reason that won't change on replay.
async function renewSubscriptionWithBackend(payload) {
  const post = () => fetch('/api/notifications/sw-renew-subscription', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let res = await post();
  if (res.status === 401) {
    const refreshed = await refreshAuthOnce();
    if (refreshed) res = await post();
  }
  return res;
}

function buildRenewalPayload(newSubscription, previousEndpoint) {
  return {
    platform: 'web',
    endpoint: newSubscription.endpoint,
    previousEndpoint,
    keys: {
      p256dh: btoa(String.fromCharCode(...new Uint8Array(newSubscription.getKey('p256dh')))),
      auth: btoa(String.fromCharCode(...new Uint8Array(newSubscription.getKey('auth')))),
    },
  };
}

async function flushPendingRenewal() {
  const pending = await idbGet('current');
  if (!pending) return;

  // Stop replaying anything older than 7 days — the endpoint will likely have
  // rotated again and the backend will reject the stale previousEndpoint.
  if (Date.now() - (pending.queuedAt || 0) > 7 * 24 * 60 * 60 * 1000) {
    await idbDelete('current');
    return;
  }

  const res = await renewSubscriptionWithBackend(pending.payload);
  // Drop on success or on any non-retryable response (4xx other than 401, or
  // 2xx). 5xx stays parked so the next event can try again.
  if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 401)) {
    await idbDelete('current');
  }
}

self.addEventListener('pushsubscriptionchange', (event) => {
  // Re-subscribe when the browser rotates the push subscription. The backend
  // requires the previous endpoint as proof of which subscription is being
  // rotated — capture it before calling subscribe(), since subscribe() can
  // null out the old subscription on some browsers.
  event.waitUntil((async () => {
    const previous = event.oldSubscription
      || (await self.registration.pushManager.getSubscription());
    const previousEndpoint = previous?.endpoint;
    if (!previousEndpoint) {
      // No prior subscription known — nothing to renew. The user will re-subscribe via the UI.
      return;
    }

    const keyResponse = await fetch('/api/notifications/vapid-key', { credentials: 'include' });
    const keyData = await keyResponse.json();
    if (!keyData?.publicKey) {
      throw new Error('VAPID key unavailable for SW renewal');
    }
    const newSubscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });

    const payload = buildRenewalPayload(newSubscription, previousEndpoint);

    // Park the renewal *before* the network call so a SW kill mid-flight is
    // recoverable. We clear it on confirmed success (or terminal failure).
    await idbPut('current', { payload, queuedAt: Date.now() });

    const res = await renewSubscriptionWithBackend(payload);
    if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 401)) {
      await idbDelete('current');
    }
    // 5xx / network error: leave parked; flushPendingRenewal() will retry on
    // the next push or activate.
  })());
});

// Opportunistically retry any parked renewal whenever the SW wakes up. Keeps
// the queue from growing if the user comes back after an outage.
self.addEventListener('activate', (event) => {
  event.waitUntil(flushPendingRenewal());
});
