import { apiClient } from '@/services/apiClient';

export interface SearchSuggestion {
  id: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  sourceType: string | null;
  contentStream: 'standard' | 'pulse' | 'both';
}

export interface SearchSuggestionsResponse {
  query: string;
  count: number;
  suggestions: SearchSuggestion[];
}

export const searchService = {
  async getSuggestions(query: string, limit: number = 6): Promise<SearchSuggestionsResponse> {
    const q = query.trim();
    if (q.length < 2) {
      return { query: q, count: 0, suggestions: [] };
    }
    const params = new URLSearchParams();
    params.set('q', q);
    params.set('limit', String(limit));
    return apiClient.get<SearchSuggestionsResponse>(
      `/search/suggest?${params.toString()}`,
      undefined,
      'GET:search-suggest',
    );
  },
};

