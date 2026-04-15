import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../models/Article.js', () => ({
  Article: {
    countDocuments: vi.fn(),
    updateMany: vi.fn(),
  },
}));

import { Article } from '../models/Article.js';
import {
  buildUnseenFeedQuery,
  getUnseenFeedCountsForUser,
  markFeedSeenForUser,
} from '../services/unseenBadgeService.js';

describe('unseenBadgeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds Home unseen query using per-user readBy and no time window', () => {
    const query = buildUnseenFeedQuery('user-1', 'home') as Record<string, unknown>;
    expect(JSON.stringify(query)).toContain('readBy.user-1');
    expect(JSON.stringify(query)).toContain('contentStream');
    expect(JSON.stringify(query)).not.toContain('createdAt');
    expect(JSON.stringify(query)).not.toContain('publishedAt');
    expect(JSON.stringify(query)).not.toContain('24h');
    expect(JSON.stringify(query)).not.toContain('yesterday');
  });

  it('returns aggregated counts for Home and Market Pulse', async () => {
    vi.mocked(Article.countDocuments)
      .mockResolvedValueOnce(2 as never)
      .mockResolvedValueOnce(5 as never);

    const counts = await getUnseenFeedCountsForUser('user-1');
    expect(counts).toEqual({ home: 2, marketPulse: 5 });
    expect(Article.countDocuments).toHaveBeenCalledTimes(2);
  });

  it('marks all Home feed nuggets as seen for the current user', async () => {
    vi.mocked(Article.updateMany).mockResolvedValue({} as never);
    await markFeedSeenForUser('user-abc', 'home');
    expect(Article.updateMany).toHaveBeenCalledTimes(1);
    const [, updateDoc] = vi.mocked(Article.updateMany).mock.calls[0];
    expect(updateDoc).toEqual({ $set: { 'readBy.user-abc': true } });
  });
});
