import { useQuery } from '@tanstack/react-query';
import { searchService } from '@/services/searchService';
import { recordSearchEvent } from '@/observability/telemetry';

const MIN_TYPEAHEAD_LENGTH = 2;

export function useSearchSuggestions(query: string, limit: number = 6) {
  const trimmed = query.trim();
  const enabled = trimmed.length >= MIN_TYPEAHEAD_LENGTH;

  return useQuery({
    queryKey: ['search', 'suggestions', trimmed, limit],
    enabled,
    staleTime: 1000 * 20,
    queryFn: async () => {
      recordSearchEvent({
        name: 'search_suggestions_requested',
        payload: { query: trimmed, limit },
      });
      const data = await searchService.getSuggestions(trimmed, limit);
      recordSearchEvent({
        name: 'search_suggestions_loaded',
        payload: { query: trimmed, count: data.count },
      });
      return data;
    },
  });
}

