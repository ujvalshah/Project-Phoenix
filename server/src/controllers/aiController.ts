/**
 * AI Controller - YouTube Video Intelligence Extraction
 * 
 * Implements CACHE-FIRST logic:
 * 1. Check if videoId exists in database
 * 2. If found, return cached nugget with cacheHit: true
 * 3. If not found, call Gemini and save as 'ai-draft'
 */

import { Request, Response } from 'express';
import { GoogleGenAI, Type } from "@google/genai";
import { z } from 'zod';
import { 
  extractNuggetIntelligence, 
  isGeminiConfigured, 
  getKeyStatus, 
  resetExhaustedKeys,
  extractYouTubeVideoId,
  logCacheHit,
  logCacheMiss,
  NuggetIntelligence
} from '../services/geminiService.js';
import { Article } from '../models/Article.js';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';
import { getLogger } from '../utils/logger.js';

// Initialize Gemini Client for legacy endpoints
const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// Audit Phase-1 Fix: Zod validation schemas for request bodies
const processYouTubeSchema = z.object({
  videoUrl: z.string().url('Invalid YouTube URL').refine(
    (url) => {
      try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        return hostname.includes('youtube.com') || hostname.includes('youtu.be');
      } catch {
        return false;
      }
    },
    'Must be a YouTube URL'
  )
});

const extractIntelligenceSchema = z.object({
  videoUrl: z.string().url('Invalid YouTube URL').refine(
    (url) => {
      try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        return hostname.includes('youtube.com') || hostname.includes('youtu.be');
      } catch {
        return false;
      }
    },
    'Must be a YouTube URL'
  )
});

// ============================================================================
// CACHE-FIRST LOGIC
// ============================================================================

/**
 * Check if a video has been processed before.
 * Returns the cached article and NuggetIntelligence if found, null otherwise.
 */
async function getCachedIntelligence(videoId: string): Promise<{ article: any; intelligence: NuggetIntelligence } | null> {
  try {
    // Build regex patterns to match various YouTube URL formats
    const urlPatterns = [
      new RegExp(`youtube\\.com.*[?&]v=${videoId}`),
      new RegExp(`youtu\\.be/${videoId}`),
      new RegExp(`youtube\\.com/embed/${videoId}`),
    ];

    // Find article with matching YouTube URL in media.url
    const cachedArticle = await Article.findOne({
      $or: [
        { 'media.url': { $regex: urlPatterns[0] } },
        { 'media.url': { $regex: urlPatterns[1] } },
        { 'media.url': { $regex: urlPatterns[2] } },
      ],
      source_type: { $in: ['ai-draft', 'ai-published'] },
    }).sort({ created_at: -1 }); // Get most recent

    if (!cachedArticle) return null;

    // Reconstruct NuggetIntelligence from cached article
    const cachedIntelligence: NuggetIntelligence = {
      title: cachedArticle.title || 'Untitled',
      metadata: {
        source: cachedArticle.media?.previewMetadata?.providerName || 'YouTube',
        speaker: cachedArticle.media?.previewMetadata?.authorName || 'Unknown',
        category: (cachedArticle.category as NuggetIntelligence['metadata']['category']) || 'Tech',
        sentiment: 'Neutral',
      },
      abstract: cachedArticle.excerpt || '',
      domainIntelligence: {
        primarySignal: 'See content for details',
        impact: 'See content for details',
      },
      dataVault: [],
      visualAnchor: {
        anecdote: 'See content for details',
        actionableTakeaway: 'See content for details',
      },
      frictionPoint: 'See content for details',
    };

    // Try to extract sentiment from tags
    const sentimentTag = cachedArticle.tags?.find((t: string) => 
      ['bullish', 'bearish', 'neutral'].includes(t.toLowerCase())
    );
    if (sentimentTag) {
      cachedIntelligence.metadata.sentiment = 
        sentimentTag.charAt(0).toUpperCase() + sentimentTag.slice(1).toLowerCase() as 'Bullish' | 'Bearish' | 'Neutral';
    }

    return { article: cachedArticle, intelligence: cachedIntelligence };

  } catch (error) {
    // Audit Phase-1 Fix: Use structured logging instead of console.error
    const logger = getLogger();
    logger.error({
      msg: '[AI] Cache lookup error',
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    return null; // On error, proceed with API call
  }
}

/**
 * Format NuggetIntelligence as readable markdown content
 */
function formatIntelligenceAsContent(intel: NuggetIntelligence): string {
  const lines: string[] = [];
  
  lines.push(`## ${intel.title}`);
  lines.push('');
  lines.push(`**${intel.metadata.speaker}** | ${intel.metadata.source} | ${intel.metadata.sentiment}`);
  lines.push('');
  lines.push(`> ${intel.abstract}`);
  lines.push('');
  lines.push('### Key Signal');
  lines.push(intel.domainIntelligence.primarySignal);
  lines.push('');
  lines.push('### Market Impact');
  lines.push(intel.domainIntelligence.impact);
  
  if (intel.domainIntelligence.metric) {
    lines.push('');
    lines.push(`**Key Metric:** ${intel.domainIntelligence.metric}`);
  }
  
  if (intel.dataVault.length > 0) {
    lines.push('');
    lines.push('### Data Vault');
    for (const item of intel.dataVault) {
      const ts = item.timestamp ? ` (${item.timestamp})` : '';
      lines.push(`- **${item.label}:** ${item.value}${ts}`);
    }
  }
  
  lines.push('');
  lines.push('### Memorable Insight');
  lines.push(`> "${intel.visualAnchor.anecdote}"`);
  lines.push('');
  lines.push('### Actionable Takeaway');
  lines.push(`🎯 ${intel.visualAnchor.actionableTakeaway}`);
  lines.push('');
  lines.push('### Risk / Friction Point');
  lines.push(`⚠️ ${intel.frictionPoint}`);
  
  return lines.join('\n');
}

/**
 * Extract tags from intelligence
 */
function extractTags(intel: NuggetIntelligence): string[] {
  const tags: string[] = [];
  
  if (intel.metadata.source) {
    tags.push(intel.metadata.source.toLowerCase().replace(/\s+/g, '-'));
  }
  
  if (intel.metadata.speaker) {
    const speakerTag = intel.metadata.speaker.toLowerCase().replace(/\s+/g, '-');
    if (speakerTag.length <= 30) {
      tags.push(speakerTag);
    }
  }
  
  return tags.slice(0, 5);
}

// ============================================================================
// MAIN ENDPOINT: Process YouTube (Cache-First + Save)
// ============================================================================

/**
 * Process YouTube video with cache-first logic and auto-save
 * POST /api/ai/process-youtube
 * Body: { videoUrl: string }
 * 
 * CACHE-FIRST:
 * 1. Check if video exists in MongoDB
 * 2. If found, return cached data (cacheHit: true)
 * 3. If not found, call Gemini and save as 'ai-draft'
 * 
 * Requires authentication (uses req.user for authorId)
 */
export const processYouTube = async (req: Request, res: Response) => {
  // Audit Phase-1 Fix: Zod validation for request body
  const validationResult = processYouTubeSchema.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({ 
      message: 'Validation failed', 
      errors: validationResult.error.errors 
    });
  }

  const { videoUrl } = validationResult.data;
  const user = (req as any).user;

  if (!user?.id) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Check configuration
  if (!isGeminiConfigured()) {
    return res.status(503).json({ 
      message: 'AI service not configured. Set GEMINI_KEYS in .env',
      keyStatus: getKeyStatus()
    });
  }

  // Extract video ID for cache lookup
  const videoId = extractYouTubeVideoId(videoUrl);
  if (!videoId) {
    return res.status(400).json({ message: 'Could not extract video ID from URL' });
  }

  try {
    // =========================================================================
    // CACHE-FIRST: Check if video exists in database
    // =========================================================================
    const cached = await getCachedIntelligence(videoId);
    
    if (cached) {
      logCacheHit(videoId);
      
      return res.json({
        success: true,
        data: cached.intelligence,
        articleId: cached.article._id.toString(),
        cacheHit: true,
        keyStatus: getKeyStatus()
      });
    }

    // =========================================================================
    // CACHE MISS: Call Gemini AI
    // =========================================================================
    logCacheMiss(videoId);
    
    const intelligence = await extractNuggetIntelligence(videoUrl);
    
    // =========================================================================
    // SAVE AS AI-DRAFT
    // =========================================================================
    const articleData = {
      title: intelligence.title,
      excerpt: intelligence.abstract,
      content: formatIntelligenceAsContent(intelligence),
      authorId: user.id,
      authorName: user.name || user.email || 'Unknown',
      category: intelligence.metadata.category,
      categories: [intelligence.metadata.category],
      tags: [
        intelligence.metadata.category.toLowerCase(),
        intelligence.metadata.sentiment.toLowerCase(),
        ...extractTags(intelligence)
      ],
      publishedAt: new Date().toISOString(),
      visibility: 'private',
      source_type: 'ai-draft',
      
      media: {
        type: 'youtube' as const,
        url: videoUrl,
        previewMetadata: {
          url: videoUrl,
          title: intelligence.title,
          description: intelligence.abstract,
          providerName: intelligence.metadata.source,
          authorName: intelligence.metadata.speaker,
        }
      },
      
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const savedArticle = await Article.create(articleData);
    console.log(`[AI] ✓ DRAFT saved: ${savedArticle._id}`);
    
    res.json({
      success: true,
      data: intelligence,
      articleId: savedArticle._id.toString(),
      cacheHit: false,
      keyStatus: getKeyStatus()
    });

  } catch (error: unknown) {
    const err = error as Error;
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.id, req.path);
    requestLogger.error({
      msg: '[AI] Process YouTube error',
      error: {
        message: err.message,
        stack: err.stack,
      },
    });
    captureException(err, { requestId: req.id, route: req.path });
    
    const message = err.message || 'Failed to process YouTube video';
    const status = message.includes('exhausted') || message.includes('rate limit') || message.includes('429') ? 429 : 500;
    
    res.status(status).json({ 
      message,
      keyStatus: getKeyStatus()
    });
  }
};

// ============================================================================
// EXTRACT INTELLIGENCE (No Save)
// ============================================================================

/**
 * Extract NuggetIntelligence from a YouTube video
 * POST /api/ai/extract-intelligence
 * Body: { videoUrl: string }
 * 
 * CACHE-FIRST: Checks database before calling Gemini API.
 * Does NOT save - use /process-youtube for save behavior.
 */
export const extractIntelligence = async (req: Request, res: Response) => {
  // Audit Phase-1 Fix: Zod validation for request body
  const validationResult = extractIntelligenceSchema.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({ 
      message: 'Validation failed', 
      errors: validationResult.error.errors 
    });
  }

  const { videoUrl } = validationResult.data;

  // Check configuration
  if (!isGeminiConfigured()) {
    return res.status(503).json({ 
      message: 'AI service not configured. Set GEMINI_KEYS in .env',
      keyStatus: getKeyStatus()
    });
  }

  // Extract video ID for cache lookup
  const videoId = extractYouTubeVideoId(videoUrl);
  if (!videoId) {
    return res.status(400).json({ message: 'Could not extract video ID from URL' });
  }

  try {
    // =========================================================================
    // CACHE-FIRST: Check if video exists in database
    // =========================================================================
    const cached = await getCachedIntelligence(videoId);
    
    if (cached) {
      logCacheHit(videoId);
      
      return res.json({
        success: true,
        data: cached.intelligence,
        cacheHit: true,
        keyStatus: getKeyStatus()
      });
    }

    // =========================================================================
    // CACHE MISS: Call Gemini AI
    // =========================================================================
    logCacheMiss(videoId);
    
    const intelligence = await extractNuggetIntelligence(videoUrl);
    
    res.json({
      success: true,
      data: intelligence,
      cacheHit: false,
      keyStatus: getKeyStatus()
    });

  } catch (error: unknown) {
    const err = error as Error;
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.id, req.path);
    requestLogger.error({
      msg: '[AI] Intelligence extraction error',
      error: {
        message: err.message,
        stack: err.stack,
      },
    });
    captureException(err, { requestId: req.id, route: req.path });
    
    const message = err.message || 'Failed to extract intelligence';
    const status = message.includes('exhausted') || message.includes('rate limit') || message.includes('429') ? 429 : 500;
    
    res.status(status).json({ 
      message,
      keyStatus: getKeyStatus()
    });
  }
};

// ============================================================================
// LEGACY ENDPOINT: Analyze YouTube (deprecated)
// ============================================================================

/**
 * @deprecated Use processYouTube or extractIntelligence instead
 */
export const analyzeYouTubeVideo = async (req: Request, res: Response) => {
  return extractIntelligence(req, res);
};

// ============================================================================
// LEGACY ENDPOINTS: Text Summarization
// ============================================================================

/**
 * Summarize text into a Nugget format
 * POST /api/ai/summarize
 */
export const summarizeText = async (req: Request, res: Response) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ message: 'Text is required' });
  }

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert news editor. Condense the following text into a "Nugget" - a bite-sized, high-value piece of information.
      
      Input: "${text.substring(0, 10000)}"
      
      Output JSON with:
      - title: max 60 chars, catchy
      - excerpt: max 280 chars, key insight
      - tags: array of strings (max 3)`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            excerpt: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("Empty response from AI");
    
    res.json(JSON.parse(resultText));

  } catch (error) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.id, req.path);
    requestLogger.error({
      msg: '[AI] Summarize error',
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Failed to generate summary' });
  }
};

/**
 * Generate takeaways from text
 * POST /api/ai/takeaways
 */
export const generateTakeaways = async (req: Request, res: Response) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ message: 'Text is required' });
  }

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze the text and provide 3-5 concise takeaways formatted as a Markdown list.
      
      Text: "${text.substring(0, 15000)}"`,
      config: {
        thinkingConfig: { thinkingBudget: 1024 }
      }
    });

    res.json({ takeaway: response.text });
  } catch (error) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.id, req.path);
    requestLogger.error({
      msg: '[AI] Takeaways error',
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Failed to generate takeaways' });
  }
};

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

/**
 * Get Gemini API key status for dashboard widget
 * GET /api/ai/admin/key-status
 */
export const getKeyStatusController = async (_req: Request, res: Response) => {
  try {
    const keyStatus = getKeyStatus();
    res.json(keyStatus);
  } catch (error: unknown) {
    const err = error as Error;
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', undefined, req.path);
    requestLogger.error({
      msg: '[AI] Key status error',
      error: {
        message: err.message,
        stack: err.stack,
      },
    });
    captureException(err, { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Failed to get key status' });
  }
};

/**
 * Reset all exhausted API keys
 * POST /api/ai/admin/reset-keys
 */
export const resetKeysController = async (_req: Request, res: Response) => {
  try {
    resetExhaustedKeys();
    const keyStatus = getKeyStatus();
    res.json({ 
      success: true, 
      message: 'All API keys have been reset',
      keyStatus 
    });
  } catch (error: unknown) {
    const err = error as Error;
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', undefined, req.path);
    requestLogger.error({
      msg: '[AI] Reset keys error',
      error: {
        message: err.message,
        stack: err.stack,
      },
    });
    captureException(err, { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Failed to reset keys' });
  }
};
