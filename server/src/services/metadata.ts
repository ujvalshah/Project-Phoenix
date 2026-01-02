/**
 * Metadata-First Content Preview System
 * 
 * Philosophy: "Every card is a decision surface, not a consumption surface."
 * 
 * NON-NEGOTIABLE:
 * - NO iframes
 * - NO third-party SDKs for normal users
 * - NO aggressive scraping
 * - Stability > richness
 * - UX consistency > perfect previews
 * 
 * PHASE 2: TITLE GENERATION POLICY (NON-NEGOTIABLE)
 * 
 * Title field is OPTIONAL.
 * The system must NEVER auto-add or auto-modify the title.
 * Title generation must happen ONLY when the user explicitly clicks a "Generate title" button.
 * 
 * Metadata may SUGGEST a title (stored in Nugget.title for transformation to previewMetadata.title)
 * but must NEVER mutate state automatically.
 * 
 * Backend stores metadata titles in Nugget.title for transformation purposes only.
 * Frontend transforms this to previewMetadata.title and uses it ONLY for the suggestion button.
 * Frontend NEVER auto-populates the title field from metadata.
 * 
 * REGRESSION SAFEGUARD: If you see code that sets article.title from metadata automatically,
 * that is a BUG and must be removed immediately.
 */

import ogs from 'open-graph-scraper';
import probe from 'probe-image-size';
import { URL } from 'url';
import type { Nugget } from '../../../src/types/nugget.js';
import { LRUCache } from '../utils/lruCache.js';
import { withTimeout, createTimeoutController } from '../utils/timeout.js';

// Feature flags
const MICROLINK_ENABLED = process.env.MICROLINK_ENABLED === 'true';
const MICROLINK_ADMIN_ONLY = process.env.MICROLINK_ADMIN_ONLY !== 'false'; // default true
const MICROLINK_API_KEY = process.env.MICROLINK_API_KEY;

// LRU Cache with max size to prevent memory leaks
// Cache ALL results including fallbacks to prevent repeated slow attempts
const MAX_CACHE_SIZE = parseInt(process.env.UNFURL_CACHE_SIZE || '5000', 10);
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const cache = new LRUCache<Nugget>(MAX_CACHE_SIZE, CACHE_TTL);

function getCached(url: string): Nugget | null {
  return cache.get(url);
}

function setCached(url: string, nugget: Nugget): void {
  cache.set(url, nugget);
}

// Timeouts (in milliseconds)
const TIER_0_TIMEOUT = 0; // No network, instant
const TIER_0_5_TIMEOUT = 800; // Twitter oEmbed
const TIER_1_TIMEOUT = 1500; // Microlink
const TIER_2_TIMEOUT = 1500; // Open Graph
const TIER_3_TIMEOUT = 1000; // Image probing
const TOTAL_TIMEOUT = 5000; // Hard limit

// Audit Phase-2 Fix: Retry wrapper for transient network errors
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      // Only retry on transient network errors
      const isTransientError = error.code === 'ETIMEDOUT' || 
                              error.code === 'ECONNRESET' ||
                              error.name === 'AbortError' ||
                              (error.message && (
                                error.message.includes('timeout') ||
                                error.message.includes('ECONNRESET') ||
                                error.message.includes('ETIMEDOUT')
                              ));
      
      if (i === maxRetries - 1 || !isTransientError) {
        throw error;
      }
      
      // Exponential backoff: delay * (i + 1)
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}

// Platform colors
const PLATFORM_COLORS: Record<string, string> = {
  'youtube.com': '#FF0000',
  'youtu.be': '#FF0000',
  'twitter.com': '#1DA1F2',
  'x.com': '#000000',
};

// Known platform names
const PLATFORM_NAMES: Record<string, string> = {
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'twitter.com': 'Twitter',
  'x.com': 'X',
  'substack.com': 'Substack',
  'medium.com': 'Medium',
};

/**
 * Parse URL and extract domain
 */
function parseUrl(urlString: string): { url: URL; domain: string } {
  try {
    const url = new URL(urlString);
    const domain = url.hostname.replace('www.', '');
    return { url, domain };
  } catch {
    // Invalid URL, create a fallback
    const url = new URL('https://example.com');
    return { url, domain: 'unknown' };
  }
}

/**
 * Shared content classification rule (must match frontend logic)
 * 
 * An URL is considered an IMAGE if:
 * - It ends with .jpg / .jpeg / .png / .webp / .gif
 * - OR matches known CDN image hosts (images.ctfassets.net, thumbs.*, cdn.*)
 * 
 * DO NOT fetch metadata for image URLs.
 */
function isImageUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const pathname = url.pathname.toLowerCase();
    const hostname = url.hostname.toLowerCase();
    
    // Check for image file extensions
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    if (imageExts.some(ext => pathname.endsWith(ext))) {
      return true;
    }
    
    // Check for known CDN image hosts
    if (
      hostname.includes('images.ctfassets.net') ||
      hostname.includes('thumbs.') ||
      hostname.includes('cdn.') ||
      hostname.includes('img.') ||
      hostname.includes('image.')
    ) {
      // Additional check: ensure it's likely an image URL (not just a CDN serving HTML)
      // If it has query params like ?fm=webp or ?q=70, it's likely an image
      if (urlString.includes('fm=') || urlString.includes('q=') || urlString.includes('format=')) {
        return true;
      }
      // If pathname suggests image (no .html, .php, etc.)
      if (!pathname.endsWith('.html') && !pathname.endsWith('.php') && !pathname.endsWith('/')) {
        return true;
      }
    }
  } catch {
    // Invalid URL, fallback to extension check only
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    if (imageExts.some(ext => urlString.toLowerCase().endsWith(ext))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Detect content type from URL
 */
function detectContentType(url: URL, domain: string): Nugget['contentType'] {
  const pathname = url.pathname.toLowerCase();
  const hostname = url.hostname.toLowerCase();

  // YouTube
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    return 'video';
  }

  // Twitter/X
  if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
    return 'social';
  }

  // Use shared image detection logic
  const urlString = url.toString();
  if (isImageUrl(urlString)) {
    return 'image';
  }

  // Documents
  const docExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.zip'];
  if (docExts.some(ext => pathname.endsWith(ext))) {
    return 'document';
  }

  // Default to article
  return 'article';
}

/**
 * PHASE 2: REMOVED - Auto-title generation is completely disabled.
 * 
 * Title generation must happen ONLY when the user explicitly clicks a "Generate title" button.
 * The system must NEVER auto-add or auto-modify the title.
 * 
 * Metadata may SUGGEST a title (stored in previewMetadata.title) but must NEVER mutate state automatically.
 * 
 * This function is kept for backward compatibility but always returns false.
 * All title generation logic has been removed.
 */
function shouldAutoGenerateTitle(contentType: Nugget['contentType'], urlString?: string): boolean {
  // PHASE 2: Always return false - no auto-title generation allowed
  return false;
}

/**
 * TIER 0: Zero Risk - URL parsing only
 * Always returns a valid Nugget shell instantly
 * 
 * PHASE 2: NO title generation - title is always null/undefined.
 * Title generation must happen ONLY when the user explicitly clicks a "Generate title" button.
 * Metadata may SUGGEST a title (stored in previewMetadata.title) but must NEVER mutate state automatically.
 */
function tier0(urlString: string): Nugget {
  const { url, domain } = parseUrl(urlString);
  const contentType = detectContentType(url, domain);
  const platformName = PLATFORM_NAMES[domain] || domain;
  const platformColor = PLATFORM_COLORS[domain];

  // PHASE 2: Title is ALWAYS null - no auto-generation under any circumstance
  // Title comes ONLY from user input or explicit "Generate title" button click
  // Metadata title will be stored in previewMetadata.title for suggestion purposes only

  return {
    id: `nugget-${Date.now()}`,
    url: urlString,
    domain,
    contentType,
    title: undefined, // PHASE 2: Always undefined - no auto-generation
    source: {
      name: platformName,
      domain,
      platformColor,
    },
    quality: 'fallback',
  };
}

/**
 * TIER 0.5: Optional Twitter oEmbed (non-blocking)
 * Only for Twitter/X, timeout 800ms, never blocks fallback
 */
async function tier0_5(urlString: string, domain: string): Promise<Partial<Nugget> | null> {
  if (!domain.includes('twitter.com') && !domain.includes('x.com')) {
    return null;
  }

  try {
    const { controller, cleanup } = createTimeoutController(TIER_0_5_TIMEOUT);

    const oEmbedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(urlString)}`;
    // Audit Phase-2 Fix: Add retry logic for transient network errors
    const fetchPromise = fetchWithRetry(() => fetch(oEmbedUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    }), 2, 200);

    const response = await withTimeout(fetchPromise, TIER_0_5_TIMEOUT, controller.signal);
    cleanup();

    if (!response || !response.ok) {
      return null;
    }

    const data = await response.json();
    
    // Extract minimal enrichment (never critical)
    const enrichment: Partial<Nugget> = {};
    if (data.author_name) {
      enrichment.author = data.author_name;
    }
    // Don't override title/description - keep Tier 0 fallback

    return enrichment;
  } catch {
    // Silent failure - continue immediately
    return null;
  }
}

/**
 * TIER 0.6: Optional YouTube oEmbed (non-blocking)
 * Only for YouTube, timeout 1000ms, never blocks fallback
 * Fetches actual video title, author, and thumbnail
 */
async function tier0_6_youtube(urlString: string, domain: string): Promise<Partial<Nugget> | null> {
  if (!domain.includes('youtube.com') && !domain.includes('youtu.be')) {
    return null;
  }

  try {
    const { controller, cleanup } = createTimeoutController(1000); // 1 second timeout

    const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(urlString)}&format=json`;
    // Audit Phase-2 Fix: Add retry logic for transient network errors
    const fetchPromise = fetchWithRetry(() => fetch(oEmbedUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    }), 2, 250);

    const response = await withTimeout(fetchPromise, 1000, controller.signal);
    cleanup();

    if (!response || !response.ok) {
      return null;
    }

    const data = await response.json();
    
    // Extract enrichment data
    const enrichment: Partial<Nugget> = {};
    
    // FIX: Do NOT return title for YouTube videos - auto-title disabled per user request
    // User explicitly requested no auto-title functionality for YouTube/social networks
    // Title field is left undefined to prevent any auto-population
    // if (data.title) {
    //   enrichment.title = data.title;
    // }
    
    // Author/channel name
    if (data.author_name) {
      enrichment.author = data.author_name;
    }
    
    // Thumbnail URL (if not already set)
    if (data.thumbnail_url && !enrichment.media) {
      enrichment.media = {
        type: 'image',
        src: data.thumbnail_url,
        width: 1280,
        height: 720,
        aspectRatio: 1280 / 720,
        renderMode: 'cover',
        isEstimated: false,
      };
    }

    enrichment.quality = 'partial';

    return enrichment;
  } catch {
    // Silent failure - continue immediately
    return null;
  }
}

/**
 * TIER 1: Microlink (Admin-only, feature-flagged)
 * Free tier only, strict timeout, no retries
 */
async function tier1(urlString: string, isAdmin: boolean): Promise<Partial<Nugget> | null> {
  // Check conditions
  if (!MICROLINK_ENABLED) return null;
  if (MICROLINK_ADMIN_ONLY && !isAdmin) return null;
  if (!MICROLINK_API_KEY) return null;

  try {
    const { controller, cleanup } = createTimeoutController(TIER_1_TIMEOUT);

    const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(urlString)}`;
    // Audit Phase-2 Fix: Add retry logic for transient network errors
    const fetchPromise = fetchWithRetry(() => fetch(microlinkUrl, {
      signal: controller.signal,
      headers: {
        'x-api-key': MICROLINK_API_KEY,
        'Accept': 'application/json',
      },
    }), 2, 300);

    const response = await withTimeout(fetchPromise, TIER_1_TIMEOUT, controller.signal);
    cleanup();

    if (!response || !response.ok) {
      return null;
    }

    const data = await response.json();

    const enrichment: Partial<Nugget> = {};

    // FIX: Do NOT return title for social networks/videos from Microlink - auto-title disabled
    // User explicitly requested no auto-title functionality for YouTube/social networks
    // Title field is left undefined to prevent any auto-population
    // if (data.data?.title) {
    //   enrichment.title = data.data.title;
    // }
    if (data.data?.description) {
      enrichment.description = data.data.description;
    }
    if (data.data?.author) {
      enrichment.author = data.data.author;
    }
    if (data.data?.date) {
      enrichment.publishedAt = data.data.date;
    }

    // Handle media
    if (data.data?.image?.url) {
      const imageUrl = data.data.image.url;
      const width = data.data.image.width || 1200;
      const height = data.data.image.height || 630;
      
      enrichment.media = {
        type: 'image',
        src: imageUrl,
        width: Math.round(width),
        height: Math.round(height),
        aspectRatio: width / height,
        renderMode: 'cover',
      };
    }

    enrichment.quality = 'full';

    return enrichment;
  } catch {
    // Immediate fallback on any error
    return null;
  }
}

/**
 * TIER 2: Open Graph Scraping
 * For articles/blogs, timeout 1500ms
 */
async function tier2(urlString: string): Promise<Partial<Nugget> | null> {
  try {
    const { controller, cleanup } = createTimeoutController(TIER_2_TIMEOUT);

    // Audit Phase-2 Fix: Add retry logic for transient network errors (ogs uses fetch internally)
    const ogsPromise = fetchWithRetry(() => ogs({
      url: urlString,
      timeout: TIER_2_TIMEOUT,
      fetchOptions: {
        signal: controller.signal,
      },
    }), 2, 400);

    const result = await withTimeout(ogsPromise, TIER_2_TIMEOUT, controller.signal);
    cleanup();

    if (!result || result.error) {
      return null;
    }

    const { result: ogData } = result;
    const enrichment: Partial<Nugget> = {};

    // FIX: Do NOT return title from Open Graph for social networks - auto-title disabled
    // User explicitly requested no auto-title functionality for YouTube/social networks
    // Title field is left undefined to prevent any auto-population
    // Note: This is for articles/blogs, but we're being consistent and not returning titles
    // if (ogData.ogTitle) {
    //   enrichment.title = ogData.ogTitle;
    // }
    if (ogData.ogDescription) {
      enrichment.description = ogData.ogDescription;
    }
    if (ogData.author) {
      enrichment.author = ogData.author;
    }
    if (ogData.ogDate) {
      enrichment.publishedAt = ogData.ogDate;
    }

    // Handle OG image
    if (ogData.ogImage && Array.isArray(ogData.ogImage) && ogData.ogImage.length > 0) {
      const imageUrl = ogData.ogImage[0].url;
      enrichment.media = {
        type: 'image',
        src: imageUrl,
        width: 1200, // Default, will be probed in Tier 3
        height: 630,
        aspectRatio: 1.91, // Default 16:9, will be updated in Tier 3
        isEstimated: true,
      };
    } else if (ogData.ogImage && typeof ogData.ogImage === 'object' && ogData.ogImage.url) {
      const imageUrl = ogData.ogImage.url;
      enrichment.media = {
        type: 'image',
        src: imageUrl,
        width: 1200,
        height: 630,
        aspectRatio: 1.91,
        isEstimated: true,
      };
    }

    enrichment.quality = 'partial';

    return enrichment;
  } catch {
    return null;
  }
}

/**
 * TIER 3: Image Probing (Guarded)
 * Probe image dimensions, timeout 1000ms, abort if > 5MB
 */
async function tier3(imageUrl: string): Promise<{ width: number; height: number; aspectRatio: number } | null> {
  try {
    const { controller, cleanup } = createTimeoutController(TIER_3_TIMEOUT);

    // First, check Content-Length header
    // Audit Phase-2 Fix: Add retry logic for transient network errors
    const headPromise = fetchWithRetry(() => fetch(imageUrl, {
      method: 'HEAD',
      signal: controller.signal,
    }), 2, 200);

    const headResponse = await withTimeout(headPromise, TIER_3_TIMEOUT, controller.signal);
    
    if (!headResponse) {
      cleanup();
      return null;
    }

    const contentLength = headResponse.headers.get('content-length');
    if (contentLength) {
      const sizeMB = parseInt(contentLength, 10) / (1024 * 1024);
      if (sizeMB > 5) {
        cleanup();
        return null; // Abort if > 5MB
      }
    }

    // Probe image dimensions
    // Audit Phase-2 Fix: Add retry logic for transient network errors
    const probePromise = fetchWithRetry(() => probe(imageUrl, {
      timeout: TIER_3_TIMEOUT,
    }), 2, 200);

    const result = await withTimeout(probePromise, TIER_3_TIMEOUT, controller.signal);
    cleanup();

    if (result && result.width && result.height) {
      return {
        width: result.width,
        height: result.height,
        aspectRatio: result.width / result.height,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Platform-specific enrichments
 */
function enrichPlatformSpecific(nugget: Nugget, url: URL, domain: string): void {
  // YouTube specific
  if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      nugget.media = {
        type: 'image',
        src: thumbnailUrl,
        width: 1280,
        height: 720,
        aspectRatio: 1280 / 720,
        renderMode: 'cover',
        isEstimated: false,
      };
      nugget.description = nugget.description || 'Watch on YouTube →';
    }
  }

  // Document specific
  if (nugget.contentType === 'document') {
    // No media for documents, just icon-based card
    nugget.media = undefined;
  }

  // Direct image URLs
  if (nugget.contentType === 'image') {
    nugget.media = {
      type: 'image',
      src: nugget.url,
      width: 1200, // Will be probed in Tier 3
      height: 630,
      aspectRatio: 1.91,
      isEstimated: true,
    };
  }
}

/**
 * Extract YouTube video ID
 */
function extractYouTubeVideoId(url: URL): string | null {
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname;
  const searchParams = url.searchParams;

  if (hostname.includes('youtu.be')) {
    return pathname.slice(1); // Remove leading slash
  }

  if (hostname.includes('youtube.com')) {
    if (pathname.startsWith('/watch')) {
      return searchParams.get('v') || null;
    }
    if (pathname.startsWith('/embed/')) {
      return pathname.split('/embed/')[1]?.split('?')[0] || null;
    }
  }

  return null;
}

/**
 * Main unfurl function - Tiered Waterfall Strategy
 * 
 * NEVER throws, always returns a valid Nugget
 * Hard timeout: 5000ms total
 */
export async function fetchUrlMetadata(
  urlString: string,
  options: { isAdmin?: boolean; skipCache?: boolean } = {}
): Promise<Nugget> {
  const { skipCache = false } = options;
  
  // Check cache first (unless explicitly skipped)
  if (!skipCache) {
    const cached = getCached(urlString);
    if (cached) {
      return cached;
    }
  }
  
  const startTime = Date.now();
  const { isAdmin = false } = options;

  // TIER 0: Instant fallback (always available)
  const baseNugget = tier0(urlString);
  const { url, domain } = parseUrl(urlString);

  // Enrich with platform-specific defaults
  enrichPlatformSpecific(baseNugget, url, domain);

  // Check if we've exceeded total timeout
  const checkTimeout = () => {
    const elapsed = Date.now() - startTime;
    return elapsed >= TOTAL_TIMEOUT;
  };

  // TIER 0.5: Optional Twitter oEmbed (non-blocking)
  if (!checkTimeout() && (domain.includes('twitter.com') || domain.includes('x.com'))) {
    try {
      const enrichment = await withTimeout(
        tier0_5(urlString, domain),
        TIER_0_5_TIMEOUT
      );

      if (enrichment) {
        Object.assign(baseNugget, enrichment);
      }
    } catch {
      // Silent failure
    }
  }

  // TIER 0.6: Optional YouTube oEmbed (non-blocking)
  // Fetches actual video title, author, and thumbnail - perfect for YouTube videos
  if (!checkTimeout() && (domain.includes('youtube.com') || domain.includes('youtu.be'))) {
    try {
      const enrichment = await withTimeout(
        tier0_6_youtube(urlString, domain),
        1000 // 1 second timeout
      );

      if (enrichment) {
        Object.assign(baseNugget, enrichment);
        // YouTube oEmbed provides reliable data, so we can cache and return early
        // if we got a title (indicates successful fetch)
        if (enrichment.title && enrichment.title !== 'YouTube Video') {
          setCached(urlString, baseNugget);
          return baseNugget;
        }
      }
    } catch {
      // Silent failure - continue to other tiers
    }
  }

  // Determine which tiers to attempt based on content type
  const shouldTryMicrolink = !checkTimeout() && MICROLINK_ENABLED && isAdmin;
  const shouldTryOG = !checkTimeout() && baseNugget.contentType === 'article';
  const needsImageProbe = baseNugget.media?.isEstimated === true;

  // TIER 1: Microlink (admin-only)
  if (shouldTryMicrolink) {
    try {
      const enrichment = await withTimeout(
        tier1(urlString, isAdmin),
        TIER_1_TIMEOUT
      );

      if (enrichment) {
        // PHASE 2: Title from metadata is stored for SUGGESTION ONLY
        // Frontend will transform it to previewMetadata.title and never auto-populate
        // Title generation must happen ONLY when the user explicitly clicks a "Generate title" button
        Object.assign(baseNugget, enrichment);
        // Cache and return if Microlink succeeded (only if we got meaningful data)
        if (enrichment.title || enrichment.description || enrichment.media) {
          setCached(urlString, baseNugget);
          return baseNugget;
        }
      }
    } catch {
      // Continue to next tier
    }
  }

  // TIER 2: Open Graph
  // NOTE: Tier 2 is only attempted for 'article' content type (line 709)
  // However, we still need to filter titles since articles should NOT auto-generate titles
  if (shouldTryOG && !checkTimeout()) {
    try {
      const enrichment = await withTimeout(
        tier2(urlString),
        TIER_2_TIMEOUT
      );

      if (enrichment) {
        // PHASE 2: Title from metadata is stored for SUGGESTION ONLY
        // Frontend will transform it to previewMetadata.title and never auto-populate
        // Title generation must happen ONLY when the user explicitly clicks a "Generate title" button
        Object.assign(baseNugget, enrichment);
      }
    } catch {
      // Continue
    }
  }

  // TIER 3: Image Probing (if we have an estimated image)
  if (needsImageProbe && baseNugget.media && !checkTimeout()) {
    try {
      const dimensions = await withTimeout(
        tier3(baseNugget.media.src),
        TIER_3_TIMEOUT
      );

      if (dimensions) {
        baseNugget.media.width = dimensions.width;
        baseNugget.media.height = dimensions.height;
        baseNugget.media.aspectRatio = dimensions.aspectRatio;
        baseNugget.media.isEstimated = false;
      } else {
        // Keep estimated values
        baseNugget.media.aspectRatio = 1.91;
        baseNugget.media.renderMode = 'cover';
      }
    } catch {
      // Keep estimated values
      if (baseNugget.media) {
        baseNugget.media.aspectRatio = 1.91;
        baseNugget.media.renderMode = 'cover';
      }
    }
  }

  // Ensure quality is set
  if (!baseNugget.quality) {
    baseNugget.quality = 'fallback';
  }

  // Cache the result (including fallbacks)
  setCached(urlString, baseNugget);

  // TIER 4: Guaranteed fallback (already in baseNugget)
  return baseNugget;
}

