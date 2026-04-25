import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/services/apiClient';
import { searchService } from '@/services/searchService';

describe('searchService.getSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty payload and skips API for short queries', async () => {
    const data = await searchService.getSuggestions(' i ');

    expect(data).toEqual({ query: 'i', count: 0, suggestions: [] });
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('normalizes query and serializes active filters for parity with final search', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      query: 'Iconiq',
      count: 1,
      suggestions: [
        {
          id: 'a1',
          title: 'State of AI | Iconiq',
          excerpt: '...',
          publishedAt: '2026-01-01T00:00:00.000Z',
          sourceType: 'link',
          contentStream: 'standard',
        },
      ],
    });

    await searchService.getSuggestions('  Iconiq   ', 6, {
      categories: ['Markets'],
      tag: 'AI',
      collectionId: 'col-1',
      favorites: true,
      unread: true,
      formats: ['link'],
      timeRange: '7d',
      formatTagIds: ['f1'],
      domainTagIds: ['d1'],
      subtopicTagIds: ['s1'],
      contentStream: 'standard',
    });

    const requestUrl = vi.mocked(apiClient.get).mock.calls[0]?.[0];
    expect(requestUrl).toContain('/search/suggest?');
    expect(requestUrl).toContain('q=Iconiq');
    expect(requestUrl).toContain('limit=6');
    expect(requestUrl).toContain('categories=Markets');
    expect(requestUrl).toContain('tag=AI');
    expect(requestUrl).toContain('collectionId=col-1');
    expect(requestUrl).toContain('favorites=1');
    expect(requestUrl).toContain('unread=1');
    expect(requestUrl).toContain('formats=link');
    expect(requestUrl).toContain('timeRange=7d');
    expect(requestUrl).toContain('formatTagIds=f1');
    expect(requestUrl).toContain('domainTagIds=d1');
    expect(requestUrl).toContain('subtopicTagIds=s1');
    expect(requestUrl).toContain('contentStream=standard');
  });
});
