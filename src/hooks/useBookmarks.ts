import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { bookmarkService } from '@/services/bookmarkService';
import type {
  BookmarkStatus,
  BookmarkFilters,
  BookmarksResponse,
  BookmarkCollection,
  BookmarkItemType,
  ToggleBookmarkResponse
} from '@/services/bookmarkService';

/**
 * React Query hooks for bookmark operations.
 *
 * Features:
 * - Optimistic updates for instant feedback
 * - Automatic cache invalidation
 * - Error rollback
 * - Infinite scroll support
 */

// Query Keys
export const bookmarkKeys = {
  all: ['bookmarks'] as const,
  status: (itemId: string, itemType?: BookmarkItemType) =>
    [...bookmarkKeys.all, 'status', itemId, itemType || 'nugget'] as const,
  batchStatus: (itemIds: string[]) =>
    [...bookmarkKeys.all, 'batch-status', itemIds.sort().join(',')] as const,
  list: (filters?: BookmarkFilters) =>
    [...bookmarkKeys.all, 'list', filters || {}] as const,
  infinite: (filters?: Omit<BookmarkFilters, 'page'>) =>
    [...bookmarkKeys.all, 'infinite', filters || {}] as const,
  collections: ['bookmark-collections'] as const,
  collection: (id: string) => [...bookmarkKeys.collections, id] as const
};

/**
 * Hook to get bookmark status for a specific item.
 */
export function useBookmarkStatus(itemId: string, itemType: BookmarkItemType = 'nugget') {
  return useQuery({
    queryKey: bookmarkKeys.status(itemId, itemType),
    queryFn: () => bookmarkService.getStatus(itemId, itemType),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!itemId
  });
}

/**
 * Hook to get batch bookmark status for multiple items.
 * More efficient than calling useBookmarkStatus for each item.
 */
export function useBatchBookmarkStatus(
  itemIds: string[],
  itemType: BookmarkItemType = 'nugget'
) {
  return useQuery({
    queryKey: bookmarkKeys.batchStatus(itemIds),
    queryFn: () => bookmarkService.getBatchStatus(itemIds, itemType),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: itemIds.length > 0
  });
}

/**
 * Hook to toggle bookmark with optimistic update.
 */
export function useToggleBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemId,
      itemType = 'nugget'
    }: {
      itemId: string;
      itemType?: BookmarkItemType;
    }) => bookmarkService.toggle(itemId, itemType),

    onMutate: async ({ itemId, itemType = 'nugget' }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: bookmarkKeys.status(itemId, itemType)
      });

      // Snapshot previous value
      const previousStatus = queryClient.getQueryData<BookmarkStatus>(
        bookmarkKeys.status(itemId, itemType)
      );

      // Optimistically update
      queryClient.setQueryData<BookmarkStatus>(
        bookmarkKeys.status(itemId, itemType),
        (old) => ({
          isBookmarked: !old?.isBookmarked,
          bookmarkId: old?.isBookmarked ? undefined : 'optimistic-id',
          collectionIds: old?.collectionIds || []
        })
      );

      return { previousStatus, itemId, itemType };
    },

    onError: (err, { itemId, itemType = 'nugget' }, context) => {
      // Rollback on error
      if (context?.previousStatus) {
        queryClient.setQueryData(
          bookmarkKeys.status(itemId, itemType),
          context.previousStatus
        );
      }
    },

    onSuccess: (data, { itemId, itemType = 'nugget' }) => {
      // Update with actual server response
      queryClient.setQueryData<BookmarkStatus>(
        bookmarkKeys.status(itemId, itemType),
        {
          isBookmarked: data.bookmarked,
          bookmarkId: data.bookmarkId,
          collectionIds: data.defaultCollectionId ? [data.defaultCollectionId] : []
        }
      );

      // Invalidate bookmark lists
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
    }
  });
}

/**
 * Hook to get user's bookmarks with pagination.
 */
export function useBookmarks(filters?: BookmarkFilters) {
  return useQuery({
    queryKey: bookmarkKeys.list(filters),
    queryFn: () => bookmarkService.getBookmarks(filters),
    staleTime: 1000 * 60 * 2, // 2 minutes
    placeholderData: (previousData) => previousData
  });
}

/**
 * Hook for infinite scroll bookmark list.
 */
export function useInfiniteBookmarks(filters?: Omit<BookmarkFilters, 'page'>) {
  return useInfiniteQuery({
    queryKey: bookmarkKeys.infinite(filters),
    queryFn: ({ pageParam = 1 }) =>
      bookmarkService.getBookmarks({ ...filters, page: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 1000 * 60 * 2 // 2 minutes
  });
}

/**
 * Hook to get user's bookmark collections.
 */
export function useBookmarkCollections() {
  return useQuery({
    queryKey: bookmarkKeys.collections,
    queryFn: () => bookmarkService.getCollections(),
    staleTime: 1000 * 60 * 10 // 10 minutes
  });
}

/**
 * Hook to get a specific bookmark collection.
 */
export function useBookmarkCollection(collectionId: string) {
  return useQuery({
    queryKey: bookmarkKeys.collection(collectionId),
    queryFn: () => bookmarkService.getCollectionById(collectionId),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!collectionId
  });
}

/**
 * Hook to create a new bookmark collection.
 */
export function useCreateBookmarkCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      name,
      description,
      order
    }: {
      name: string;
      description?: string;
      order?: number;
    }) => bookmarkService.createCollection(name, description, order),

    onSuccess: () => {
      // Invalidate collections list
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.collections });
    }
  });
}

/**
 * Hook to update a bookmark collection.
 */
export function useUpdateBookmarkCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      collectionId,
      updates
    }: {
      collectionId: string;
      updates: { name?: string; description?: string; order?: number };
    }) => bookmarkService.updateCollection(collectionId, updates),

    onSuccess: (data, { collectionId }) => {
      // Update the specific collection in cache
      queryClient.setQueryData(bookmarkKeys.collection(collectionId), data);

      // Invalidate collections list
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.collections });
    }
  });
}

/**
 * Hook to delete a bookmark collection.
 */
export function useDeleteBookmarkCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (collectionId: string) =>
      bookmarkService.deleteCollection(collectionId),

    onSuccess: (_, collectionId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: bookmarkKeys.collection(collectionId) });

      // Invalidate collections list
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.collections });

      // Invalidate bookmark lists (may affect displayed bookmarks)
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
    }
  });
}

/**
 * Hook to assign a bookmark to collections.
 */
export function useAssignBookmarkToCollections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bookmarkId,
      collectionIds
    }: {
      bookmarkId: string;
      collectionIds: string[];
    }) => bookmarkService.assignToCollections(bookmarkId, collectionIds),

    onSuccess: () => {
      // Invalidate all bookmark-related queries
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.collections });
    }
  });
}

/**
 * Hook to remove a bookmark from a collection.
 */
export function useRemoveBookmarkFromCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      collectionId,
      bookmarkId
    }: {
      collectionId: string;
      bookmarkId: string;
    }) => bookmarkService.removeFromCollection(collectionId, bookmarkId),

    onSuccess: (_, { collectionId }) => {
      // Invalidate bookmark lists
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });

      // Invalidate the specific collection
      queryClient.invalidateQueries({
        queryKey: bookmarkKeys.collection(collectionId)
      });

      // Invalidate collections list (to update counts)
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.collections });
    }
  });
}

/**
 * Hook to reorder collections (drag and drop).
 */
export function useReorderBookmarkCollections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (collectionIds: string[]) =>
      bookmarkService.reorderCollections(collectionIds),

    onMutate: async (collectionIds) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: bookmarkKeys.collections });

      // Snapshot previous value
      const previousCollections =
        queryClient.getQueryData<BookmarkCollection[]>(bookmarkKeys.collections);

      // Optimistically update order
      if (previousCollections) {
        const reorderedCollections = collectionIds
          .map((id, index) => {
            const collection = previousCollections.find((c) => c.id === id);
            if (collection) {
              return { ...collection, order: index };
            }
            return null;
          })
          .filter((c): c is BookmarkCollection => c !== null);

        queryClient.setQueryData(bookmarkKeys.collections, reorderedCollections);
      }

      return { previousCollections };
    },

    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousCollections) {
        queryClient.setQueryData(
          bookmarkKeys.collections,
          context.previousCollections
        );
      }
    },

    onSuccess: (data) => {
      // Update with server response
      queryClient.setQueryData(bookmarkKeys.collections, data);
    }
  });
}

/**
 * Hook to delete a bookmark completely.
 */
export function useDeleteBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookmarkId: string) => bookmarkService.delete(bookmarkId),

    onSuccess: () => {
      // Invalidate all bookmark queries
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });

      // Invalidate collections (to update counts)
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.collections });
    }
  });
}

/**
 * Hook for batch toggle operations.
 */
export function useBatchToggleBookmarks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemIds,
      action,
      itemType = 'nugget'
    }: {
      itemIds: string[];
      action: 'bookmark' | 'unbookmark';
      itemType?: BookmarkItemType;
    }) => bookmarkService.batchToggle(itemIds, action, itemType),

    onSuccess: () => {
      // Invalidate all bookmark queries
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
    }
  });
}

/**
 * Hook for searching bookmarks with debounced query.
 */
export function useSearchBookmarks(
  query: string,
  filters?: Omit<BookmarkFilters, 'q'>
) {
  return useQuery({
    queryKey: [...bookmarkKeys.list({ ...filters, q: query })],
    queryFn: () => bookmarkService.getBookmarks({ ...filters, q: query }),
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: query.length > 0
  });
}

// Export a convenience object with all hooks
export const useBookmarkHooks = {
  useBookmarkStatus,
  useBatchBookmarkStatus,
  useToggleBookmark,
  useBookmarks,
  useInfiniteBookmarks,
  useBookmarkCollections,
  useBookmarkCollection,
  useCreateBookmarkCollection,
  useUpdateBookmarkCollection,
  useDeleteBookmarkCollection,
  useAssignBookmarkToCollections,
  useRemoveBookmarkFromCollection,
  useReorderBookmarkCollections,
  useDeleteBookmark,
  useBatchToggleBookmarks,
  useSearchBookmarks
};
