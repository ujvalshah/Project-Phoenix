/**
 * Open Graph Middleware
 *
 * Detects social-media crawlers (WhatsApp, Facebook, Twitter, LinkedIn, Slack,
 * Discord, Telegram) and returns a lightweight HTML page with per-resource OG
 * meta tags. Regular browsers fall through to the SPA catch-all.
 *
 * Supported routes:
 *   /article/:id   — dynamic OG for a public article (nugget)
 *   /collections/:id — dynamic OG for a collection
 */

import { Request, Response, NextFunction } from 'express';
import { Article } from '../models/Article.js';
import { Collection } from '../models/Collection.js';
import { getLogger } from '../utils/logger.js';

// User-agent fragments emitted by major social crawlers
const CRAWLER_UA =
  /whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|slack-imgproxy|discordbot|telegrambot|googlebot|bingbot|yandexbot|rogerbot|embedly|quora link preview|showyoubot|outbrain|pinterest|applebot/i;

// 24-char hex string (MongoDB ObjectId)
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

/** Escape string for safe embedding inside HTML attribute values. */
function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Truncate to `max` characters without cutting a word mid-way. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const trimmed = text.slice(0, max);
  const lastSpace = trimmed.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? trimmed.slice(0, lastSpace) : trimmed) + '…';
}

interface OgMeta {
  title: string;
  description: string;
  image: string;
  url: string;
  type: 'article' | 'website';
  siteName: string;
  publishedTime?: string;
}

/** Detect image MIME type from URL extension. Returns null if unknown. */
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

/** Build a minimal HTML document containing only OG + Twitter Card meta tags. */
function renderOgHtml(meta: OgMeta): string {
  const t = escapeAttr(meta.title);
  const d = escapeAttr(meta.description);
  const i = escapeAttr(meta.image);
  const u = escapeAttr(meta.url);
  const s = escapeAttr(meta.siteName);

  const imageMime = detectImageMime(meta.image);
  const imageTypeLine = imageMime
    ? `\n<meta property="og:image:type" content="${imageMime}" />`
    : '';

  const publishedTimeLine = meta.publishedTime
    ? `\n<meta property="article:published_time" content="${escapeAttr(meta.publishedTime)}" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${t} — ${s}</title>
<meta name="description" content="${d}" />
<meta property="og:type" content="${meta.type}" />
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

/**
 * Express middleware — intercepts crawler requests for article/collection
 * pages and returns OG-enriched HTML. All other requests pass through.
 */
export function ogMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ua = req.headers['user-agent'] || '';
  if (!CRAWLER_UA.test(ua)) {
    next();
    return;
  }

  // Only handle GET requests for shareable pages
  if (req.method !== 'GET') {
    next();
    return;
  }

  const logger = getLogger();
  const baseUrl = `${req.protocol}://${req.get('host') || 'localhost'}`;
  const defaultImage = `${baseUrl}/og-default.png`;

  // --- /article/:id ---
  const articleMatch = req.path.match(/^\/article\/([^/]+)$/);
  if (articleMatch && OBJECT_ID_RE.test(articleMatch[1])) {
    const articleId = articleMatch[1];

    Article.findById(articleId)
      .lean()
      .then((article) => {
        if (!article || article.visibility === 'private') {
          // Fall through to SPA — will show 404 or private message client-side
          next();
          return;
        }

        const title = truncate(article.title || 'Untitled', 70);
        const description = truncate(
          article.excerpt || article.content || '',
          155,
        );

        // Pick best available image, ensuring absolute URL
        let image =
          (article.media as any)?.previewMetadata?.imageUrl ||
          (article.media as any)?.thumbnail_url ||
          (article.images && article.images.length > 0
            ? article.images[0]
            : null) ||
          defaultImage;

        if (image && !image.startsWith('http')) {
          image = `${baseUrl}${image.startsWith('/') ? '' : '/'}${image}`;
        }

        // Extract published date for article:published_time
        const publishedTime =
          (article as any).publishedAt ||
          (article as any).customCreatedAt ||
          (article as any).created_at;

        const html = renderOgHtml({
          title,
          description,
          image,
          url: `${baseUrl}/article/${articleId}`,
          type: 'article',
          siteName: 'Nuggets',
          publishedTime: publishedTime || undefined,
        });

        logger.info({
          msg: '[OG] Served article OG',
          articleId,
          crawler: ua.slice(0, 80),
        });

        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.status(200).type('html').send(html);
      })
      .catch((err: Error) => {
        logger.warn({
          msg: '[OG] Article lookup failed, falling through',
          articleId,
          error: err.message,
        });
        next();
      });

    return; // async — don't call next() synchronously
  }

  // --- /collections/:id ---
  const collectionMatch = req.path.match(/^\/collections\/([^/]+)$/);
  if (collectionMatch && OBJECT_ID_RE.test(collectionMatch[1])) {
    const collectionId = collectionMatch[1];

    Collection.findById(collectionId)
      .lean()
      .then((collection) => {
        if (!collection) {
          next();
          return;
        }

        const name =
          (collection as any).rawName ||
          (collection as any).name ||
          'Collection';
        const title = truncate(name, 50);
        const description = truncate(
          (collection as any).description || `A curated collection on Nuggets`,
          155,
        );

        const html = renderOgHtml({
          title,
          description,
          image: defaultImage,
          url: `${baseUrl}/collections/${collectionId}`,
          type: 'website',
          siteName: 'Nuggets',
        });

        logger.info({
          msg: '[OG] Served collection OG',
          collectionId,
          crawler: ua.slice(0, 80),
        });

        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.status(200).type('html').send(html);
      })
      .catch((err: Error) => {
        logger.warn({
          msg: '[OG] Collection lookup failed, falling through',
          collectionId,
          error: err.message,
        });
        next();
      });

    return;
  }

  // Not a shareable page — pass through
  next();
}
