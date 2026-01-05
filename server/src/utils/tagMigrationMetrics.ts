/**
 * Tag Migration Metrics Utility
 * Provides metrics about the migration state
 */

import { Article } from '../models/Article.js';
import { Tag } from '../models/Tag.js';
import mongoose from 'mongoose';

export interface TagMigrationMetrics {
  totalArticles: number;
  articlesWithTagIds: number;
  articlesWithTagsOnly: number;
  articlesWithBoth: number;
  articlesWithNeither: number;
  tagIdsOrphaned: number;
  totalTagIds: number;
  totalTags: number;
  completionPercentage: number;
}

export async function getMigrationMetrics(): Promise<TagMigrationMetrics> {
  const [
    totalArticles,
    articlesWithTagIds,
    articlesWithTags,
    articlesWithBoth,
    articlesWithNeither
  ] = await Promise.all([
    Article.countDocuments(),
    Article.countDocuments({ tagIds: { $exists: true, $ne: [] } }),
    Article.countDocuments({ tags: { $exists: true, $ne: [] } }),
    Article.countDocuments({
      $and: [
        { tagIds: { $exists: true, $ne: [] } },
        { tags: { $exists: true, $ne: [] } }
      ]
    }),
    Article.countDocuments({
      $and: [
        { $or: [{ tagIds: { $exists: false } }, { tagIds: [] }] },
        { $or: [{ tags: { $exists: false } }, { tags: [] }] }
      ]
    })
  ]);

  // Check for orphaned tagIds
  const allTagIds = await Article.distinct('tagIds');
  const existingTags = await Tag.find({ _id: { $in: allTagIds.filter(Boolean) } });
  const existingTagIdSet = new Set(
    existingTags.map(t => t._id.toString())
  );
  const orphanedCount = allTagIds.filter(
    id => id && !existingTagIdSet.has(id.toString())
  ).length;

  // Count unique tagIds and tags
  const uniqueTagIds = new Set(
    allTagIds.filter(Boolean).map(id => id.toString())
  );
  const uniqueTags = await Article.distinct('tags');

  const completionPercentage = totalArticles > 0
    ? (articlesWithTagIds / totalArticles) * 100
    : 0;

  return {
    totalArticles,
    articlesWithTagIds,
    articlesWithTagsOnly: articlesWithTags - articlesWithBoth,
    articlesWithBoth,
    articlesWithNeither,
    tagIdsOrphaned: orphanedCount,
    totalTagIds: uniqueTagIds.size,
    totalTags: uniqueTags.filter(Boolean).length,
    completionPercentage: Math.round(completionPercentage * 100) / 100
  };
}

