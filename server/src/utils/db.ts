import mongoose from 'mongoose';
import { getLogger } from './logger.js';

const SLOW_QUERY_THRESHOLD_MS = 500; // Log queries slower than 500ms

let mongooseHooksAttached = false;

/**
 * Register Mongoose plugins and connection listeners exactly once after a successful connect.
 * (Previously lived only on the retry-exhaustion path — which never threw, so failed boots
 * could still proceed and surface as 500s on first query.)
 */
function attachMongooseHooksOnce(): void {
  if (mongooseHooksAttached) return;
  mongooseHooksAttached = true;

  mongoose.plugin((schema: mongoose.Schema) => {
    schema.pre(
      ['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'count', 'countDocuments', 'aggregate'],
      function () {
        const startTime = Date.now();
        const collectionName = this.model?.collection?.name || 'unknown';
        const operation = this.op || 'unknown';
        (this as { _queryStartTime?: number; _queryCollection?: string; _queryOperation?: string })._queryStartTime =
          startTime;
        (this as { _queryCollection?: string })._queryCollection = collectionName;
        (this as { _queryOperation?: string })._queryOperation = operation;
      },
    );

    schema.post(
      ['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'count', 'countDocuments', 'aggregate'],
      function () {
        const startTime = (this as { _queryStartTime?: number })._queryStartTime;
        if (startTime) {
          const duration = Date.now() - startTime;
          const collectionName = (this as { _queryCollection?: string })._queryCollection || 'unknown';
          const operation = (this as { _queryOperation?: string })._queryOperation || 'unknown';
          if (duration >= SLOW_QUERY_THRESHOLD_MS) {
            const logger = getLogger();
            logger.warn({
              msg: 'Slow database query detected',
              collection: collectionName,
              operation,
              duration: `${duration}ms`,
            });
          }
        }
      },
    );
  });

  mongoose.connection.on('error', (err: Error) => {
    const logger = getLogger();
    logger.error({
      msg: 'MongoDB connection error',
      error: {
        message: err.message,
        stack: err.stack,
      },
    });
  });

  mongoose.connection.on('disconnected', () => {
    const logger = getLogger();
    logger.warn({ msg: 'MongoDB disconnected' });
  });

  process.once('SIGINT', async () => {
    await mongoose.connection.close();
    const logger = getLogger();
    logger.info({ msg: 'MongoDB connection closed through app termination' });
    process.exit(0);
  });
}

/**
 * Connect to MongoDB database
 */
export async function connectDB(): Promise<void> {
  // Support both MONGO_URI and MONGODB_URI for compatibility
  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
  
  if (!MONGO_URI) {
    getLogger().error({ msg: '[DB] MONGO_URI or MONGODB_URI is not defined in environment variables' });
    throw new Error('MONGO_URI or MONGODB_URI environment variable is required');
  }

  // Add database name if not present in URI
  let connectionString = MONGO_URI;
  // Check if URI already has a database name (path after /)
  // Pattern: mongodb+srv://user:pass@host/dbname?options
  // Examples:
  // - mongodb+srv://user:pass@host/?options (no db name - needs /nuggets)
  // - mongodb+srv://user:pass@host/dbname?options (has db name - keep as is)
  // - mongodb+srv://user:pass@host/dbname (has db name - keep as is)
  const dbNameMatch = connectionString.match(/mongodb\+?srv?:\/\/[^\/]+\/([^\/\?]+)/);
  if (!dbNameMatch || dbNameMatch[1] === '') {
    // No database name in URI, add /nuggets before query params
    // Handle both /? and ? patterns
    if (connectionString.includes('/?')) {
      connectionString = connectionString.replace('/?', '/nuggets?');
    } else if (connectionString.includes('?')) {
      connectionString = connectionString.replace('?', '/nuggets?');
    } else {
      connectionString = connectionString + '/nuggets';
    }
  }

  // Audit Phase-2 Fix: Wrap connection in retry loop for transient network failures
  const maxRetries = 3;
  const retryDelay = 5000; // 5 seconds
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(connectionString);
      // Audit Phase-1 Fix: Explicitly enable strictQuery to reject unknown query fields
      mongoose.set('strictQuery', true);
      attachMongooseHooksOnce();
      const logger = getLogger();
      logger.info({ msg: 'Database connected', database: 'MongoDB' });
      // Audit Phase-3 Fix: Log informational message when connection stabilizes after retry
      if (attempt > 1) {
        logger.info({ 
          msg: 'Database connection stabilized after retry', 
          database: 'MongoDB',
          attempts: attempt,
          finalStatus: 'connected'
        });
      }
      return; // Success - exit function
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries) {
        const logger = getLogger();
        logger.warn({
          msg: `DB connection failed, retrying... (${attempt}/${maxRetries})`,
          error: {
            message: error.message,
          },
        });
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  const logger = getLogger();
  logger.error({
    msg: 'Failed to connect to MongoDB after retries',
    error: {
      message: lastError?.message ?? 'unknown',
      stack: lastError?.stack,
    },
  });
  throw lastError ?? new Error('MongoDB connection failed after retries');
}

/**
 * Check if MongoDB is connected and ready
 */
export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1; // 1 = connected
}

/**
 * Calculate read time from content (rough estimate: 200 words per minute)
 */
function calculateReadTime(content: string): number {
  if (!content) return 1;
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

/**
 * Transform article from backend format to frontend format
 * Ensures all required fields exist with safe defaults
 */
function transformArticle(doc: any): any {
  if (!doc) return null;
  
  try {
    // Handle Mongoose document or plain object
    const plainDoc = doc.toObject ? doc.toObject() : doc;
    
    // Extract _id first
    const id = plainDoc._id?.toString() || plainDoc.id || '';
    if (!id) {
      getLogger().warn({ article: plainDoc }, '[transformArticle] Article missing ID');
      return null;
    }
    
    const { _id, __v, categoryIds, ...rest } = plainDoc; // Explicitly exclude deprecated categoryIds
    
    // Ensure author data exists (critical for frontend)
    const authorId = rest.authorId || '';
    const authorName = rest.authorName || 'Unknown';
    
    if (!authorId || !authorName) {
      getLogger().warn({ id, authorId, authorName }, '[transformArticle] Article missing author data');
    }
    
    // Build frontend-compatible article with safe defaults
    // CRITICAL: categoryIds is explicitly excluded - never expose in API responses
    const article: any = {
      id,
      title: rest.title || undefined, // Preserve empty titles (display layer handles fallbacks)
      excerpt: rest.excerpt || (rest.content ? rest.content.substring(0, 150) + '...' : ''),
      content: rest.content || '',
      author: {
        id: authorId,
        name: authorName,
        avatar_url: rest.author?.avatar_url || undefined
      },
    publishedAt: rest.publishedAt ?? null,
    status: rest.status || 'published',
    // CATEGORY PHASE-OUT: Removed categories field - tags are now the only classification field
    tags: [], // Populated by resolveTagsFromIds() in normalizeArticleDoc/normalizeArticleDocs
    tagIds: rest.tagIds ? rest.tagIds.map((id: any) => id.toString()) : [],
    readTime: rest.readTime || calculateReadTime(rest.content || ''),
    visibility: rest.visibility || 'public',
    // Preserve media and metadata fields (including masonryTitle)
    // CRITICAL: masonryTitle must flow through all layers to persist correctly
    media: rest.media ? {
      ...rest.media,
      masonryTitle: rest.media.masonryTitle, // Preserve masonryTitle from DB
      showInMasonry: rest.media.showInMasonry, // Preserve showInMasonry from DB
      showInGrid: rest.media.showInGrid,
    } : null,
    // CRITICAL: Include primaryMedia and supportingMedia for Masonry layout
    primaryMedia: rest.primaryMedia || undefined,
    supportingMedia: rest.supportingMedia || [],
    images: rest.images || [],
    video: rest.video,
    documents: rest.documents || [],
    themes: rest.themes || [],
    mediaIds: rest.mediaIds || [],
    engagement: rest.engagement,
    source_type: rest.source_type,
    created_at: rest.created_at,
    updated_at: rest.updated_at,
    displayAuthor: rest.displayAuthor,
    // External links for card "Link" button (separate from media URLs)
    externalLinks: rest.externalLinks || [],
    // Layout visibility configuration
    layoutVisibility: rest.layoutVisibility,
    // Display image index (which media item shows as card thumbnail)
    displayImageIndex: rest.displayImageIndex,
    // Disclaimer fields
    showDisclaimer: rest.showDisclaimer,
    disclaimerText: rest.disclaimerText,
    // Content stream classification (standard / pulse / both)
    contentStream: rest.contentStream,
    };
    
    return article;
  } catch (error) {
    getLogger().error({ err: error }, '[transformArticle] Error transforming article');
    return null;
  }
}

/**
 * Create defensive proxy that intercepts legacy category field access
 * Returns empty arrays for categories/categoryIds with warning (debug-level in production)
 */
function createDefensiveProxy(obj: any): any {
  const logger = getLogger();
  let warningCount = 0;
  const MAX_WARNINGS = 10; // Limit warnings to prevent log spam
  
  return new Proxy(obj, {
    get(target: any, prop: string | symbol) {
      // Intercept access to legacy category fields
      if (prop === 'categories' || prop === 'categoryIds') {
        warningCount++;
        // Only log warnings in development, or debug-level in production (first 10)
        if (process.env.NODE_ENV === 'development') {
          logger.debug({ 
            msg: 'Legacy category field accessed — ignored', 
            field: prop,
            count: warningCount
          });
        } else if (warningCount <= MAX_WARNINGS) {
          logger.debug({ 
            msg: 'Legacy category field accessed — ignored', 
            field: prop,
            count: warningCount,
            note: warningCount === MAX_WARNINGS ? 'Further warnings suppressed' : undefined
          });
        }
        return [];
      }
      // Forward all other property access
      return target[prop];
    },
    has(target: any, prop: string | symbol) {
      // Return true for categories/categoryIds to prevent "in" operator errors
      if (prop === 'categories' || prop === 'categoryIds') {
        return true;
      }
      return prop in target;
    },
    ownKeys(target: any) {
      // Include categories/categoryIds in ownKeys to prevent Object.keys() errors
      const keys = Reflect.ownKeys(target);
      if (!keys.includes('categories')) {
        keys.push('categories');
      }
      if (!keys.includes('categoryIds')) {
        keys.push('categoryIds');
      }
      return keys;
    },
    getOwnPropertyDescriptor(target: any, prop: string | symbol) {
      // Return descriptor for categories/categoryIds to prevent enumeration errors
      if (prop === 'categories' || prop === 'categoryIds') {
        return {
          enumerable: true,
          configurable: true,
          value: []
        };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    }
  });
}

/**
 * Normalize MongoDB document to API response format
 * Converts _id to id and transforms to frontend format
 */
export function normalizeDoc(doc: any): any {
  if (!doc) return null;

  // Detect article documents by presence of authorId (unique to Article model).
  // Previously used `doc.title && doc.content` which missed articles without titles
  // or with empty content (e.g., image-only nuggets), causing author data to not
  // be transformed into the { author: { id, name } } structure.
  const plainDoc = doc.toObject ? doc.toObject() : doc;
  const isArticle = !!(plainDoc.authorId || plainDoc.authorName);

  if (isArticle) {
    const transformed = transformArticle(doc);
    return transformed ? createDefensiveProxy(transformed) : null;
  }

  // Handle other documents (User, Collection, Report, etc.)
  if (doc.toObject) {
    const obj = doc.toObject();
    const { _id, __v, ...rest } = obj;
    const normalized = { id: _id?.toString() || doc.id, ...rest };
    // Add virtual `name` for collections (maps to rawName)
    if (normalized.rawName && !normalized.name) {
      normalized.name = normalized.rawName;
    }
    return normalized;
  }

  // Handle plain object
  if (doc._id) {
    const { _id, __v, ...rest } = doc;
    const normalized = { id: _id.toString(), ...rest };
    // Add virtual `name` for collections (maps to rawName)
    if (normalized.rawName && !normalized.name) {
      normalized.name = normalized.rawName;
    }
    return normalized;
  }

  // Already normalized or has id
  // Add virtual `name` for collections (maps to rawName)
  if (doc.rawName && !doc.name) {
    return { ...doc, name: doc.rawName };
  }
  return doc;
}

/**
 * Normalize array of documents
 */
export function normalizeDocs(docs: any[]): any[] {
  return docs.map(normalizeDoc).filter(Boolean);
}

// ─── Tag-name cache for resolving tagIds → display names ────────────────
// The taxonomy is small (~50-100 tags). We keep a full copy in memory and
// refresh it every 60 seconds so transformArticle can stay synchronous.

const TAG_CACHE_TTL_MS = 60_000;
let _tagNameCache: Map<string, string> | null = null;
let _tagCacheRefreshedAt = 0;

/**
 * Return a Map of tagId (string) → rawName.
 * Lazily loads from the Tag collection and caches for 60 s.
 */
export async function getTagNameMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (_tagNameCache && now - _tagCacheRefreshedAt < TAG_CACHE_TTL_MS) {
    return _tagNameCache;
  }

  // Dynamic import to avoid circular dependency (db.ts ← Tag model ← mongoose ← db.ts)
  const { Tag } = await import('../models/Tag.js');

  const tags = await Tag.find({ status: 'active' })
    .select('_id rawName')
    .lean();

  const map = new Map<string, string>();
  for (const t of tags) {
    map.set(t._id.toString(), t.rawName);
  }

  _tagNameCache = map;
  _tagCacheRefreshedAt = now;
  return map;
}

/** Invalidate the tag-name cache (call after tag create/rename/delete). */
export function invalidateTagNameCache(): void {
  _tagNameCache = null;
  _tagCacheRefreshedAt = 0;
}

/**
 * Post-process a normalized article: replace the `tags` string array with
 * names resolved from `tagIds`. Falls back to the existing `tags` value
 * when a tagId has no match (e.g. tag was just deleted).
 */
function resolveTagsFromIds(article: any, tagNameMap: Map<string, string>): any {
  if (!article || !article.tagIds || article.tagIds.length === 0) {
    return article;
  }

  const resolved: string[] = [];
  for (const id of article.tagIds) {
    const name = tagNameMap.get(id.toString());
    if (name) resolved.push(name);
  }

  // Only override if we actually resolved something; otherwise keep the
  // existing tags[] so display doesn't break for articles with stale IDs.
  if (resolved.length > 0) {
    article.tags = resolved;
  }
  return article;
}

/**
 * Async article normalization: normalizeDoc + resolve tags from tagIds.
 * Use this in controllers that return article responses.
 */
export async function normalizeArticleDoc(doc: any): Promise<any> {
  const tagMap = await getTagNameMap();
  const normalized = normalizeDoc(doc);
  return resolveTagsFromIds(normalized, tagMap);
}

/**
 * Async batch normalization for article lists.
 * Loads the tag cache once, then resolves all articles synchronously.
 */
export async function normalizeArticleDocs(docs: any[]): Promise<any[]> {
  const tagMap = await getTagNameMap();
  return docs.map(normalizeDoc).filter(Boolean).map((a: any) => resolveTagsFromIds(a, tagMap));
}
