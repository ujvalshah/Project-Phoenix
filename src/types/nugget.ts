import { z } from 'zod';

/**
 * ============================================================================
 * PHASE 0: AI Intelligence Schema (Source of Truth for Gemini)
 * ============================================================================
 * This Zod schema ensures Gemini follows exact extraction rules.
 * Used for AI-generated intelligence extraction from content.
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

/**
 * ============================================================================
 * Canonical Nugget Schema (URL/Link Metadata)
 * ============================================================================
 * This schema is IMMUTABLE once stored.
 * All metadata must be normalized server-side.
 * Frontend MUST NOT guess dimensions or calculate aspectRatio.
 */

export interface Nugget {
  id: string;
  url: string;
  domain: string;
  contentType: 'article' | 'video' | 'social' | 'image' | 'document';
  title?: string;
  description?: string;

  media?: {
    type: 'image' | 'video';
    src: string;
    width: number;            // MUST be integer
    height: number;           // MUST be integer
    aspectRatio: number;      // width / height (calculated server-side)
    renderMode?: 'contain' | 'cover';
    isEstimated?: boolean;
  };

  source: {
    name: string;
    domain: string;
    favicon?: string;
    platformColor?: string;
  };

  author?: string;
  publishedAt?: string;
  quality?: 'full' | 'partial' | 'fallback';
}



