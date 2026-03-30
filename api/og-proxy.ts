import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const RENDER_ORIGIN = 'https://nuggetszhih.onrender.com';

/** User-agent fragments emitted by social-media crawlers. */
const CRAWLER_RE =
  /whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|slack-imgproxy|discordbot|telegrambot|googlebot|bingbot|yandexbot|rogerbot|embedly|quora link preview|showyoubot|outbrain|pinterest|applebot/i;

/**
 * Resolve the SPA index.html from Vercel's build output.
 * Vercel places files in different locations depending on the build,
 * so we check multiple known paths.
 */
function findIndexHtml(): string | null {
  const candidates = [
    join(process.cwd(), 'dist', 'index.html'),
    join(process.cwd(), 'index.html'),
    join(process.cwd(), '.output', 'public', 'index.html'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return readFileSync(p, 'utf-8');
    }
  }
  return null;
}

/** Cache the SPA shell in memory after first read. */
let spaHtml: string | null = null;
function getSpaHtml(): string | null {
  if (spaHtml === null) {
    spaHtml = findIndexHtml();
  }
  return spaHtml;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ua = req.headers['user-agent'] || '';
  const path = req.url || '/';

  // Normal users → serve SPA shell so React Router handles the route client-side
  if (!CRAWLER_RE.test(ua)) {
    const html = getSpaHtml();
    if (html) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      return res.status(200).send(html);
    }
    // index.html not found in function — redirect to root and let Vercel serve it
    return res.redirect(302, '/');
  }

  // Crawlers → proxy to Render backend for dynamic OG tags
  try {
    const renderUrl = `${RENDER_ORIGIN}${path}`;
    const response = await fetch(renderUrl, {
      headers: { 'User-Agent': ua },
    });

    const html = await response.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(response.status).send(html);
  } catch {
    // If Render is down/sleeping, redirect to root as fallback
    return res.redirect(302, '/');
  }
}
