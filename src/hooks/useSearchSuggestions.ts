import { useQuery } from '@tanstack/react-query';
import { SearchSuggestionFilters, searchService } from '@/services/searchService';
import { recordSearchEvent } from '@/observability/telemetry';
import { MIN_TYPEAHEAD_SEARCH_LENGTH, normalizeSearchQuery } from '@/utils/searchQuery';

export function useSearchSuggestions(
  query: string,
  limit: number = 6,
  filters?: SearchSuggestionFilters,
) {
  const trimmed = normalizeSearchQuery(query);
  const enabled = trimmed.length >= MIN_TYPEAHEAD_SEARCH_LENGTH;

  return useQuery({
    queryKey: ['search', 'suggestions', trimmed, limit, filters],
    enabled,
    staleTime: 1000 * 20,
    gcTime: 1000 * 60 * 5,
    retry: 0,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      recordSearchEvent({
        name: 'search_suggestions_requested',
        payload: { query: trimmed, limit, filtersApplied: !!filters },
      });
      const data = await searchService.getSuggestions(trimmed, limit, filters);
      recordSearchEvent({
        name: 'search_suggestions_loaded',
        payload: { query: trimmed, count: data.count, filtersApplied: !!filters },
      });
      return data;
    },
  });
}

