import { Article } from '../models/Article.js';
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
function buildStreamQuery(feed) {
    if (feed === 'market-pulse') {
        return { contentStream: { $in: ['pulse', 'both'] } };
    }
    return {
        $or: [
            { contentStream: { $in: ['standard', 'both'] } },
            { contentStream: { $exists: false } },
            { contentStream: null },
        ],
    };
}
export function buildUnseenFeedQuery(userId, feed) {
    return {
        $and: [
            buildPublicPublishedQuery(),
            buildStreamQuery(feed),
            { [`readBy.${userId}`]: { $ne: true } },
        ],
    };
}
export async function getUnseenCountForFeed(userId, feed) {
    return Article.countDocuments(buildUnseenFeedQuery(userId, feed));
}
export async function getUnseenFeedCountsForUser(userId) {
    const [home, marketPulse] = await Promise.all([
        getUnseenCountForFeed(userId, 'home'),
        getUnseenCountForFeed(userId, 'market-pulse'),
    ]);
    return { home, marketPulse };
}
export function buildMarkSeenQuery(feed) {
    return {
        $and: [buildPublicPublishedQuery(), buildStreamQuery(feed)],
    };
}
export async function markFeedSeenForUser(userId, feed) {
    await Article.updateMany(buildMarkSeenQuery(feed), {
        $set: { [`readBy.${userId}`]: true },
    });
}
//# sourceMappingURL=unseenBadgeService.js.map