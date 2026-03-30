import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';

const RENDER_ORIGIN = 'https://nuggetszhih.onrender.com';

/** User-agent fragments emitted by social-media crawlers. */
const CRAWLER_RE =
  /whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|slack-imgproxy|discordbot|telegrambot|googlebot|bingbot|yandexbot|rogerbot|embedly|quora link preview|showyoubot|outbrain|pinterest|applebot/i;

/** Cache the SPA shell in memory — it's the same for every non-crawler request. */
let spaHtml: string | null = null;
function getSpaHtml(): string {
  if (!spaHtml) {
    spaHtml = readFileSync(join(process.cwd(), 'dist', 'index.html'), 'utf-8');
  }
  return spaHtml;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ua = req.headers['user-agent'] || '';
  const path = req.url || '/';

  // Normal users → serve SPA shell so React Router handles the route client-side
  if (!CRAWLER_RE.test(ua)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.status(200).send(getSpaHtml());
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
    // If Render is down/sleeping, serve SPA as fallback (no OG but at least page loads)
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(getSpaHtml());
  }
}
