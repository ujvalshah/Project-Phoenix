import { Report } from '../models/Report.js';
import { createSearchRegex } from '../utils/escapeRegExp.js';
export function buildModerationQuery(filters = {}) {
    const query = {};
    // Status filter - default to 'open' if not provided
    query.status = filters.status || 'open';
    // Optional filters
    if (filters.targetType) {
        query.targetType = filters.targetType;
    }
    if (filters.targetId) {
        query.targetId = filters.targetId;
    }
    // Search query (text search across multiple fields)
    // SECURITY: createSearchRegex escapes user input to prevent ReDoS
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
        const regex = createSearchRegex(filters.searchQuery);
        query.$or = [
            { reason: regex },
            { description: regex },
            { 'reporter.name': regex },
            { 'respondent.name': regex },
            { targetId: regex }
        ];
    }
    return query;
}
/**
 * Get moderation stats by status
 * Uses the same query builder as listReports for consistency
 */
export async function getModerationStats() {
    // Use shared query builder for each status
    const [openCount, resolvedCount, dismissedCount] = await Promise.all([
        Report.countDocuments(buildModerationQuery({ status: 'open' })),
        Report.countDocuments(buildModerationQuery({ status: 'resolved' })),
        Report.countDocuments(buildModerationQuery({ status: 'dismissed' }))
    ]);
    return {
        open: openCount,
        resolved: resolvedCount,
        dismissed: dismissedCount
    };
}
//# sourceMappingURL=moderationService.js.map