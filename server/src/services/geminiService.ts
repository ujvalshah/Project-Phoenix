/**
 * Gemini AI Service - Pure YouTube Intelligence Extraction
 * 
 * A PURE SERVICE that takes a YouTube URL and returns Zod-validated NuggetIntelligence.
 * NO database logic allowed in this file.
 * 
 * ARCHITECTURE:
 * - Pure function: URL in → NuggetIntelligence out
 * - Key Rotation Pool with automatic retry on 429
 * - Zod validation ensures type-safe output
 * - High-level terminal logging for monitoring
 * 
 * EFFICIENCY LAYER:
 * - GEMINI_KEYS rotation: On 429, switch to next key and retry once
 * - Logs cacheHit and keyUsed for terminal monitoring
 */

import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

// ============================================================================
// NUGGET INTELLIGENCE SCHEMA (Source of Truth)
// ============================================================================

/**
 * The canonical Zod schema for AI-extracted video intelligence.
 * This is the contract between the AI and the rest of the application.
 */
export const NuggetIntelligenceSchema = z.object({
  title: z.string().describe("A punchy, high-impact headline"),
  metadata: z.object({
    source: z.string(),
    speaker: z.string(),
    category: z.enum(["Macro", "Economy", "Geopolitics", "Tech", "AI", "Finance"]),
    sentiment: z.enum(["Bullish", "Bearish", "Neutral"]),
  }),
  abstract: z.string().max(250).describe("2-sentence high-level 'Why this matters'"),
  domainIntelligence: z.object({
    primarySignal: z.string().describe("The core economic or technical signal"),
    impact: z.string().describe("Impact on markets or industry moats"),
    metric: z.string().optional().describe("A key percentage or number if applicable"),
  }),
  dataVault: z.array(z.object({
    label: z.string(),
    value: z.string(),
    timestamp: z.string().optional()
  })).describe("List of hard numbers, dates, and figures with timestamps"),
  visualAnchor: z.object({
    anecdote: z.string().describe("The most memorable story or analogy used"),
    actionableTakeaway: z.string().describe("The single most important 'Nugget' insight")
  }),
  frictionPoint: z.string().describe("The biggest risk or what the speaker missed")
});

export type NuggetIntelligence = z.infer<typeof NuggetIntelligenceSchema>;

// ============================================================================
// CONFIGURATION
// ============================================================================

const MODEL_NAME = 'gemini-2.0-flash';

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

/**
 * High-level logging for terminal monitoring
 * Uses emoji prefixes for quick visual scanning
 */
const log = {
  info: (msg: string) => console.log(`[Gemini] ℹ️  ${msg}`),
  success: (msg: string) => console.log(`[Gemini] ✅ ${msg}`),
  warn: (msg: string) => console.log(`[Gemini] ⚠️  ${msg}`),
  error: (msg: string) => console.log(`[Gemini] ❌ ${msg}`),
  key: (msg: string) => console.log(`[Gemini] 🔑 ${msg}`),
  cache: (msg: string) => console.log(`[Gemini] 💾 ${msg}`),
  api: (msg: string) => console.log(`[Gemini] 🤖 ${msg}`),
};

// ============================================================================
// KEY ROTATION POOL
// ============================================================================

/**
 * Parse API keys from environment variable.
 * Supports GEMINI_KEYS (comma-separated array) or single key fallbacks.
 */
function parseApiKeys(): string[] {
  const keyString = process.env.GEMINI_KEYS 
    || process.env.GOOGLE_API_KEY 
    || process.env.GEMINI_API_KEY 
    || process.env.API_KEY 
    || '';
  
  return keyString
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0);
}

// All available API keys
const API_KEYS = parseApiKeys();

// Log key status on startup with clear formatting
console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           GEMINI SERVICE - KEY ROTATION POOL               ║');
console.log('╠════════════════════════════════════════════════════════════╣');
if (API_KEYS.length === 0) {
  console.log('║  ❌ NO API KEYS FOUND!                                      ║');
  console.log('║  Set GEMINI_KEYS in your .env file                         ║');
} else {
  console.log(`║  🔑 Loaded ${API_KEYS.length} API key(s)                                       ║`);
  API_KEYS.forEach((key, i) => {
    const masked = key.slice(0, 8) + '...' + key.slice(-4);
    console.log(`║     Key ${i + 1}: ${masked}                                  ║`);
  });
}
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// Current key index for rotation
let currentKeyIndex = 0;

// Track exhausted keys (keys that hit rate limit)
const exhaustedKeys = new Set<number>();

// Time to reset exhausted keys (1 minute)
const EXHAUSTED_KEY_RESET_MS = 60 * 1000;

// Track key usage stats for monitoring
const keyStats = {
  totalRequests: 0,
  successfulRequests: 0,
  cacheHits: 0,
  rotations: 0,
  errors: 0,
};

/**
 * Get the current API key
 */
function getCurrentApiKey(): string | null {
  if (API_KEYS.length === 0) return null;
  return API_KEYS[currentKeyIndex];
}

/**
 * Get masked key for logging (shows first 8 and last 4 chars)
 */
function getMaskedKey(keyIndex: number): string {
  if (keyIndex < 0 || keyIndex >= API_KEYS.length) return 'unknown';
  const key = API_KEYS[keyIndex];
  return key.slice(0, 8) + '...' + key.slice(-4);
}

/**
 * Rotate to the next available API key after a 429 error.
 * Returns true if rotation was successful, false if all keys are exhausted.
 */
function rotateToNextKey(): boolean {
  if (API_KEYS.length <= 1) {
    log.warn('Only 1 key available - cannot rotate');
    return false;
  }
  
  // Mark current key as exhausted
  const exhaustedKeyIndex = currentKeyIndex;
  exhaustedKeys.add(exhaustedKeyIndex);
  keyStats.rotations++;
  
  log.key(`Key ${exhaustedKeyIndex + 1} [${getMaskedKey(exhaustedKeyIndex)}] → RATE LIMITED (cooling ${EXHAUSTED_KEY_RESET_MS / 1000}s)`);
  
  // Schedule reset for this key
  setTimeout(() => {
    exhaustedKeys.delete(exhaustedKeyIndex);
    log.key(`Key ${exhaustedKeyIndex + 1} [${getMaskedKey(exhaustedKeyIndex)}] → AVAILABLE AGAIN`);
  }, EXHAUSTED_KEY_RESET_MS);
  
  // Find next non-exhausted key
  for (let i = 1; i < API_KEYS.length; i++) {
    const nextIndex = (currentKeyIndex + i) % API_KEYS.length;
    if (!exhaustedKeys.has(nextIndex)) {
      const oldKey = currentKeyIndex + 1;
      currentKeyIndex = nextIndex;
      log.key(`ROTATED: Key ${oldKey} → Key ${currentKeyIndex + 1} [${getMaskedKey(currentKeyIndex)}]`);
      return true;
    }
  }
  
  log.error('ALL KEYS EXHAUSTED - No available keys for rotation');
  return false;
}

/**
 * Check if an error is a rate limit (429) error
 */
function isRateLimitError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return msg.includes('429') 
    || msg.includes('resource_exhausted') 
    || msg.includes('quota')
    || msg.includes('rate limit')
    || msg.includes('too many requests');
}

/**
 * Manually reset all exhausted keys.
 * Use when you know the rate limits have cleared.
 */
export function resetExhaustedKeys(): void {
  const count = exhaustedKeys.size;
  exhaustedKeys.clear();
  currentKeyIndex = 0;
  log.key(`MANUAL RESET: ${count} exhausted key(s) cleared. Now using Key 1`);
}

/**
 * Create a GoogleGenAI client with the current key
 */
function createClient(): GoogleGenAI | null {
  const apiKey = getCurrentApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

/**
 * Get API key status for monitoring dashboards
 */
export function getKeyStatus(): {
  total: number;
  currentIndex: number;
  exhausted: number;
  available: number;
  stats: typeof keyStats;
  keys: Array<{ index: number; status: 'active' | 'rate-limited' | 'standby'; masked: string }>;
} {
  const keys = API_KEYS.map((_, index) => {
    let status: 'active' | 'rate-limited' | 'standby';
    if (index === currentKeyIndex) {
      status = 'active';
    } else if (exhaustedKeys.has(index)) {
      status = 'rate-limited';
    } else {
      status = 'standby';
    }
    return { index: index + 1, status, masked: getMaskedKey(index) };
  });

  return {
    total: API_KEYS.length,
    currentIndex: currentKeyIndex + 1,
    exhausted: exhaustedKeys.size,
    available: API_KEYS.length - exhaustedKeys.size,
    stats: { ...keyStats },
    keys,
  };
}

/**
 * Check if the Gemini service is properly configured
 */
export function isGeminiConfigured(): boolean {
  return API_KEYS.length > 0;
}

/**
 * Get the model name being used
 */
export function getModelName(): string {
  return MODEL_NAME;
}

/**
 * Increment cache hit counter (called from controller)
 */
export function recordCacheHit(): void {
  keyStats.cacheHits++;
}

/**
 * Log a cache hit event for terminal monitoring
 */
export function logCacheHit(videoId: string): void {
  keyStats.cacheHits++;
  log.cache(`CACHE HIT for video ${videoId} (Total: ${keyStats.cacheHits})`);
}

/**
 * Log a cache miss event for terminal monitoring
 */
export function logCacheMiss(videoId: string): void {
  log.cache(`CACHE MISS for video ${videoId} → calling Gemini API`);
}

// ============================================================================
// SYSTEM PROMPT - Optimized for NuggetIntelligence Extraction
// ============================================================================

const SYSTEM_PROMPT = `You are an elite intelligence analyst specializing in extracting structured insights from video content.

## INSTRUCTIONS
Watch the video carefully and pay close attention to:
- On-screen text, titles, and lower thirds
- Charts, graphs, and data visualizations
- Visual cues and demonstrations
- Speaker expressions and emphasis
- Any numbers or statistics shown on screen

## OUTPUT FORMAT
Return ONLY valid JSON matching this exact schema:
{
  "title": "Punchy, high-impact headline",
  "metadata": {
    "source": "Channel/show name",
    "speaker": "Primary speaker name",
    "category": "Macro|Economy|Geopolitics|Tech|AI|Finance",
    "sentiment": "Bullish|Bearish|Neutral"
  },
  "abstract": "2-sentence 'Why this matters' (max 250 chars)",
  "domainIntelligence": {
    "primarySignal": "The core economic or technical signal",
    "impact": "Impact on markets or industry moats",
    "metric": "Key percentage or number if mentioned (optional)"
  },
  "dataVault": [
    { "label": "Data point name", "value": "The number/figure", "timestamp": "When mentioned (optional)" }
  ],
  "visualAnchor": {
    "anecdote": "Most memorable story or analogy used",
    "actionableTakeaway": "Single most important 'Nugget' insight"
  },
  "frictionPoint": "Biggest risk or what the speaker missed"
}

## RULES
1. category MUST be exactly one of: Macro, Economy, Geopolitics, Tech, AI, Finance
2. sentiment MUST be exactly one of: Bullish, Bearish, Neutral
3. abstract MUST be under 250 characters
4. dataVault should contain 2-5 key data points with specific numbers (include data from charts/visuals)
5. actionableTakeaway should be ONE sentence the viewer can act on
6. frictionPoint: Be critical - what's the blind spot or risk?

Return ONLY the JSON object. No markdown code blocks, no explanation.`;

// ============================================================================
// YOUTUBE URL HELPERS
// ============================================================================

/**
 * Validate that a URL is a valid YouTube video URL
 */
export function isValidYouTubeUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    
    if (hostname === 'youtube.com' || hostname === 'www.youtube.com' || hostname === 'm.youtube.com') {
      if (url.pathname === '/watch' && url.searchParams.has('v')) return true;
      if (url.pathname.startsWith('/embed/') && url.pathname.length > 7) return true;
      if (url.pathname.startsWith('/v/') && url.pathname.length > 3) return true;
    }
    
    if (hostname === 'youtu.be') {
      return url.pathname.length > 1;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Extract video ID from a YouTube URL
 */
export function extractYouTubeVideoId(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    
    if (hostname.includes('youtube.com') && url.pathname === '/watch') {
      return url.searchParams.get('v');
    }
    
    if (hostname === 'youtu.be') {
      return url.pathname.slice(1).split('?')[0];
    }
    
    if (hostname.includes('youtube.com') && url.pathname.startsWith('/embed/')) {
      return url.pathname.slice(7).split('?')[0];
    }
    
    if (hostname.includes('youtube.com') && url.pathname.startsWith('/v/')) {
      return url.pathname.slice(3).split('?')[0];
    }
    
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// MAIN FUNCTION - PURE SERVICE
// ============================================================================

/**
 * Extract NuggetIntelligence from a YouTube video URL.
 * 
 * This is a PURE SERVICE function:
 * - Input: YouTube URL
 * - Output: Zod-validated NuggetIntelligence
 * - NO database operations
 * 
 * KEY ROTATION: On 429 error, switches to next key in GEMINI_KEYS and retries ONCE.
 * 
 * LOGGING: High-level logs for terminal monitoring:
 * - keyUsed: Which key (1, 2, 3...) was used for the request
 * - rotation events: When keys are rotated due to 429
 * - success/error: Final result with timing
 * 
 * @param videoUrl - Full YouTube URL (supports youtube.com and youtu.be formats)
 * @returns Promise<NuggetIntelligence> - Validated intelligence data
 * @throws Error if API key not configured, invalid URL, or generation fails
 */
export async function extractNuggetIntelligence(videoUrl: string): Promise<NuggetIntelligence> {
  const startTime = Date.now();
  keyStats.totalRequests++;
  
  // Validate API keys are configured
  if (API_KEYS.length === 0) {
    keyStats.errors++;
    throw new Error('No API keys configured. Set GEMINI_KEYS in environment.');
  }

  // Validate YouTube URL format
  if (!isValidYouTubeUrl(videoUrl)) {
    keyStats.errors++;
    throw new Error('Invalid YouTube URL. Please provide a valid youtube.com or youtu.be URL.');
  }

  const videoId = extractYouTubeVideoId(videoUrl);
  log.api(`REQUEST #${keyStats.totalRequests} | Video: ${videoId}`);

  let lastError: Error | null = null;
  let hasRetried = false;
  const usedKeyIndex = currentKeyIndex;

  // Main attempt + one retry on 429
  for (let attempt = 0; attempt < 2; attempt++) {
    const client = createClient();
    if (!client) {
      keyStats.errors++;
      throw new Error('Failed to create Gemini client - no valid API key');
    }

    const attemptKeyIndex = currentKeyIndex;
    log.key(`Using Key ${attemptKeyIndex + 1}/${API_KEYS.length} [${getMaskedKey(attemptKeyIndex)}]`);

    try {
      // Native Multimodal: Pass YouTube URL directly via fileData
      // Gemini 2.0 Flash can process YouTube videos natively
      const response = await client.models.generateContent({
        model: MODEL_NAME,
        contents: [
          {
            role: 'user',
            parts: [
              { text: SYSTEM_PROMPT },
              { text: `\n\nAnalyze this YouTube video and extract intelligence:` },
              {
                fileData: {
                  mimeType: 'video/mp4',
                  fileUri: videoUrl
                }
              }
            ]
          }
        ],
        config: {
          temperature: 0.3,
          topP: 0.8,
          maxOutputTokens: 2048,
        }
      });

      const responseText = response.text?.trim();
      
      if (!responseText) {
        throw new Error('Empty response from Gemini API');
      }

      // Clean potential markdown wrapper
      const cleanJson = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      // Parse JSON response
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleanJson);
      } catch (parseError) {
        log.error(`JSON parse error: ${cleanJson.slice(0, 100)}...`);
        throw new Error(`Failed to parse Gemini response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown'}`);
      }

      // Validate with Zod schema
      const validated = NuggetIntelligenceSchema.parse(parsed);
      
      const duration = Date.now() - startTime;
      keyStats.successfulRequests++;
      
      // Success log with all key info
      log.success(`EXTRACTED in ${duration}ms | Key ${attemptKeyIndex + 1} | "${validated.title.slice(0, 50)}..." [${validated.metadata.category}/${validated.metadata.sentiment}]`);
      
      // Print stats summary periodically
      if (keyStats.totalRequests % 5 === 0) {
        console.log('');
        console.log(`[Gemini] 📊 STATS | Requests: ${keyStats.totalRequests} | Success: ${keyStats.successfulRequests} | Cache: ${keyStats.cacheHits} | Rotations: ${keyStats.rotations} | Errors: ${keyStats.errors}`);
        console.log('');
      }
      
      return validated;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if this is a 429 rate limit error
      if (isRateLimitError(lastError) && !hasRetried) {
        log.warn(`429 RATE LIMIT on Key ${currentKeyIndex + 1} → attempting rotation...`);
        
        // Try to rotate to next key
        if (rotateToNextKey()) {
          hasRetried = true;
          log.info(`Retrying with Key ${currentKeyIndex + 1}...`);
          continue;
        } else {
          keyStats.errors++;
          throw new Error('All API keys have hit rate limits. Please try again in 1 minute.');
        }
      }
      
      // Not a rate limit error or already retried - don't retry
      break;
    }
  }

  // Re-throw the last error with context
  keyStats.errors++;
  const duration = Date.now() - startTime;
  
  if (lastError) {
    log.error(`FAILED after ${duration}ms | Key ${usedKeyIndex + 1} | ${lastError.message.slice(0, 100)}`);
    
    if (lastError.message.includes('API key')) {
      throw new Error('Invalid Gemini API key. Please check your configuration.');
    }
    if (lastError.message.includes('blocked') || lastError.message.includes('safety')) {
      throw new Error('Content was blocked by safety filters. The video may contain restricted content.');
    }
    throw lastError;
  }

  throw new Error('Unknown error occurred while extracting intelligence');
}
