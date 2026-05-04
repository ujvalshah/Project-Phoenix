import { useQuery } from '@tanstack/react-query';
import { storageService } from '@/services/storageService';
import type { TagTaxonomy } from '@/types';

/**
 * Fetches the two-axis tag taxonomy (format + domain tree).
 * Cached aggressively since taxonomy changes infrequently.
 */
export function useTagTaxonomy(enabled = true) {
  return useQuery<TagTaxonomy>({
    queryKey: ['tagTaxonomy'],
    queryFn: () => storageService.getTagTaxonomy(),
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    enabled,
  });
}
