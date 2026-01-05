/**
 * Tag Helper Utilities
 * Handles dual-write logic for tags[] and tagIds[] during migration
 */

import { Tag, canonicalize } from '../models/Tag.js';
import { Article } from '../models/Article.js';
import mongoose from 'mongoose';

/**
 * Resolve tag names to Tag documents (find or create)
 * Returns array of Tag ObjectIds
 */
export async function resolveTagNamesToIds(tagNames: string[]): Promise<mongoose.Types.ObjectId[]> {
  if (!tagNames || tagNames.length === 0) {
    return [];
  }

  const tagIds: mongoose.Types.ObjectId[] = [];
  const seenCanonical = new Set<string>();

  for (const tagName of tagNames) {
    if (!tagName || typeof tagName !== 'string' || !tagName.trim()) {
      continue;
    }

    const canonical = canonicalize(tagName);
    
    // Skip duplicates (case-insensitive)
    if (seenCanonical.has(canonical)) {
      continue;
    }
    seenCanonical.add(canonical);

    // Find or create tag
    const tag = await Tag.fromName(tagName);
    tagIds.push(tag._id);
  }

  return tagIds;
}

/**
 * Resolve tagIds to tag names
 * Returns array of rawName strings
 * Handles both ObjectId and string inputs
 */
export async function resolveTagIdsToNames(tagIds: (mongoose.Types.ObjectId | string)[]): Promise<string[]> {
  if (!tagIds || tagIds.length === 0) {
    return [];
  }

  // Convert all to ObjectId for query
  const objectIds = tagIds.map(id => 
    typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
  );

  const tags = await Tag.find({ _id: { $in: objectIds } });
  
  // Create a map for efficient lookup
  const tagMap = new Map(
    tags.map(t => [t._id.toString(), t.rawName])
  );
  
  // Return names in the same order as input tagIds
  return tagIds.map(id => {
    const idStr = typeof id === 'string' ? id : id.toString();
    return tagMap.get(idStr) || '';
  });
}

/**
 * Dual-write: Update both tags[] and tagIds[] on an article
 * Used during Phase 1-2 migration
 */
export async function updateArticleTagsDualWrite(
  articleId: string,
  tagNames: string[]
): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Resolve tag names to IDs
    const tagIds = await resolveTagNamesToIds(tagNames);

    // Update both fields atomically
    await Article.findByIdAndUpdate(
      articleId,
      {
        tags: tagNames, // Legacy
        tagIds: tagIds  // New
      },
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Check if feature flags allow tagIds operations
 */
export function isTagIdsEnabled(): boolean {
  return process.env.ENABLE_TAG_IDS === 'true' || process.env.ENABLE_TAG_IDS !== 'false';
}

export function isTagIdsReadEnabled(): boolean {
  return process.env.ENABLE_TAG_IDS_READ === 'true' || isTagIdsEnabled();
}

export function isTagIdsWriteEnabled(): boolean {
  return process.env.ENABLE_TAG_IDS_WRITE === 'true' || isTagIdsEnabled();
}

export function isLegacyTagsDisabled(): boolean {
  return process.env.DISABLE_LEGACY_TAGS === 'true';
}

