import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SITE_NAME = 'Nuggets';
const DEFAULT_SITE_URL = 'https://nuggets.one';

function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveCanonicalSiteUrl(): string {
  const fromEnv = process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL;
  if (fromEnv && fromEnv.trim()) {
    return normalizeOrigin(fromEnv.trim());
  }
  return DEFAULT_SITE_URL;
}

function resolveApiOrigin(): string {
  const fromEnv =
    process.env.OG_DATA_ORIGIN ||
    process.env.API_ORIGIN ||
    process.env.VITE_API_URL;
  if (fromEnv && fromEnv.trim()) {
    const normalized = normalizeOrigin(fromEnv.trim());
    return normalized.endsWith('/api')
      ? normalized.slice(0, -4)
      : normalized;
  }
  return 'https://nuggets-zhih.onrender.com';
}

/** User-agent fragments emitted by social-media crawlers. */
const CRAWLER_RE =
  /whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|slack-imgproxy|discordbot|telegrambot|googlebot|bingbot|yandexbot|rogerbot|embedly|quora link preview|showyoubot|outbrain|pinterest|applebot/i;

/** Extract article or collection ID from the URL path. */
function parseRoute(path: string): { type: 'article' | 'collection'; id: string } | null {
  const articleMatch = path.match(/^\/article\/([a-f0-9]{24})$/i);
  if (articleMatch) return { type: 'article', id: articleMatch[1] };

  const collectionMatch = path.match(/^\/collections\/([a-f0-9]{24})$/i);
  if (collectionMatch) return { type: 'collection', id: collectionMatch[1] };

  return null;
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const trimmed = text.slice(0, max);
  const lastSpace = trimmed.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? trimmed.slice(0, lastSpace) : trimmed) + '\u2026';
}

function detectImageMime(url: string): string | null {
  const extMatch = url.split('?')[0].match(/\.(jpe?g|png|webp|gif)$/i);
  if (!extMatch) return null;
  const ext = extMatch[1].toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return null;
}

interface OgData {
  title: string;
  description: string;
  image: string;
  url: string;
  type: 'article' | 'website';
  publishedTime?: string;
}

function buildOgHtml(og: OgData): string {
  const t = escapeAttr(og.title);
  const d = escapeAttr(og.description);
  const i = escapeAttr(og.image);
  const u = escapeAttr(og.url);
  const s = escapeAttr(SITE_NAME);

  const imageMime = detectImageMime(og.image);
  const imageTypeLine = imageMime
    ? `\n<meta property="og:image:type" content="${imageMime}" />`
    : '';

  const publishedTimeLine = og.publishedTime
    ? `\n<meta property="article:published_time" content="${escapeAttr(og.publishedTime)}" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${t} — ${s}</title>
<meta name="description" content="${d}" />
<meta property="og:type" content="${og.type}" />
<meta property="og:site_name" content="${s}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${i}" />${imageTypeLine}
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="${u}" />
<meta property="og:locale" content="en_IN" />${publishedTimeLine}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${i}" />
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
</body>
</html>`;
}

/** Build OG data from an article API response. */
function articleToOg(article: Record<string, unknown>): OgData {
  const siteUrl = resolveCanonicalSiteUrl();
  const defaultImage = `${siteUrl}/og-default.png`;
  const media = article.media as Record<string, unknown> | undefined;
  const previewMeta = media?.previewMetadata as Record<string, unknown> | undefined;

  const title = truncate(
    ((article.title as string) || '').trim() ||
      ((previewMeta?.title as string) || '').trim() ||
      'Nugget from Nuggets',
    70
  );
  const description = truncate(
    ((article.excerpt as string) || '').trim() ||
      ((article.content as string) || '').trim() ||
      ((previewMeta?.description as string) || '').trim() ||
      'Read this nugget on Nuggets.',
    155
  );

  let image =
    (previewMeta?.imageUrl as string) ||
    (media?.thumbnail_url as string) ||
    ((article.images as string[])?.length ? (article.images as string[])[0] : null) ||
    defaultImage;

  if (image && !image.startsWith('http')) {
    image = `${siteUrl}${image.startsWith('/') ? '' : '/'}${image}`;
  }

  return {
    title,
    description,
    image,
    url: `${siteUrl}/article/${article.id}`,
    type: 'article',
    publishedTime:
      (article.publishedAt as string) ||
      (article.customCreatedAt as string) ||
      (article.created_at as string) ||
      undefined,
  };
}

/** Build OG data from a collection API response. */
function collectionToOg(collection: Record<string, unknown>): OgData {
  const siteUrl = resolveCanonicalSiteUrl();
  const defaultImage = `${siteUrl}/og-default.png`;
  const name = (collection.rawName as string) || (collection.name as string) || 'Collection';
  return {
    title: truncate(name, 70),
    description: truncate(
      ((collection.description as string) || '').trim() || `A curated collection on ${SITE_NAME}.`,
      155,
    ),
    image: defaultImage,
    url: `${siteUrl}/collections/${collection.id || collection._id}`,
    type: 'website',
  };
}

// --- SPA fallback ---

let spaHtml: string | null = null;
function getSpaHtml(): string | null {
  if (spaHtml === null) {
    const candidates = [
      join(process.cwd(), 'dist', 'index.html'),
      join(process.cwd(), 'index.html'),
      join(process.cwd(), '.output', 'public', 'index.html'),
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        spaHtml = readFileSync(p, 'utf-8');
        break;
      }
    }
  }
  return spaHtml;
}

function serveSpa(res: VercelResponse): void {
  const html = getSpaHtml();
  if (html) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.status(200).send(html);
  } else {
    res.redirect(302, '/');
  }
}

// --- Handler ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ua = req.headers['user-agent'] || '';
  const path = req.url?.split('?')[0] || '/';

  // Normal users → serve SPA shell
  if (!CRAWLER_RE.test(ua)) {
    return serveSpa(res);
  }

  // Crawlers → fetch article/collection data from API, build OG HTML
  const route = parseRoute(path);
  if (!route) {
    return serveSpa(res);
  }

  try {
    const apiPath = route.type === 'article'
      ? `/api/articles/${route.id}`
      : `/api/collections/${route.id}`;

    const response = await fetch(`${resolveApiOrigin()}${apiPath}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return serveSpa(res);
    }

    const data = await response.json() as Record<string, unknown>;

    // Skip private articles
    if (route.type === 'article' && data.visibility === 'private') {
      return serveSpa(res);
    }

    const og = route.type === 'article' ? articleToOg(data) : collectionToOg(data);
    const html = buildOgHtml(og);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(html);
  } catch {
    return serveSpa(res);
  }
}
