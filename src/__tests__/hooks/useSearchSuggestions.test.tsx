import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode, ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchSuggestions } from '@/hooks/useSearchSuggestions';

vi.mock('@/services/searchService', () => ({
  searchService: {
    getSuggestions: vi.fn(),
  },
}));

import { searchService } from '@/services/searchService';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('useSearchSuggestions', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => ReactElement;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    vi.clearAllMocks();
  });

  it('does not let stale async response overwrite latest query results', async () => {
    const oldDeferred = createDeferred<any>();
    const latestDeferred = createDeferred<any>();

    vi.mocked(searchService.getSuggestions)
      .mockReturnValueOnce(oldDeferred.promise)
      .mockReturnValueOnce(latestDeferred.promise);

    const { result, rerender } = renderHook(
      ({ q }) => useSearchSuggestions(q, 6, { contentStream: 'standard' }),
      { wrapper, initialProps: { q: 'Icon' } },
    );

    rerender({ q: 'Iconiq' });

    latestDeferred.resolve({
      query: 'Iconiq',
      count: 1,
      suggestions: [
        {
          id: 'latest',
          title: 'Iconiq match',
          excerpt: '',
          publishedAt: '2026-01-01T00:00:00.000Z',
          sourceType: 'link',
          contentStream: 'standard',
        },
      ],
    });

    await waitFor(() => {
      expect(result.current.data?.query).toBe('Iconiq');
      expect(result.current.data?.count).toBe(1);
    });

    // Resolve the older query after the latest request has finished.
    oldDeferred.resolve({
      query: 'Icon',
      count: 1,
      suggestions: [
        {
          id: 'old',
          title: 'Old result',
          excerpt: '',
          publishedAt: '2026-01-01T00:00:00.000Z',
          sourceType: 'link',
          contentStream: 'standard',
        },
      ],
    });

    await waitFor(() => {
      expect(result.current.data?.query).toBe('Iconiq');
    });
  });
});
