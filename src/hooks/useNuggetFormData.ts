import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storageService } from '@/services/storageService';
import type { Collection } from '@/types';

/**
 * React Query hooks for tags and collections used in the CreateNuggetModal.
 *
 * Features:
 * - Cached data to prevent refetch on every modal open
 * - Optimistic updates for instant feedback
 * - Automatic cache invalidation
 * - Stale-while-revalidate pattern
 */

// Query Keys
export const nuggetFormKeys = {
  all: ['nugget-form'] as const,
  tags: () => [...nuggetFormKeys.all, 'tags'] as const,
  collections: (type?: 'public' | 'private') =>
    [...nuggetFormKeys.all, 'collections', type || 'all'] as const,
};

/**
 * Hook to get all available tags (categories).
 * Cached for 5 minutes to prevent refetch on every modal open.
 */
export function useTags() {
  return useQuery({
    queryKey: nuggetFormKeys.tags(),
    queryFn: async () => {
      const tags = await storageService.getCategories();
      // Filter out any non-string or empty tag values
      return (tags || []).filter(
        (tag): tag is string => typeof tag === 'string' && tag.trim() !== ''
      );
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - prevents refetch on modal open
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch when user switches tabs
  });
}

/**
 * Hook to create a new tag.
 * Uses optimistic updates for instant feedback.
 */
export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagName: string) => {
      await storageService.addCategory(tagName);
      return tagName;
    },

    onMutate: async (newTag) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: nuggetFormKeys.tags() });

      // Snapshot previous value
      const previousTags = queryClient.getQueryData<string[]>(
        nuggetFormKeys.tags()
      );

      // Optimistically update - add the new tag and sort
      queryClient.setQueryData<string[]>(nuggetFormKeys.tags(), (old = []) => {
        if (old.some((t) => t.toLowerCase() === newTag.toLowerCase())) {
          return old; // Already exists, don't add
        }
        return [...old, newTag].sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
      });

      return { previousTags };
    },

    onError: (_err, _newTag, context) => {
      // Rollback on error
      if (context?.previousTags) {
        queryClient.setQueryData(nuggetFormKeys.tags(), context.previousTags);
      }
    },

    // No need to invalidate - optimistic update is sufficient
    // If we need to ensure consistency, uncomment below:
    // onSettled: () => {
    //   queryClient.invalidateQueries({ queryKey: nuggetFormKeys.tags() });
    // },
  });
}

/**
 * Hook to get all available collections.
 * Can filter by type (public/private).
 * Cached for 5 minutes to prevent refetch on every modal open.
 */
export function useCollections(type?: 'public' | 'private') {
  return useQuery({
    queryKey: nuggetFormKeys.collections(type),
    queryFn: async () => {
      const result = await storageService.getCollections(
        type ? { type } : undefined
      );
      // Handle union type: Collection[] | { data: Collection[], count: number }
      const collections: Collection[] = Array.isArray(result)
        ? result
        : result?.data ?? [];
      return collections;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to get all collections (both public and private).
 */
export function useAllCollections() {
  return useQuery({
    queryKey: nuggetFormKeys.collections(),
    queryFn: async () => {
      const result = await storageService.getCollections();
      const collections: Collection[] = Array.isArray(result)
        ? result
        : result?.data ?? [];
      return collections;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to create a new collection.
 * Uses optimistic updates for instant feedback.
 */
export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      description,
      creatorId,
      type,
    }: {
      name: string;
      description: string;
      creatorId: string;
      type: 'public' | 'private';
    }) => {
      return await storageService.createCollection(
        name,
        description,
        creatorId,
        type
      );
    },

    onMutate: async ({ name, type, creatorId }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: nuggetFormKeys.collections(type),
      });
      await queryClient.cancelQueries({
        queryKey: nuggetFormKeys.collections(),
      });

      // Snapshot previous values
      const previousCollections = queryClient.getQueryData<Collection[]>(
        nuggetFormKeys.collections(type)
      );
      const previousAllCollections = queryClient.getQueryData<Collection[]>(
        nuggetFormKeys.collections()
      );

      // Create optimistic collection (will be replaced with actual data on success)
      const optimisticCollection: Collection = {
        id: `optimistic-${Date.now()}`,
        name,
        description: '',
        type,
        creatorId,
        createdAt: new Date().toISOString(),
        followersCount: 0,
        entries: [],
      };

      // Optimistically update type-specific cache
      queryClient.setQueryData<Collection[]>(
        nuggetFormKeys.collections(type),
        (old = []) => [...old, optimisticCollection]
      );

      // Optimistically update all collections cache
      queryClient.setQueryData<Collection[]>(
        nuggetFormKeys.collections(),
        (old = []) => [...old, optimisticCollection]
      );

      return { previousCollections, previousAllCollections, optimisticId: optimisticCollection.id };
    },

    onError: (_err, { type }, context) => {
      // Rollback on error
      if (context?.previousCollections) {
        queryClient.setQueryData(
          nuggetFormKeys.collections(type),
          context.previousCollections
        );
      }
      if (context?.previousAllCollections) {
        queryClient.setQueryData(
          nuggetFormKeys.collections(),
          context.previousAllCollections
        );
      }
    },

    onSuccess: (newCollection, { type }, context) => {
      // Replace optimistic collection with actual collection
      queryClient.setQueryData<Collection[]>(
        nuggetFormKeys.collections(type),
        (old = []) =>
          old.map((c) =>
            c.id === context?.optimisticId ? newCollection : c
          )
      );

      queryClient.setQueryData<Collection[]>(
        nuggetFormKeys.collections(),
        (old = []) =>
          old.map((c) =>
            c.id === context?.optimisticId ? newCollection : c
          )
      );
    },
  });
}

/**
 * Prefetch tags and collections data.
 * Call this when you know the modal will be opened soon.
 */
export function usePrefetchNuggetFormData() {
  const queryClient = useQueryClient();

  return {
    prefetchTags: () => {
      queryClient.prefetchQuery({
        queryKey: nuggetFormKeys.tags(),
        queryFn: async () => {
          const tags = await storageService.getCategories();
          return (tags || []).filter(
            (tag): tag is string => typeof tag === 'string' && tag.trim() !== ''
          );
        },
        staleTime: 1000 * 60 * 5,
      });
    },
    prefetchCollections: (type?: 'public' | 'private') => {
      queryClient.prefetchQuery({
        queryKey: nuggetFormKeys.collections(type),
        queryFn: async () => {
          const result = await storageService.getCollections(
            type ? { type } : undefined
          );
          return Array.isArray(result) ? result : result?.data ?? [];
        },
        staleTime: 1000 * 60 * 5,
      });
    },
  };
}

// Export convenience object with all hooks
export const useNuggetFormHooks = {
  useTags,
  useCreateTag,
  useCollections,
  useAllCollections,
  useCreateCollection,
  usePrefetchNuggetFormData,
};
