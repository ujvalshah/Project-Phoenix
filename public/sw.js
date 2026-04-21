// Nugget News — Push Notification Service Worker
// This file is served as-is from /sw.js (not bundled by Vite)

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

async function renewSubscriptionWithBackend(newSubscription) {
  await fetch('/api/notifications/sw-renew-subscription', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: 'web',
      endpoint: newSubscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(newSubscription.getKey('p256dh')))),
        auth: btoa(String.fromCharCode(...new Uint8Array(newSubscription.getKey('auth')))),
      },
    }),
  });
}

self.addEventListener('pushsubscriptionchange', (event) => {
  // Re-subscribe when the browser rotates the push subscription
  event.waitUntil((async () => {
    const keyResponse = await fetch('/api/notifications/vapid-key', { credentials: 'include' });
    const keyData = await keyResponse.json();
    if (!keyData?.publicKey) {
      throw new Error('VAPID key unavailable for SW renewal');
    }
    const newSubscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });
    await renewSubscriptionWithBackend(newSubscription);
  })());
});
