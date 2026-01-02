import mongoose from 'mongoose';
import { getLogger } from './logger.js';

const SLOW_QUERY_THRESHOLD_MS = 500; // Log queries slower than 500ms

/**
 * Connect to MongoDB database
 */
export async function connectDB(): Promise<void> {
  // Support both MONGO_URI and MONGODB_URI for compatibility
  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
  
  if (!MONGO_URI) {
    console.error('[DB] MONGO_URI or MONGODB_URI is not defined in environment variables');
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
  
  // All retries exhausted - throw last error
  try {
    
    // Database Performance Monitoring
    // Hook into mongoose queries to detect slow operations
    mongoose.plugin((schema: mongoose.Schema) => {
      schema.pre(['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'count', 'countDocuments', 'aggregate'], function() {
        const startTime = Date.now();
        const collectionName = this.model?.collection?.name || 'unknown';
        const operation = this.op || 'unknown';
        
        // Store start time on query
        (this as any)._queryStartTime = startTime;
        (this as any)._queryCollection = collectionName;
        (this as any)._queryOperation = operation;
      });
      
      schema.post(['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'count', 'countDocuments', 'aggregate'], function() {
        const startTime = (this as any)._queryStartTime;
        if (startTime) {
          const duration = Date.now() - startTime;
          const collectionName = (this as any)._queryCollection || 'unknown';
          const operation = (this as any)._queryOperation || 'unknown';
          
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
      });
    });
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
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
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      const logger = getLogger();
      logger.info({ msg: 'MongoDB connection closed through app termination' });
      process.exit(0);
    });
  } catch (error: any) {
    // This catch block now only handles errors from the retry loop
    const logger = getLogger();
    logger.error({
      msg: 'Failed to connect to MongoDB after retries',
      error: {
        message: lastError?.message || error.message,
        stack: lastError?.stack || error.stack,
      },
    });
    throw lastError || error;
  }
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
      console.warn('[transformArticle] Article missing ID:', plainDoc);
      return null;
    }
    
    const { _id, __v, ...rest } = plainDoc;
    
    // Ensure author data exists (critical for frontend)
    const authorId = rest.authorId || '';
    const authorName = rest.authorName || 'Unknown';
    
    if (!authorId || !authorName) {
      console.warn('[transformArticle] Article missing author data:', { id, authorId, authorName });
    }
    
    // Build frontend-compatible article with safe defaults
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
    publishedAt: rest.publishedAt || new Date().toISOString(),
    categories: rest.categories && rest.categories.length > 0 
      ? rest.categories 
      : (rest.category ? [rest.category] : []), // Convert single category to array
    tags: rest.tags || [],
    readTime: rest.readTime || calculateReadTime(rest.content || ''),
    visibility: rest.visibility || 'public',
    // Preserve media and metadata fields (including masonryTitle)
    // CRITICAL: masonryTitle must flow through all layers to persist correctly
    media: rest.media ? {
      ...rest.media,
      masonryTitle: rest.media.masonryTitle, // Preserve masonryTitle from DB
      showInMasonry: rest.media.showInMasonry, // Preserve showInMasonry from DB
    } : null,
    images: rest.images || [],
    video: rest.video,
    documents: rest.documents || [],
    themes: rest.themes || [],
    mediaIds: rest.mediaIds || [],
    engagement: rest.engagement,
    source_type: rest.source_type,
    created_at: rest.created_at,
    updated_at: rest.updated_at,
    displayAuthor: rest.displayAuthor
    };
    
    return article;
  } catch (error) {
    console.error('[transformArticle] Error transforming article:', error);
    return null;
  }
}

/**
 * Normalize MongoDB document to API response format
 * Converts _id to id and transforms to frontend format
 */
export function normalizeDoc(doc: any): any {
  if (!doc) return null;
  
  // Transform article documents specially
  if (doc.title && doc.content) {
    return transformArticle(doc);
  }
  
  // Handle other documents (User, Collection, Report, etc.)
  if (doc.toObject) {
    const obj = doc.toObject();
    const { _id, __v, ...rest } = obj;
    return { id: _id?.toString() || doc.id, ...rest };
  }
  
  // Handle plain object
  if (doc._id) {
    const { _id, __v, ...rest } = doc;
    return { id: _id.toString(), ...rest };
  }
  
  // Already normalized or has id
  return doc;
}

/**
 * Normalize array of documents
 */
export function normalizeDocs(docs: any[]): any[] {
  return docs.map(normalizeDoc).filter(Boolean);
}


