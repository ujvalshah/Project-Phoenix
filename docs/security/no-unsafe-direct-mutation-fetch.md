# ESLint Guardrail: `no-unsafe-direct-mutation-fetch`

## What this prevents

This rule blocks auth/CSRF contract drift after the cookie-auth migration.

It flags mutating direct network calls (`POST`, `PUT`, `PATCH`, `DELETE`) to same-origin backend routes (such as `/api/*`, `/admin/*`, `/media/*`) when they bypass the shared security contract.

Without this guardrail, requests may work initially and then fail once the `csrf_token` cookie exists.

## What is allowed

- `apiClient` calls (`apiClient.post`, `apiClient.put`, `apiClient.delete`, `apiClient.request`, etc.)
- direct `GET` requests (for read/export/download flows)
- direct requests to external URLs (for example YouTube oEmbed)
- direct mutation fetch only when shared CSRF helper is present in headers (for example `getCsrfHeaders()`)

## What is disallowed

- raw `fetch('/api/...', { method: 'POST' })` without CSRF helper
- raw `fetch('/admin/...', { method: 'DELETE' })` without CSRF helper
- `XMLHttpRequest` mutations to backend routes
- custom `client.request('/admin/...', { method: 'PATCH' })` calls without CSRF helper (unless routed through `apiClient`)

## How to fix a violation

Prefer one of these:

1. Route through `apiClient`:

```ts
await apiClient.post('/admin/tagging/import', payload);
```

2. If raw `fetch` is necessary (for example multipart upload), include shared CSRF headers:

```ts
import { getCsrfHeaders } from '@/utils/csrf';

await fetch(`${apiBase}/media/upload/cloudinary`, {
  method: 'POST',
  credentials: 'include',
  headers: getCsrfHeaders(),
  body: formData,
});
```

## Notes on false positives

The rule intentionally limits scope to mutation methods and backend-like route patterns to avoid broad noise:

- It does not flag `GET` requests.
- It does not flag absolute external URLs (`http://`, `https://`).
- It treats `apiClient` calls as compliant by design.
