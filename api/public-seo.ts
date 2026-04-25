import type { VercelRequest, VercelResponse } from '@vercel/node';

const SITE_NAME = 'Nuggets';
const DEFAULT_SITE_URL = 'https://nuggets.one';
const DEFAULT_IMAGE = '/og-default.png';
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

interface PublicSeoPage {
  path: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  category: 'topic' | 'collection' | 'nugget' | 'comparison' | 'use-case';
  links: Array<{ href: string; label: string }>;
}

interface RemoteResource {
  id?: unknown;
  _id?: unknown;
  title?: unknown;
  name?: unknown;
  rawName?: unknown;
  description?: unknown;
  excerpt?: unknown;
  content?: unknown;
  visibility?: unknown;
  media?: unknown;
  images?: unknown;
}

function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveSiteUrl(): string {
  const fromEnv = process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL;
  return fromEnv && fromEnv.trim() ? normalizeOrigin(fromEnv.trim()) : DEFAULT_SITE_URL;
}

function resolveApiOrigin(): string {
  const fromEnv = process.env.OG_DATA_ORIGIN || process.env.API_ORIGIN || process.env.VITE_API_URL;
  if (!fromEnv || !fromEnv.trim()) return 'https://nuggets-zhih.onrender.com';
  const normalized = normalizeOrigin(fromEnv.trim());
  return normalized.endsWith('/api') ? normalized.slice(0, -4) : normalized;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function titleizeSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const trimmed = value.slice(0, max);
  const lastSpace = trimmed.lastIndexOf(' ');
  return `${lastSpace > max * 0.6 ? trimmed.slice(0, lastSpace) : trimmed}...`;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getNestedRecord(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const nested = (value as Record<string, unknown>)[key];
  return nested && typeof nested === 'object' ? nested as Record<string, unknown> : null;
}

async function fetchRemoteResource(type: 'collection' | 'nugget', slug: string): Promise<RemoteResource | null> {
  if (!OBJECT_ID_RE.test(slug)) return null;
  const apiPath = type === 'collection' ? `/api/collections/${slug}` : `/api/articles/${slug}`;
  try {
    const response = await fetch(`${resolveApiOrigin()}${apiPath}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data = await response.json() as RemoteResource;
    if (type === 'nugget' && data.visibility === 'private') return null;
    return data;
  } catch {
    return null;
  }
}

function staticPageFor(kind: PublicSeoPage['category'], slug: string): PublicSeoPage {
  const label = titleizeSlug(slug);
  const pathPrefix = kind === 'comparison' ? 'compare' : kind === 'use-case' ? 'use-cases' : `${kind}s`;
  const path = `/${pathPrefix}/${slug}`;

  if (kind === 'topic') {
    return {
      path,
      title: `${label} Insights | Nuggets`,
      description: `Curated high-signal ${label.toLowerCase()} insights, sources, and collections on Nuggets.`,
      h1: `${label} insights without the noise`,
      intro: `Explore a focused Nuggets topic page for ${label.toLowerCase()}, with curated signals across markets, geopolitics, AI, and technology.`,
      category: kind,
      links: [
        { href: '/', label: 'Latest Nuggets' },
        { href: '/collections', label: 'Browse collections' },
      ],
    };
  }

  if (kind === 'comparison') {
    return {
      path,
      title: `${label} | Nuggets Comparison`,
      description: `Compare ${label.toLowerCase()} with Nuggets for high-signal research, reading, and knowledge workflows.`,
      h1: `${label}: how Nuggets compares`,
      intro: 'Use this comparison page to evaluate where Nuggets fits in a faster, more focused knowledge workflow.',
      category: kind,
      links: [
        { href: '/', label: 'Try Nuggets' },
        { href: '/use-cases/research-workflow', label: 'Research workflow use case' },
      ],
    };
  }

  if (kind === 'use-case') {
    return {
      path,
      title: `${label} | Nuggets Use Case`,
      description: `Use Nuggets for ${label.toLowerCase()} with curated sources, collections, and high-signal updates.`,
      h1: `${label} with Nuggets`,
      intro: 'Nuggets helps teams and individuals follow useful signals, save context, and revisit important sources without a noisy feed.',
      category: kind,
      links: [
        { href: '/', label: 'Latest Nuggets' },
        { href: '/collections', label: 'Explore collections' },
      ],
    };
  }

  return {
    path,
    title: `${label} | Nuggets`,
    description: `A curated Nuggets page for ${label.toLowerCase()}.`,
    h1: label,
    intro: 'Explore this public Nuggets page and open the app for the full interactive experience.',
    category: kind,
    links: [
      { href: '/', label: 'Latest Nuggets' },
      { href: '/collections', label: 'Browse collections' },
    ],
  };
}

function pageFromRemote(type: 'collection' | 'nugget', slug: string, data: RemoteResource | null): PublicSeoPage {
  const fallback = staticPageFor(type, slug);
  if (!data) return fallback;

  const preview = getNestedRecord(getNestedRecord(data.media, 'previewMetadata'), 'previewMetadata') ||
    getNestedRecord(data.media, 'previewMetadata');
  const remoteTitle =
    asString(data.title) ||
    asString(data.name) ||
    asString(data.rawName) ||
    asString(preview?.title);
  const remoteDescription =
    asString(data.description) ||
    asString(data.excerpt) ||
    asString(data.content) ||
    asString(preview?.description);
  const title = remoteTitle || fallback.h1;
  const description = truncate(remoteDescription || fallback.description, 155);

  return {
    ...fallback,
    title: `${truncate(title, 70)} | Nuggets`,
    description,
    h1: title,
    intro: description,
  };
}

function firstQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function parsePage(req: VercelRequest): { category: PublicSeoPage['category']; slug: string } | null {
  const queryKind = firstQueryValue(req.query.kind);
  const querySlug = firstQueryValue(req.query.slug);
  if (queryKind && querySlug) {
    const queryCategoryMap: Record<string, PublicSeoPage['category'] | undefined> = {
      topic: 'topic',
      collection: 'collection',
      nugget: 'nugget',
      comparison: 'comparison',
      'use-case': 'use-case',
    };
    const category = queryCategoryMap[queryKind];
    if (category) return { category, slug: querySlug };
  }

  const path = req.url?.split('?')[0] || '/';
  const match = path.match(/^\/(topics|collections|nuggets|compare|use-cases)\/([^/?#]+)$/);
  if (!match) return null;
  const slug = decodeURIComponent(match[2]);
  const categoryMap: Record<string, PublicSeoPage['category']> = {
    topics: 'topic',
    collections: 'collection',
    nuggets: 'nugget',
    compare: 'comparison',
    'use-cases': 'use-case',
  };
  return { category: categoryMap[match[1]], slug };
}

function jsonLd(page: PublicSeoPage, canonicalUrl: string): string {
  const type = page.category === 'collection'
    ? 'CollectionPage'
    : page.category === 'nugget'
      ? 'Article'
      : 'WebPage';
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': type,
    name: page.h1,
    headline: page.h1,
    description: page.description,
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: `${resolveSiteUrl()}/`,
    },
  }).replace(/</g, '\\u003c');
}

function renderPage(page: PublicSeoPage): string {
  const siteUrl = resolveSiteUrl();
  const canonicalUrl = `${siteUrl}${page.path}`;
  const imageUrl = `${siteUrl}${DEFAULT_IMAGE}`;
  const links = page.links
    .map((link) => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(page.title)}</title>
<meta name="description" content="${escapeHtml(page.description)}" />
<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
<meta property="og:type" content="${page.category === 'nugget' ? 'article' : 'website'}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:title" content="${escapeHtml(page.title)}" />
<meta property="og:description" content="${escapeHtml(page.description)}" />
<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
<meta property="og:image" content="${escapeHtml(imageUrl)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(page.title)}" />
<meta name="twitter:description" content="${escapeHtml(page.description)}" />
<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
<script type="application/ld+json">${jsonLd(page, canonicalUrl)}</script>
<style>
body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a}
main{max-width:760px;margin:0 auto;padding:72px 24px}
.eyebrow{color:#a16207;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
h1{font-size:clamp(2rem,5vw,3.5rem);line-height:1.05;margin:.75rem 0 1rem}
p{font-size:1.125rem;line-height:1.75;color:#475569}
nav{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
a{border:1px solid #e2e8f0;border-radius:999px;padding:10px 14px;color:#0f172a;text-decoration:none;font-weight:700;background:white}
@media (prefers-color-scheme:dark){body{background:#020617;color:#f8fafc}p{color:#cbd5e1}a{background:#0f172a;color:#f8fafc;border-color:#334155}}
</style>
</head>
<body>
<main>
<div class="eyebrow">${escapeHtml(SITE_NAME)}</div>
<h1>${escapeHtml(page.h1)}</h1>
<p>${escapeHtml(page.intro)}</p>
<nav aria-label="Related Nuggets pages">${links}</nav>
</main>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method Not Allowed');
  }

  const parsed = parsePage(req);
  if (!parsed) return res.status(404).send('Not Found');

  const remote = parsed.category === 'collection' || parsed.category === 'nugget'
    ? await fetchRemoteResource(parsed.category, parsed.slug)
    : null;
  const page = parsed.category === 'collection' || parsed.category === 'nugget'
    ? pageFromRemote(parsed.category, parsed.slug, remote)
    : staticPageFor(parsed.category, parsed.slug);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(renderPage(page));
}
