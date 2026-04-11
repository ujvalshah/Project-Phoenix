import { Article } from '../models/Article.js';

/**
 * Calculate tag usage counts from articles via tagIds aggregation.
 *
 * Takes an array of Tag documents (lean or Mongoose) and returns a Map
 * of tagId (string) → article count. Uses a single $unwind aggregation
 * instead of N individual regex queries on the legacy tags[] field.
 */
export async function calculateTagUsageCounts(tags: { _id: { toString(): string }; id?: string }[]): Promise<Map<string, number>> {
  if (!tags || tags.length === 0) {
    return new Map();
  }

  const tagIds = tags.map(t => t._id ?? t.id);

  const usageAgg: { _id: unknown; count: number }[] = await Article.aggregate([
    { $match: { tagIds: { $in: tagIds } } },
    { $unwind: '$tagIds' },
    { $match: { tagIds: { $in: tagIds } } },
    { $group: { _id: '$tagIds', count: { $sum: 1 } } },
  ]);

  const usageCounts = new Map<string, number>();
  for (const row of usageAgg) {
    usageCounts.set(row._id!.toString(), row.count);
  }

  return usageCounts;
}
