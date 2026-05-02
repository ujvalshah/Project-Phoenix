/**
 * Poll until `/api/health` reports Mongo is ready.
 * Tries the Vite dev origin (`/api` proxy) first, then a direct backend URL so local runs
 * succeed even when :3000 returns 200 HTML (SPA fallback) or the proxy is misbehaving.
 */

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '');
}

/** Matches `server/src/index.ts` healthy JSON and common alternates. */
function isMongoReadyPayload(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const o = body as Record<string, unknown>;
  if (o.status === 'ok' || o.status === 'healthy') return true;

  const deps = o.dependencies;
  if (!deps || typeof deps !== 'object') return false;
  const database = (deps as Record<string, unknown>).database;
  if (!database || typeof database !== 'object') return false;
  return (database as { status?: string }).status === 'up';
}

function collectHealthProbeUrls(webOrigin: string): string[] {
  const primary = `${normalizeOrigin(webOrigin)}/api/health`;
  const fromEnv = process.env.PLAYWRIGHT_HEALTH_URL?.trim();
  if (fromEnv) {
    return [...new Set([primary, fromEnv])];
  }

  const apiBase = process.env.PLAYWRIGHT_API_BASE?.replace(/\/+$/, '');
  if (apiBase?.endsWith('/api')) {
    return [...new Set([primary, `${apiBase}/health`])];
  }

  return [...new Set([primary, 'http://localhost:5000/api/health'])];
}

export async function waitForBackendHealthy(
  origin: string = process.env.PLAYWRIGHT_WEB_ORIGIN || 'http://localhost:3000',
  timeoutMs = 180_000,
  pollMs = 750,
): Promise<void> {
  const urls = collectHealthProbeUrls(origin);
  const started = Date.now();
  let lastNote = '';

  while (Date.now() - started < timeoutMs) {
    for (const url of urls) {
      try {
        const res = await fetch(url);
        lastNote = `HTTP ${res.status} (${url})`;
        const text = await res.text();
        const trimmed = text.trim();

        if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
          lastNote = `HTTP ${res.status} HTML not JSON (${url})`;
          continue;
        }

        let body: unknown;
        try {
          body = trimmed ? JSON.parse(trimmed) : {};
        } catch {
          lastNote = `HTTP ${res.status} invalid JSON (${url})`;
          continue;
        }

        if (res.ok && isMongoReadyPayload(body)) {
          return;
        }

        const top = (body as { status?: string })?.status;
        lastNote = `HTTP ${res.status} status=${top ?? 'unknown'} (${url})`;
      } catch (e) {
        lastNote = e instanceof Error ? e.message : String(e);
      }
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error(
    `Backend not healthy within ${timeoutMs}ms (tried ${urls.join(', ')}). Last: ${lastNote}`,
  );
}
