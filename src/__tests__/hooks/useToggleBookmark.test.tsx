import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useToggleBookmark, bookmarkKeys } from '@/hooks/useBookmarks';
import type { BookmarkStatus } from '@/services/bookmarkService';
import { bookmarkService } from '@/services/bookmarkService';

vi.mock('@/services/bookmarkService', async () => {
  const actual = await vi.importActual<typeof import('@/services/bookmarkService')>(
    '@/services/bookmarkService'
  );
  return {
    ...actual,
    bookmarkService: {
      ...actual.bookmarkService,
      toggle: vi.fn()
    }
  };
});

describe('useToggleBookmark', () => {
  beforeEach(() => {
    vi.mocked(bookmarkService.toggle).mockReset();
  });

  it('rolls back via removeQueries when there is no prior status snapshot', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    vi.mocked(bookmarkService.toggle).mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useToggleBookmark(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ itemId: 'item-x', itemType: 'nugget' });
      } catch {
        /* expected */
      }
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<BookmarkStatus>(bookmarkKeys.status('item-x'))).toBeUndefined();
    });
  });

  it('restores previousStatus when toggle fails', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const prior: BookmarkStatus = {
      isBookmarked: false,
      bookmarkId: undefined,
      collectionIds: ['f1']
    };
    queryClient.setQueryData(bookmarkKeys.status('item-y', 'nugget'), prior);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    vi.mocked(bookmarkService.toggle).mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useToggleBookmark(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ itemId: 'item-y', itemType: 'nugget' });
      } catch {
        /* expected */
      }
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<BookmarkStatus>(bookmarkKeys.status('item-y'))).toEqual(prior);
    });
  });
});
