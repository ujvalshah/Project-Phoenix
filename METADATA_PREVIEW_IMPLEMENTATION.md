# Metadata-First Content Preview System - Implementation Summary

## Overview

A conservative, metadata-first content preview system for the News/Knowledge Curation web app. Follows the philosophy: **"Every card is a decision surface, not a consumption surface."**

## Key Principles

✅ **NO iframes** - Cards are previews only  
✅ **NO third-party SDKs for normal users** - Microlink is admin-only  
✅ **NO aggressive scraping** - Respectful, bounded requests  
✅ **Stability > richness** - Fallback is acceptable UX  
✅ **UX consistency > perfect previews** - Predictable behavior  

## Implementation Files

### 1. Canonical Schema
- **File**: `src/types/nugget.ts`
- **Purpose**: Immutable TypeScript schema for normalized metadata
- **Key Features**:
  - Server-side calculated `aspectRatio` (MUST be integer)
  - Media dimensions are immutable once stored
  - Frontend MUST NOT guess dimensions

### 2. Metadata Service
- **File**: `server/src/services/metadata.ts`
- **Purpose**: Core unfurl logic with tiered waterfall strategy
- **Key Features**:
  - Tier 0: Zero-risk URL parsing (instant)
  - Tier 0.5: Optional Twitter oEmbed (non-blocking, 800ms)
  - Tier 1: Microlink (admin-only, feature-flagged, 1500ms)
  - Tier 2: Open Graph scraping (articles, 1500ms)
  - Tier 3: Image probing (guarded, 1000ms, max 5MB)
  - Tier 4: Guaranteed fallback (always available)
  - Hard timeout: 5000ms total
  - In-memory caching (24 hours TTL)

### 3. API Endpoint
- **File**: `server/src/controllers/unfurlController.ts`
- **Route**: `POST /api/unfurl`
- **Authentication**: Optional (admin users get Microlink access)
- **Request Body**: `{ url: string }`
- **Response**: `Nugget` (normalized metadata)

### 4. Route Configuration
- **File**: `server/src/routes/unfurl.ts`
- **Registered**: `server/src/index.ts` → `/api/unfurl`

### 5. Test Script
- **File**: `server/scripts/test-unfurl.ts`
- **Usage**: `tsx server/scripts/test-unfurl.ts`
- **Tests**: YouTube, Twitter/X, Articles

## Platform-Specific Rules

### YouTube
- Pattern matching only (no scraping)
- Thumbnail: `img.youtube.com/vi/{videoId}/maxresdefault.jpg`
- Dimensions: 1280x720 (aspectRatio: 1.78)
- Platform color: `#FF0000`
- CTA: "Watch on YouTube →"

### X / Twitter
- NO User-Agent spoofing
- NO HTML scraping
- Tier 0 + 0.5 + optional Tier 1 only
- Immediate fallback if blocked
- Platform colors:
  - X: `#000000`
  - Twitter: `#1DA1F2`

### Documents
- Detect file extension
- No previews (icon-based card only)
- No media object

### Images
- Direct image URLs only
- Always probe dimensions if possible
- Fallback: aspectRatio = 1.91 if probe fails

## Feature Flags

Configure via environment variables:

```bash
# Enable Microlink (admin-only by default)
MICROLINK_ENABLED=true

# Allow normal users to use Microlink (default: false)
MICROLINK_ADMIN_ONLY=true

# Microlink API key (required if enabled)
MICROLINK_API_KEY=your_api_key_here
```

## Caching Strategy

- **Cache ALL results** (including fallbacks)
- **Cache failures** to prevent repeated slow attempts
- **TTL**: 24 hours
- **Never re-unfurl** unless explicitly refreshed by admin
- In-memory cache (can be upgraded to Redis later)

## Usage Example

```typescript
// Frontend
const response = await fetch('/api/unfurl', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Optional: Include auth token for admin Microlink access
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ url: 'https://example.com/article' }),
});

const nugget: Nugget = await response.json();

// Use nugget.media.aspectRatio to reserve layout space
// Never render iframes or embed third-party media
// Cards are previews only - clicking opens original URL
```

## Testing

Run the test script:

```bash
npm run dev:server  # Start server in one terminal
tsx server/scripts/test-unfurl.ts  # Run tests in another
```

## Dependencies Added

- `open-graph-scraper` - Open Graph metadata extraction
- `probe-image-size` - Image dimension probing

## Failure Conditions (All Avoided)

✅ No iframes introduced  
✅ No User-Agent spoofing  
✅ Microlink is admin-only  
✅ aspectRatio always present  
✅ Image probing is bounded (5MB limit, 1000ms timeout)  
✅ X/Twitter scraping is not assumed reliable  
✅ Metadata never blocks content creation  

## Next Steps

1. **Frontend Integration**: Update card components to use `Nugget` schema
2. **Cache Upgrade**: Consider Redis for production (optional)
3. **Admin Cache Invalidation**: Add endpoint to clear cache (optional)
4. **Monitoring**: Add metrics for tier success rates (optional)

## Notes

- All timeouts are conservative to ensure stability
- Fallback is acceptable UX - don't trade stability for richer previews
- Microlink is free-tier only - respect rate limits
- Normal users never trigger Microlink (enforced by code)












