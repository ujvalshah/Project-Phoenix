import { Article } from '../models/Article.js';

/**
 * Helper function to calculate tag usage counts from articles
 * CATEGORY PHASE-OUT: Now counts articles by tags array only
 */
export async function calculateTagUsageCounts(tags: any[]): Promise<Map<string, number>> {
  if (!tags || tags.length === 0) {
    return new Map();
  }

  const canonicalNames = tags.map(t => t.canonicalName || (t.rawName || t.name || '').toLowerCase().trim());
  
  // CATEGORY PHASE-OUT: Count by tags array only (case-insensitive matching)
  const usageByNames = await Promise.all(
    canonicalNames.map(async (canonicalName) => {
      if (!canonicalName) return { canonicalName: '', count: 0 };
      
      const count = await Article.countDocuments({
        tags: { $regex: new RegExp(`^${canonicalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      return { canonicalName, count };
    })
  );
  
  const usageCounts = new Map<string, number>();
  
  tags.forEach((tag) => {
    const tagId = tag._id?.toString() || tag.id;
    const canonicalName = tag.canonicalName || (tag.rawName || tag.name || '').toLowerCase().trim();
    
    const countByNames = usageByNames.find(item => item.canonicalName === canonicalName)?.count || 0;
    
    usageCounts.set(tagId, countByNames);
  });
  
  return usageCounts;
}

