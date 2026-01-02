import { Article } from '../models/Article.js';

/**
 * Helper function to calculate tag usage counts from articles
 * Counts articles that reference tags by categoryIds (Phase 2) or categories array (fallback)
 */
export async function calculateTagUsageCounts(tags: any[]): Promise<Map<string, number>> {
  if (!tags || tags.length === 0) {
    return new Map();
  }

  const tagIds = tags.map(t => t._id?.toString() || t.id);
  const canonicalNames = tags.map(t => t.canonicalName || (t.rawName || t.name || '').toLowerCase().trim());
  
  // Aggregate usage counts by categoryIds (Phase 2 - most accurate)
  const usageByIds = await Article.aggregate([
    { $match: { categoryIds: { $in: tagIds } } },
    { $unwind: '$categoryIds' },
    { $match: { categoryIds: { $in: tagIds } } },
    { $group: { _id: '$categoryIds', count: { $sum: 1 } } }
  ]);
  
  const usageByIdsMap = new Map(
    usageByIds.map((item: any) => [item._id.toString(), item.count])
  );
  
  // Count by categories array (case-insensitive fallback for legacy articles)
  const usageByNames = await Promise.all(
    canonicalNames.map(async (canonicalName) => {
      if (!canonicalName) return { canonicalName: '', count: 0 };
      
      const count = await Article.countDocuments({
        categories: { $regex: new RegExp(`^${canonicalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      return { canonicalName, count };
    })
  );
  
  const usageByNamesMap = new Map(
    usageByNames.map(item => [item.canonicalName, item.count])
  );
  
  // Combine counts: prefer categoryIds, fallback to categories
  const usageCounts = new Map<string, number>();
  
  tags.forEach((tag) => {
    const tagId = tag._id?.toString() || tag.id;
    const canonicalName = tag.canonicalName || (tag.rawName || tag.name || '').toLowerCase().trim();
    
    const countByIds = usageByIdsMap.get(tagId) || 0;
    const countByNames = usageByNamesMap.get(canonicalName) || 0;
    
    // Use the higher count (in case both methods match)
    const actualUsageCount = Math.max(countByIds, countByNames);
    
    usageCounts.set(tagId, actualUsageCount);
  });
  
  return usageCounts;
}

