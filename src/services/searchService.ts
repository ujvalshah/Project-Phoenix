import { apiClient } from '@/services/apiClient';
import { normalizeSearchQuery } from '@/utils/searchQuery';

export interface SearchSuggestionFilters {
  categories?: string[];
  tag?: string | null;
  collectionId?: string | null;
  favorites?: boolean;
  unread?: boolean;
  formats?: string[];
  timeRange?: string;
  formatTagIds?: string[];
  domainTagIds?: string[];
  subtopicTagIds?: string[];
  contentStream?: 'standard' | 'pulse' | null;
}

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
  async getSuggestions(
    query: string,
    limit: number = 6,
    filters?: SearchSuggestionFilters,
  ): Promise<SearchSuggestionsResponse> {
    const q = normalizeSearchQuery(query);
    if (q.length < 2) {
      return { query: q, count: 0, suggestions: [] };
    }
    const params = new URLSearchParams();
    params.set('q', q);
    params.set('limit', String(limit));
    for (const category of filters?.categories ?? []) {
      if (category) params.append('categories', category);
    }
    if (filters?.tag) params.set('tag', filters.tag);
    if (filters?.collectionId) params.set('collectionId', filters.collectionId);
    if (filters?.favorites) params.set('favorites', '1');
    if (filters?.unread) params.set('unread', '1');
    for (const format of filters?.formats ?? []) {
      if (format) params.append('formats', format);
    }
    if (filters?.timeRange && filters.timeRange !== 'all') params.set('timeRange', filters.timeRange);
    for (const id of filters?.formatTagIds ?? []) {
      if (id) params.append('formatTagIds', id);
    }
    for (const id of filters?.domainTagIds ?? []) {
      if (id) params.append('domainTagIds', id);
    }
    for (const id of filters?.subtopicTagIds ?? []) {
      if (id) params.append('subtopicTagIds', id);
    }
    if (filters?.contentStream) params.set('contentStream', filters.contentStream);
    return apiClient.get<SearchSuggestionsResponse>(
      `/search/suggest?${params.toString()}`,
      undefined,
      'GET:search-suggest',
    );
  },
};

