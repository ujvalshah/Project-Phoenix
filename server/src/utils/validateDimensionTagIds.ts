/**
 * Dimension-tag validation for Article create/update.
 *
 * Enforces that an article carries at least one `format` tag from the Tag
 * taxonomy. Domain and sub-topic tags are optional.
 *
 * Used by articlesController.createArticle and updateArticle to prevent
 * dimension coverage from drifting back below 100%.
 */

import mongoose from 'mongoose';
import { Tag } from '../models/Tag.js';

export interface DimensionValidationError {
  path: (string | number)[];
  message: string;
  code: 'custom';
}

export type DimensionValidationResult =
  | { ok: true }
  | { ok: false; errors: DimensionValidationError[] };

/**
 * Validate that the provided tagIds reference at least one active `format`
 * tag. Domain and sub-topic tags are optional.
 *
 * @param tagIds raw tagIds from the request body (after Zod string-array parse)
 */
export async function validateDimensionTagIds(
  tagIds: string[] | undefined | null
): Promise<DimensionValidationResult> {
  const ids = Array.isArray(tagIds) ? tagIds.filter(Boolean) : [];

  if (ids.length === 0) {
    return {
      ok: false,
      errors: [
        {
          path: ['tagIds'],
          message: 'At least one format tag is required',
          code: 'custom',
        },
      ],
    };
  }

  // Reject malformed ObjectIds early — Mongo would coerce/throw later anyway.
  const invalid = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
  if (invalid.length > 0) {
    return {
      ok: false,
      errors: [
        {
          path: ['tagIds'],
          message: `Invalid tagId(s): ${invalid.join(', ')}`,
          code: 'custom',
        },
      ],
    };
  }

  const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));
  const tags = await Tag.find({
    _id: { $in: objectIds },
    status: 'active',
  })
    .select('_id dimension')
    .lean();

  // Filter to only the tags that were found and active. Stale or unknown IDs
  // are silently ignored — articles can accumulate references to tags that were
  // later deprecated or removed, and that should not block edits.
  const hasFormat = tags.some(t => t.dimension === 'format');

  const errors: DimensionValidationError[] = [];
  if (!hasFormat) {
    errors.push({
      path: ['tagIds'],
      message: 'At least one format tag is required (e.g. Podcast, Report / Insights, Documentary)',
      code: 'custom',
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}
