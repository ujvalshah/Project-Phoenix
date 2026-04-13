# Live TV Feature Plan

**Status:** Parked — decision pending on whether to proceed  
**Date:** 2026-04-13  
**Inspiration:** worldmonitor.app (https://github.com/koala73/worldmonitor)

## Goal

Add a `/live-tv` page showing live financial news channels (Bloomberg, CNBC, CNBC TV18, NDTV Profit).

## Problem

YouTube live stream video IDs change every time a channel starts a new stream, so hardcoding IDs is not viable.

## Chosen Approach: YouTube API Lookup + Cache (Hybrid)

### Backend

- **New endpoint:** `GET /api/live-tv/resolve/:channelId`
- Calls YouTube Data API v3 to resolve the current live video ID:
  ```
  GET https://www.googleapis.com/youtube/v3/search
    ?channelId=CHANNEL_ID
    &eventType=live
    &type=video
    &key=YOUR_API_KEY
  ```
- **Caching:** In-memory cache (node-cache or Map with TTL) for 10-15 min per channel to minimize API quota usage
- **Static fallback IDs:** Hardcoded "last known" video IDs per channel as fallback if API fails

### Resolution Logic

```
1. Check cache for fresh videoId -> use it
2. Cache miss -> call YouTube API -> cache result
3. API fails -> use hardcoded fallbackVideoId
4. Channel has HLS URL -> prefer that over YouTube entirely
```

### Frontend

- New route: `/live-tv`
- Grid of channel cards with logos/thumbnails
- Clicking a channel opens a YouTube iframe embed with the resolved video ID
- Lazy loading: only load the iframe for the active channel

### Target Channels

| Channel       | YouTube Channel ID              |
|---------------|----------------------------------|
| Bloomberg     | `UCIALMKvObZNtJ68-rmLjoCw`     |
| CNBC          | `UCvJJ_dzjViJCoLf5uKUTwoA`     |
| CNBC TV18     | `UCaHNFIob5Ixv74f40zAJMYQ`     |
| NDTV Profit   | `UCaHEdJbkSJF8KcXiUBRPHaA`     |

## Alternative Approaches Considered

### Approach 1: YouTube Channel Embed (Simplest)
- URL: `https://www.youtube.com/embed/live_stream?channel=CHANNEL_ID`
- Auto-resolves to current live stream, zero maintenance
- **Rejected:** Undocumented endpoint, could break without notice

### Approach 3: RSS Feed Parsing (Free, No API Key)
- URL: `https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID`
- Parse server-side to find latest live video
- **Rejected:** Less reliable for detecting "currently live" vs "recent upload"

### HLS Direct Streams (Optional Enhancement)
- For channels with known `.m3u8` URLs, use hls.js (~60KB) for direct playback
- Full control over player UI, no YouTube branding
- Can be added later as an enhancement for specific channels

## Key Considerations

- **API Quota:** YouTube Data API free tier = 10,000 units/day. Search = 100 units each. With 4 channels cached 10-15 min, ~576 calls/day = 57,600 units. Aggressive caching (15 min+) is essential.
- **Geo-restrictions:** Some channels may be restricted in certain regions
- **Server load:** Zero video serving load — YouTube CDN handles all delivery
- **Implementation notes:** Use Zod for validation per project conventions. Add Express route. Add React Router page.
