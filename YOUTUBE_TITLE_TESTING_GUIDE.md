# YouTube Title Fetching - Testing Guide

## 🧪 Comprehensive Testing Guide

This document provides step-by-step testing procedures to validate the hardened YouTube title-fetching implementation.

---

## Prerequisites

- Development environment running (frontend + backend)
- MongoDB accessible
- At least 2 different browsers/devices for multi-user testing
- Network inspector (browser DevTools) open

---

## Test Suite

### Test 1: Fresh Video (No Backend Data)

**Objective**: Verify title fetches from YouTube and persists to backend

**Steps**:
1. Create a new nugget with a YouTube URL (e.g., `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
2. Do NOT manually enter a title
3. Save the nugget
4. Observe the card in the feed

**Expected Behavior**:
- ✅ Initial render: Shows fallback text ("YouTube Video")
- ✅ After ~300ms: Shows actual YouTube title
- ✅ Network tab: ONE request to `https://www.youtube.com/oembed`
- ✅ Network tab: ONE PATCH request to `/api/articles/:id`
- ✅ Title displays exactly as returned by YouTube (no modifications)

**Verify in Database**:
```javascript
db.articles.findOne({ _id: "nugget-id" })
// Expected:
{
  media: {
    type: "youtube",
    url: "https://www.youtube.com/watch?v=...",
    previewMetadata: {
      title: "Rick Astley - Never Gonna Give You Up (Official Video)",
      titleSource: "youtube-oembed",
      titleFetchedAt: "2025-12-24T12:00:00.000Z"
    }
  }
}
```

---

### Test 2: Existing Video (Backend Data Present)

**Objective**: Verify title loads from backend without fetching from YouTube

**Steps**:
1. Using the nugget from Test 1 (which now has backend title)
2. Refresh the page
3. Observe the card in the feed

**Expected Behavior**:
- ✅ Title displays immediately (no delay)
- ✅ Network tab: NO request to `https://www.youtube.com/oembed`
- ✅ Network tab: NO PATCH request to `/api/articles/:id`
- ✅ Same title as before (backend data used)

**Verify**:
- Open Network tab BEFORE refresh
- Filter by "oembed" → should show 0 results
- Title should appear instantly (< 50ms)

---

### Test 3: Cross-User Consistency

**Objective**: Verify all users see the same canonical title

**Steps**:
1. User A creates a nugget with YouTube URL (title fetches and persists)
2. User B (different account, different device) views the same nugget

**Expected Behavior**:
- ✅ User A: Sees title after ~300ms fetch
- ✅ User B: Sees title immediately from backend (no fetch)
- ✅ Both users see IDENTICAL title (character-for-character)
- ✅ User B's browser: NO request to YouTube oEmbed

**Verify**:
- Use incognito/private window for User B
- Network tab for User B should show NO oembed requests
- Compare title text between users (must be identical)

---

### Test 4: Failed Fetch (Invalid Video)

**Objective**: Verify negative caching prevents retry storms

**Steps**:
1. Create a nugget with invalid YouTube URL (e.g., `https://www.youtube.com/watch?v=INVALID123`)
2. Save and observe the card
3. Refresh the page
4. Wait 5 seconds and refresh again

**Expected Behavior**:
- ✅ Initial render: Shows fallback text
- ✅ After fetch attempt: Still shows fallback text
- ✅ Network tab: ONE request to oembed (returns 4xx error)
- ✅ On refresh: NO new oembed requests (negative cache active)
- ✅ On 2nd refresh: NO new oembed requests (negative cache still active)
- ✅ No backend write (no PATCH request)

**Verify**:
- Check browser console for: `[YouTube Metadata] Skipping fetch for ... (negative cache)`
- Confirm no repeated oembed requests for 24 hours

---

### Test 5: In-Flight Deduplication

**Objective**: Verify concurrent requests for same video are deduplicated

**Steps**:
1. Create a feed with 5 different nuggets, all with the SAME YouTube video
2. Ensure video title is NOT in backend (use new video or clear database)
3. Load the feed
4. Observe network tab

**Expected Behavior**:
- ✅ Network tab: ONE request to `https://www.youtube.com/oembed` (not 5!)
- ✅ All 5 cards show fallback initially
- ✅ All 5 cards update to same title simultaneously
- ✅ ONE PATCH request to backend (first card to complete)
- ✅ Other cards use result from first fetch

**Verify**:
- Count oembed requests in Network tab → should be exactly 1
- Check browser console for: `[YouTube Metadata] Reusing in-flight request for ...`

---

### Test 6: Backend Overwrite Protection

**Objective**: Verify backend guards against overwriting existing titles

**Steps**:
1. Use a nugget with existing backend title
2. Using API client (Postman/curl), send PATCH request to update title:
   ```bash
   curl -X PATCH http://localhost:5000/api/articles/NUGGET_ID \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "media": {
         "previewMetadata": {
           "title": "FAKE TITLE ATTEMPT",
           "titleSource": "malicious",
           "titleFetchedAt": "2025-12-24T00:00:00.000Z"
         }
       }
     }'
   ```
3. Check backend logs
4. Verify nugget in UI

**Expected Behavior**:
- ✅ Backend logs: `Ignoring YouTube title update for article ... - backend title already exists`
- ✅ UI: Original title unchanged
- ✅ Database: Original title unchanged
- ✅ Update succeeds (returns 200) but title fields are ignored

**Verify in Database**:
```javascript
db.articles.findOne({ _id: "nugget-id" })
// media.previewMetadata.title should be ORIGINAL, not "FAKE TITLE ATTEMPT"
```

---

### Test 7: Multiple YouTube URLs

**Objective**: Verify different videos get different titles correctly

**Steps**:
1. Create nuggets with these YouTube URLs:
   - Video A: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
   - Video B: `https://www.youtube.com/watch?v=9bZkp7q19f0`
   - Video C: `https://youtu.be/oHg5SJYRHA0`
2. Observe all cards in feed

**Expected Behavior**:
- ✅ Each card shows correct title for its video
- ✅ Titles are different (not mixed up)
- ✅ Network tab: 3 separate oembed requests (one per unique video)
- ✅ All titles persist to backend correctly

**Verify**:
- Refresh page → all titles should appear instantly from backend
- Check database → each nugget has correct title

---

### Test 8: Refresh and Persistence

**Objective**: Verify titles survive page refreshes and browser restarts

**Steps**:
1. View feed with YouTube nuggets (titles loaded from backend)
2. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
3. Close browser completely
4. Reopen browser and navigate to feed

**Expected Behavior**:
- ✅ After hard refresh: Titles appear immediately (< 50ms)
- ✅ After browser restart: Titles appear immediately
- ✅ Network tab: NO oembed requests
- ✅ Titles are identical across all sessions

**Verify**:
- Time from page load to title display should be < 50ms (from backend)
- In-memory caches are cleared on browser restart, but titles still load instantly

---

### Test 9: Concurrent Tabs

**Objective**: Verify behavior when same nugget opens in multiple tabs simultaneously

**Steps**:
1. Use a YouTube nugget with NO backend title (new video)
2. Open same nugget in 3 browser tabs simultaneously
3. Observe network tabs in all 3 windows

**Expected Behavior**:
- ⚠️ Edge case: May see up to 3 oembed requests (each tab has separate runtime)
- ✅ First tab to complete persists title to backend
- ✅ Other tabs' PATCH requests will be ignored (backend guard)
- ✅ All tabs eventually show same title
- ✅ On refresh: All tabs use backend title (no new fetches)

**Verify**:
- After all tabs load, close all tabs
- Reopen in 1 tab → should load instantly from backend

---

### Test 10: Negative Cache TTL

**Objective**: Verify negative cache expires after 24 hours

**Steps**:
1. Create nugget with invalid YouTube URL (triggers negative cache)
2. Verify fetch is skipped on immediate retry
3. Mock time advance (or wait 24 hours in dev)
4. Refresh page

**Expected Behavior**:
- ✅ Within 24 hours: No retry attempts (negative cache active)
- ✅ After 24 hours: New fetch attempt (negative cache expired)

**Verify** (using DevTools):
```javascript
// Check negative cache status
localStorage.getItem('youtube_negative_cache') // Not used - in-memory only
// Manual test: Wait 24 hours or use time mocking
```

**Note**: For testing, you can reduce TTL temporarily:
```typescript
// src/utils/youtubeMetadata.ts
const NEGATIVE_CACHE_TTL_MS = 60 * 1000; // 1 minute (for testing)
```

---

## Performance Benchmarks

### Expected Timings

| Scenario | Expected Time | Acceptable Range |
|----------|---------------|------------------|
| Backend title load | < 50ms | 10-100ms |
| Fresh fetch + persist | ~300ms | 200-500ms |
| Cached title (in-memory) | < 1ms | < 10ms |
| Negative cache hit | < 1ms | < 10ms |
| Failed fetch (network) | ~2s | 1-5s |

### Network Request Expectations

| Scenario | YouTube oEmbed | Backend PATCH |
|----------|----------------|---------------|
| Fresh video (no backend data) | 1 | 1 |
| Existing video (has backend data) | 0 | 0 |
| Failed fetch | 1 | 0 |
| Duplicate videos (5x same video) | 1 | 1 |
| Refresh after fetch | 0 | 0 |

---

## Troubleshooting

### Issue: Title not persisting to backend

**Symptoms**: Title fetches but doesn't survive refresh

**Check**:
1. Network tab → verify PATCH request to `/api/articles/:id`
2. Browser console → check for persistence errors
3. Backend logs → verify update succeeded
4. Database → verify title field exists

**Common Causes**:
- Authentication token expired (PATCH returns 401)
- Nugget ID not passed to hook
- Backend validation error (check logs)

---

### Issue: Duplicate oembed requests

**Symptoms**: Multiple requests for same video in Network tab

**Check**:
1. Verify in-flight deduplication is working
2. Browser console → should see "Reusing in-flight request" messages
3. Check if requests are in different tabs (expected)

**Common Causes**:
- Multiple tabs (each has separate runtime)
- Hook called multiple times due to re-renders
- Video ID extraction failing (treated as different videos)

---

### Issue: Titles not appearing instantly on refresh

**Symptoms**: Delay or "YouTube Video" fallback on refresh

**Check**:
1. Database → verify title exists in `media.previewMetadata.title`
2. Network tab → verify backend returns title in response
3. Hook usage → verify `backendTitle` prop is passed correctly

**Common Causes**:
- Backend title not passed to hook
- Database query not including previewMetadata
- Backend response not normalized correctly

---

## Automated Testing (Future)

### Unit Tests

```typescript
// src/utils/youtubeMetadata.test.ts
describe('fetchYouTubeMetadata', () => {
  test('should deduplicate concurrent requests', async () => {
    const url = 'https://www.youtube.com/watch?v=TEST';
    const promises = [
      fetchYouTubeMetadata(url),
      fetchYouTubeMetadata(url),
      fetchYouTubeMetadata(url)
    ];
    const results = await Promise.all(promises);
    // All should return same result
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
  });

  test('should cache failed fetches', async () => {
    const url = 'https://www.youtube.com/watch?v=INVALID';
    const result1 = await fetchYouTubeMetadata(url);
    expect(result1).toBeNull();
    
    // Second call should use negative cache (mock fetch should not be called)
    const result2 = await fetchYouTubeMetadata(url);
    expect(result2).toBeNull();
  });
});
```

### Integration Tests

```typescript
// src/hooks/useYouTubeTitle.test.tsx
describe('useYouTubeTitle', () => {
  test('should use backend title if present', () => {
    const { result } = renderHook(() =>
      useYouTubeTitle({
        url: 'https://www.youtube.com/watch?v=TEST',
        backendTitle: 'Backend Title',
        nuggetId: 'nugget-123'
      })
    );
    expect(result.current).toBe('Backend Title');
  });

  test('should fetch and persist if backend title missing', async () => {
    const mockPersist = jest.fn();
    const { result, waitForNextUpdate } = renderHook(() =>
      useYouTubeTitle({
        url: 'https://www.youtube.com/watch?v=TEST',
        backendTitle: null,
        nuggetId: 'nugget-123',
        onTitlePersisted: mockPersist
      })
    );
    
    await waitForNextUpdate();
    expect(mockPersist).toHaveBeenCalled();
  });
});
```

---

## Success Criteria

All tests pass when:
- ✅ Titles fetch and persist correctly
- ✅ Backend data used as source of truth
- ✅ No duplicate fetches for same video
- ✅ Failed fetches handled gracefully
- ✅ Titles survive refreshes and browser restarts
- ✅ All users see identical titles
- ✅ No UI flicker or layout shifts
- ✅ Performance within acceptable ranges

---

## Test Completion Checklist

- [ ] Test 1: Fresh video (no backend data)
- [ ] Test 2: Existing video (backend data present)
- [ ] Test 3: Cross-user consistency
- [ ] Test 4: Failed fetch (negative caching)
- [ ] Test 5: In-flight deduplication
- [ ] Test 6: Backend overwrite protection
- [ ] Test 7: Multiple YouTube URLs
- [ ] Test 8: Refresh and persistence
- [ ] Test 9: Concurrent tabs
- [ ] Test 10: Negative cache TTL

---

**Testing Date**: _________________  
**Tester**: _________________  
**Status**: ⬜ Pass / ⬜ Fail  

---

**Next Steps After Testing**:
1. Document any edge cases discovered
2. Update implementation if issues found
3. Add automated tests for critical paths
4. Deploy to production






