import { apiClient } from './apiClient';
import { Article } from '@/types';

/**
 * Bookmark Service
 *
 * Frontend service for bookmark operations.
 * Communicates with /api/bookmarks and /api/bookmark-collections endpoints.
 *
 * HYBRID APPROACH:
 * - localStorage for instant initial state (no API call on mount)
 * - Server is source of truth (synced on toggle)
 * - Avoids N+1 API calls while maintaining state across sessions
 */

// ============================================================================
// LOCAL STORAGE HELPERS
// ============================================================================

const BOOKMARKS_STORAGE_KEY = 'nuggets_bookmarks_v1';

interface LocalBookmarkData {
  itemIds: string[];
  updatedAt: number;
}

/**
 * Get bookmarked item IDs from localStorage
 */
function getLocalBookmarks(): Set<string> {
  try {
    const stored = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (stored) {
      const data: LocalBookmarkData = JSON.parse(stored);
      return new Set(data.itemIds);
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
}

/**
 * Save bookmarked item IDs to localStorage
 */
function saveLocalBookmarks(itemIds: Set<string>): void {
  try {
    const data: LocalBookmarkData = {
      itemIds: Array.from(itemIds),
      updatedAt: Date.now()
    };
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

/**
 * Add an item to local bookmarks
 */
function addLocalBookmark(itemId: string): void {
  const bookmarks = getLocalBookmarks();
  bookmarks.add(itemId);
  saveLocalBookmarks(bookmarks);
}

/**
 * Remove an item from local bookmarks
 */
function removeLocalBookmark(itemId: string): void {
  const bookmarks = getLocalBookmarks();
  bookmarks.delete(itemId);
  saveLocalBookmarks(bookmarks);
}

/**
 * Check if an item is bookmarked locally (for instant initial state)
 */
function isLocallyBookmarked(itemId: string): boolean {
  return getLocalBookmarks().has(itemId);
}

// ============================================================================

// Types
export type BookmarkItemType = 'nugget' | 'article' | 'video' | 'course';

export interface BookmarkStatus {
  isBookmarked: boolean;
  bookmarkId?: string;
  collectionIds: string[];
}

export interface ToggleBookmarkResponse {
  bookmarked: boolean;
  bookmarkId?: string;
  defaultCollectionId?: string;
  message: string;
}

export interface Bookmark {
  id: string;
  itemId: string;
  itemType: BookmarkItemType;
  createdAt: string;
  lastAccessedAt: string;
  notes?: string;
  collectionIds: string[];
  article: Article | null;
}

export interface BookmarksResponse {
  data: Bookmark[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export interface BookmarkCollection {
  id: string;
  name: string;
  description?: string;
  order: number;
  isDefault: boolean;
  bookmarkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkCollectionsResponse {
  collections: BookmarkCollection[];
}

export interface BatchStatusResponse {
  statuses: Array<{
    itemId: string;
    isBookmarked: boolean;
    bookmarkId: string | null;
  }>;
}

export interface BatchToggleResult {
  results: Array<{
    itemId: string;
    success: boolean;
    error?: string;
  }>;
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

export interface BookmarkFilters {
  collectionId?: string;
  itemType?: BookmarkItemType;
  page?: number;
  limit?: number;
  sort?: 'createdAt' | 'lastAccessedAt';
  order?: 'asc' | 'desc';
  q?: string;
}

// Bookmark API Methods

/**
 * Toggle bookmark status for an item.
 * Syncs with localStorage after successful API response.
 */
export async function toggleBookmark(
  itemId: string,
  itemType: BookmarkItemType = 'nugget'
): Promise<ToggleBookmarkResponse> {
  const response = await apiClient.post<ToggleBookmarkResponse>('/bookmarks/toggle', {
    itemId,
    itemType
  });

  // Sync localStorage with server response
  if (response.bookmarked) {
    addLocalBookmark(itemId);
  } else {
    removeLocalBookmark(itemId);
  }

  return response;
}

/**
 * Get bookmark status for a specific item.
 */
export async function getBookmarkStatus(
  itemId: string,
  itemType: BookmarkItemType = 'nugget'
): Promise<BookmarkStatus> {
  return apiClient.get<BookmarkStatus>(
    `/bookmarks/status/${itemId}?itemType=${itemType}`
  );
}

/**
 * Get batch bookmark status for multiple items.
 * More efficient than calling getBookmarkStatus for each item.
 */
export async function getBatchBookmarkStatus(
  itemIds: string[],
  itemType: BookmarkItemType = 'nugget'
): Promise<BatchStatusResponse> {
  return apiClient.post<BatchStatusResponse>('/bookmarks/status/batch', {
    itemIds,
    itemType
  });
}

/**
 * Get user's bookmarks with optional filtering.
 */
export async function getBookmarks(
  filters?: BookmarkFilters
): Promise<BookmarksResponse> {
  const params = new URLSearchParams();

  if (filters?.collectionId) params.append('collectionId', filters.collectionId);
  if (filters?.itemType) params.append('itemType', filters.itemType);
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.sort) params.append('sort', filters.sort);
  if (filters?.order) params.append('order', filters.order);
  if (filters?.q) params.append('q', filters.q);

  const queryString = params.toString();
  const url = queryString ? `/bookmarks?${queryString}` : '/bookmarks';

  return apiClient.get<BookmarksResponse>(url);
}

/**
 * Assign a bookmark to specific collections.
 */
export async function assignBookmarkToCollections(
  bookmarkId: string,
  collectionIds: string[]
): Promise<void> {
  await apiClient.post('/bookmarks/assign', {
    bookmarkId,
    collectionIds
  });
}

/**
 * Delete a specific bookmark.
 */
export async function deleteBookmark(bookmarkId: string): Promise<void> {
  await apiClient.delete(`/bookmarks/${bookmarkId}`);
}

/**
 * Batch toggle bookmarks.
 */
export async function batchToggleBookmarks(
  itemIds: string[],
  action: 'bookmark' | 'unbookmark',
  itemType: BookmarkItemType = 'nugget'
): Promise<BatchToggleResult> {
  return apiClient.post<BatchToggleResult>('/bookmarks/batch-toggle', {
    itemIds,
    action,
    itemType
  });
}

// Collection API Methods

/**
 * Get all user's bookmark collections.
 */
export async function getBookmarkCollections(): Promise<BookmarkCollection[]> {
  const response = await apiClient.get<BookmarkCollectionsResponse>('/bookmark-collections');
  return response.collections;
}

/**
 * Get a specific bookmark collection by ID.
 */
export async function getBookmarkCollectionById(
  collectionId: string
): Promise<BookmarkCollection> {
  return apiClient.get<BookmarkCollection>(`/bookmark-collections/${collectionId}`);
}

/**
 * Create a new bookmark collection.
 */
export async function createBookmarkCollection(
  name: string,
  description?: string,
  order?: number
): Promise<BookmarkCollection> {
  return apiClient.post<BookmarkCollection>('/bookmark-collections', {
    name,
    description,
    order
  });
}

/**
 * Update a bookmark collection.
 */
export async function updateBookmarkCollection(
  collectionId: string,
  updates: { name?: string; description?: string; order?: number }
): Promise<BookmarkCollection> {
  return apiClient.put<BookmarkCollection>(`/bookmark-collections/${collectionId}`, updates);
}

/**
 * Delete a bookmark collection.
 */
export async function deleteBookmarkCollection(collectionId: string): Promise<void> {
  await apiClient.delete(`/bookmark-collections/${collectionId}`);
}

/**
 * Reorder bookmark collections (drag and drop support).
 */
export async function reorderBookmarkCollections(
  collectionIds: string[]
): Promise<BookmarkCollection[]> {
  const response = await apiClient.put<BookmarkCollectionsResponse>(
    '/bookmark-collections/reorder',
    { collectionIds }
  );
  return response.collections;
}

/**
 * Remove a bookmark from a specific collection.
 */
export async function removeBookmarkFromCollection(
  collectionId: string,
  bookmarkId: string
): Promise<void> {
  await apiClient.delete(`/bookmark-collections/${collectionId}/bookmarks/${bookmarkId}`);
}

// Export all methods as a namespace for convenience
export const bookmarkService = {
  // Bookmarks
  toggle: toggleBookmark,
  getStatus: getBookmarkStatus,
  getBatchStatus: getBatchBookmarkStatus,
  getBookmarks,
  assignToCollections: assignBookmarkToCollections,
  delete: deleteBookmark,
  batchToggle: batchToggleBookmarks,

  // Collections
  getCollections: getBookmarkCollections,
  getCollectionById: getBookmarkCollectionById,
  createCollection: createBookmarkCollection,
  updateCollection: updateBookmarkCollection,
  deleteCollection: deleteBookmarkCollection,
  reorderCollections: reorderBookmarkCollections,
  removeFromCollection: removeBookmarkFromCollection,

  // localStorage helpers (for instant initial state)
  isLocallyBookmarked,
  getLocalBookmarks: () => Array.from(getLocalBookmarks())
};
