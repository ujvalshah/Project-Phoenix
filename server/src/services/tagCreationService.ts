/**
 * Shared Tag Creation Service
 * 
 * Single source of truth for tag creation/resolution logic.
 * Used by both:
 * - Admin Tags panel (POST /api/tags)
 * - Nugget Create modal (via addCategory)
 * 
 * Behavior:
 * - Normalizes input (trim, lowercase, normalize spacing)
 * - Looks up existing tag by canonicalName
 * - If tag exists → returns existing tag (never throws conflict)
 * - If multiple variants exist → returns the canonical one
 * - If no tag exists → creates new tag with status: 'active'
 * - Never throws "tag exists" errors - always resolves to existing or creates new
 */

import { Tag } from '../models/Tag.js';
import { normalizeDoc } from '../utils/db.js';

/**
 * Normalize tag name:
 * - Trim whitespace
 * - Normalize spacing (collapse multiple spaces to single)
 * - Convert to lowercase for canonicalName
 * - Preserve original casing for rawName
 */
function normalizeTagName(name: string): { rawName: string; canonicalName: string } {
  // Trim and normalize spacing (collapse multiple spaces)
  const trimmed = name.trim().replace(/\s+/g, ' ');
  
  if (!trimmed) {
    throw new Error('Tag name cannot be empty after normalization');
  }
  
  const canonicalName = trimmed.toLowerCase();
  
  return {
    rawName: trimmed,
    canonicalName
  };
}

/**
 * Create or resolve a tag by name.
 * 
 * This function ensures that:
 * - Creating "Tech", "tech", "TECH" all result in ONE tag
 * - Never throws "tag exists" errors
 * - Always returns a tag (existing or newly created)
 * 
 * @param name - The tag name (will be normalized)
 * @param options - Optional settings
 * @returns The tag document (normalized with id instead of _id)
 */
export async function createOrResolveTag(
  name: string,
  options?: {
    status?: 'active' | 'pending' | 'deprecated';
    isOfficial?: boolean;
  }
): Promise<any> {
  // Normalize input
  const { rawName, canonicalName } = normalizeTagName(name);
  
  // Temporary logging as requested
  console.info('[TagCreate] canonicalized →', { input: name, canonicalName });
  
  // Look up existing tag by canonicalName (case-insensitive)
  // Check all statuses - we'll handle inactive tags by reactivating them
  const existingTag = await Tag.findOne({ canonicalName });
  
  if (existingTag) {
    // Tag exists - return it (never throw conflict)
    // If it's inactive, reactivate it and update rawName if needed
    const oldStatus = existingTag.status;
    if (existingTag.status !== 'active') {
      existingTag.status = options?.status || 'active';
      // Update rawName to match user's exact input (preserve their casing preference)
      if (existingTag.rawName !== rawName) {
        existingTag.rawName = rawName;
      }
      await existingTag.save();
      
      console.info('[TagCreate] Reactivated existing tag', {
        id: existingTag._id.toString(),
        canonicalName,
        oldStatus,
        newStatus: existingTag.status
      });
    } else if (existingTag.rawName !== rawName) {
      // Active tag exists but with different casing - update rawName to preserve user's input
      const oldRawName = existingTag.rawName;
      existingTag.rawName = rawName;
      await existingTag.save();
      
      console.info('[TagCreate] Updated casing of existing tag', {
        id: existingTag._id.toString(),
        canonicalName,
        oldRawName,
        newRawName: rawName
      });
    }
    
    return normalizeDoc(existingTag);
  }
  
  // No tag exists - create new one
  // Handle potential race condition (another request created it between check and create)
  try {
    const newTag = new Tag({
      rawName,
      canonicalName,
      type: 'tag', // Always 'tag' - type field is legacy
      status: options?.status || 'active',
      isOfficial: options?.isOfficial || false,
      usageCount: 0
    });
    
    await newTag.save();
    
    console.info('[TagCreate] Created new tag', {
      id: newTag._id.toString(),
      rawName,
      canonicalName
    });
    
    return normalizeDoc(newTag);
  } catch (error: any) {
    // Handle duplicate key error (race condition - another request created it)
    if (error.code === 11000) {
      // Tag was created by another request - fetch and return it
      const raceConditionTag = await Tag.findOne({ canonicalName });
      if (raceConditionTag) {
        console.info('[TagCreate] Race condition handled - tag created by another request', {
          id: raceConditionTag._id.toString(),
          canonicalName
        });
        return normalizeDoc(raceConditionTag);
      }
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Batch create or resolve multiple tags.
 * Useful for article creation where multiple tags need to be resolved.
 * 
 * @param names - Array of tag names
 * @param options - Optional settings
 * @returns Map of canonicalName -> tag document
 */
export async function createOrResolveTags(
  names: string[],
  options?: {
    status?: 'active' | 'pending' | 'deprecated';
    isOfficial?: boolean;
  }
): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  
  // Process in parallel for better performance
  const promises = names.map(async (name) => {
    try {
      const tag = await createOrResolveTag(name, options);
      const canonicalName = tag.canonicalName || name.toLowerCase().trim();
      results.set(canonicalName, tag);
    } catch (error: any) {
      // Log error but continue with other tags
      console.error('[TagCreate] Error creating tag:', {
        name,
        error: error.message
      });
    }
  });
  
  await Promise.all(promises);
  
  return results;
}

