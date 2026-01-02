import { Collection } from '../models/Collection.js';
import { createSearchRegex } from './escapeRegExp.js';

/**
 * Shared query builder for collection queries
 * Single source of truth for collection filtering logic
 * 
 * Ensures Community Collections page and Admin Collections page use identical query conditions
 */
export interface CollectionQueryFilters {
  type?: 'public' | 'private';
  creatorId?: string;
  searchQuery?: string;
}

/**
 * Build base query for community collections (public only, not deleted)
 * This is the single source of truth for what counts as a "community collection"
 */
export function getCommunityCollectionsBaseQuery(filters: CollectionQueryFilters = {}): any {
  const query: any = {};
  
  // Default: only public collections for community view
  // Admin can override by not specifying type
  if (filters.type !== undefined) {
    query.type = filters.type;
  } else {
    // Default to public for community collections
    query.type = 'public';
  }
  
  // Filter by creator if specified
  if (filters.creatorId) {
    query.creatorId = filters.creatorId;
  }
  
  // Note: Collections don't have deletedAt or status fields currently
  // If soft delete is added later, add: query.deletedAt = { $exists: false }
  
  return query;
}

/**
 * Get count of community collections matching filters
 * Uses the same query logic as getCommunityCollectionsBaseQuery
 */
export async function getCommunityCollectionsCount(filters: CollectionQueryFilters = {}): Promise<number> {
  const baseQuery = getCommunityCollectionsBaseQuery(filters);
  
  // Build final query with search if provided (same logic as getCommunityCollections)
  const finalQuery: any = { ...baseQuery };
  
  // SECURITY: createSearchRegex escapes user input to prevent ReDoS
  if (filters.searchQuery) {
    const searchRegex = createSearchRegex(filters.searchQuery);
    finalQuery.$or = [
      { name: searchRegex },
      { description: searchRegex }
    ];
  }
  
  return await Collection.countDocuments(finalQuery);
}

/**
 * Get community collections with optional search
 */
export async function getCommunityCollections(
  filters: CollectionQueryFilters = {},
  options: { sort?: Record<string, 1 | -1>; limit?: number; skip?: number } = {}
): Promise<any[]> {
  const baseQuery = getCommunityCollectionsBaseQuery(filters);
  
  // Build final query with search if provided
  const finalQuery: any = { ...baseQuery };
  
  // SECURITY: createSearchRegex escapes user input to prevent ReDoS
  if (filters.searchQuery) {
    const searchRegex = createSearchRegex(filters.searchQuery);
    finalQuery.$or = [
      { name: searchRegex },
      { description: searchRegex }
    ];
  }
  
  let queryBuilder = Collection.find(finalQuery);
  
  // Apply sorting
  if (options.sort) {
    queryBuilder = queryBuilder.sort(options.sort);
  } else {
    // Default sort by createdAt descending
    queryBuilder = queryBuilder.sort({ createdAt: -1 });
  }
  
  // Apply pagination
  if (options.skip !== undefined) {
    queryBuilder = queryBuilder.skip(options.skip);
  }
  if (options.limit !== undefined) {
    queryBuilder = queryBuilder.limit(options.limit);
  }
  
  return await queryBuilder.exec();
}

