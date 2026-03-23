import { useQuery } from '@tanstack/react-query';
import { storageService } from '@/services/storageService';
import { Collection } from '@/types';

/**
 * Fetches the curated set of featured collections for the category toolbar.
 * Uses a long stale time since featured collections rarely change.
 */
export function useFeaturedCollections() {
  return useQuery<Collection[]>({
    queryKey: ['collections', 'featured'],
    queryFn: () => storageService.getFeaturedCollections(),
    staleTime: 1000 * 60, // 1 minute
  });
}
