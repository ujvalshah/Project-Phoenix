import { Article } from '../models/Article.js';

export type FeedBadgeKey = 'home' | 'market-pulse';

export interface UnseenFeedCounts {
  home: number;
  marketPulse: number;
}

type StreamValue = 'standard' | 'pulse' | 'both';

function buildPublicPublishedQuery() {
  return {
    $and: [
      {
        $or: [
          { visibility: 'public' },
          { visibility: { $exists: false } },
          { visibility: null },
        ],
      },
      {
        $or: [
          { status: 'published' },
          { status: { $exists: false } },
          { status: null },
        ],
      },
    ],
  };
}

function buildStreamQuery(feed: FeedBadgeKey) {
  if (feed === 'market-pulse') {
    return { contentStream: { $in: ['pulse', 'both'] as StreamValue[] } };
  }

  return {
    $or: [
      { contentStream: { $in: ['standard', 'both'] as StreamValue[] } },
      { contentStream: { $exists: false } },
      { contentStream: null },
    ],
  };
}

export function buildUnseenFeedQuery(userId: string, feed: FeedBadgeKey) {
  return {
    $and: [
      buildPublicPublishedQuery(),
      buildStreamQuery(feed),
      { [`readBy.${userId}`]: { $ne: true } },
    ],
  };
}

export async function getUnseenCountForFeed(userId: string, feed: FeedBadgeKey): Promise<number> {
  return Article.countDocuments(buildUnseenFeedQuery(userId, feed));
}

export async function getUnseenFeedCountsForUser(userId: string): Promise<UnseenFeedCounts> {
  const [home, marketPulse] = await Promise.all([
    getUnseenCountForFeed(userId, 'home'),
    getUnseenCountForFeed(userId, 'market-pulse'),
  ]);
  return { home, marketPulse };
}

export function buildMarkSeenQuery(feed: FeedBadgeKey) {
  return {
    $and: [buildPublicPublishedQuery(), buildStreamQuery(feed)],
  };
}

export async function markFeedSeenForUser(userId: string, feed: FeedBadgeKey): Promise<void> {
  await Article.updateMany(buildMarkSeenQuery(feed), {
    $set: { [`readBy.${userId}`]: true },
  });
}
