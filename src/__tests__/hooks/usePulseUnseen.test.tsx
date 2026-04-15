import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const mocks = vi.hoisted(() => ({
  isAuthenticated: false,
  getUnseenFeedCountsMock: vi.fn(),
  markFeedSeenMock: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuthSelector: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: mocks.isAuthenticated }),
}));

vi.mock('@/services/adapters/RestAdapter', () => ({
  RestAdapter: vi.fn().mockImplementation(() => ({
    getUnseenFeedCounts: mocks.getUnseenFeedCountsMock,
    markFeedSeen: mocks.markFeedSeenMock,
  })),
}));

import {
  useMarkFeedSeen,
  usePulseUnseenCount,
  useStandardUnseenCount,
  useUnseenFeedCounts,
} from '@/hooks/usePulseUnseen';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('usePulseUnseen hooks', () => {
  beforeEach(() => {
    mocks.isAuthenticated = false;
    mocks.getUnseenFeedCountsMock.mockReset();
    mocks.markFeedSeenMock.mockReset();
  });

  it('logged-out user does not fetch unseen counts', () => {
    const { result } = renderHook(() => useUnseenFeedCounts(), { wrapper: createWrapper() });
    expect(result.current.data).toBeUndefined();
    expect(mocks.getUnseenFeedCountsMock).not.toHaveBeenCalled();
  });

  it('returns per-feed counts when logged in', async () => {
    mocks.isAuthenticated = true;
    mocks.getUnseenFeedCountsMock.mockResolvedValue({ home: 3, marketPulse: 7 });
    const { result } = renderHook(() => useUnseenFeedCounts(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toEqual({ home: 3, marketPulse: 7 }));
    expect(mocks.getUnseenFeedCountsMock).toHaveBeenCalledTimes(1);
  });

  it('feed-specific selectors return Home and Market Pulse counts', async () => {
    mocks.isAuthenticated = true;
    mocks.getUnseenFeedCountsMock.mockResolvedValue({ home: 1, marketPulse: 4 });
    const { result: home } = renderHook(() => useStandardUnseenCount(), { wrapper: createWrapper() });
    const { result: pulse } = renderHook(() => usePulseUnseenCount(), { wrapper: createWrapper() });

    await waitFor(() => expect(home.current.data).toBe(1));
    await waitFor(() => expect(pulse.current.data).toBe(4));
  });

  it('mark seen mutation targets requested feed', async () => {
    mocks.isAuthenticated = true;
    mocks.getUnseenFeedCountsMock.mockResolvedValue({ home: 2, marketPulse: 5 });
    mocks.markFeedSeenMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useMarkFeedSeen(), { wrapper: createWrapper() });
    result.current.mutate('market-pulse');
    await waitFor(() => expect(mocks.markFeedSeenMock).toHaveBeenCalledWith('market-pulse'));
  });
});
