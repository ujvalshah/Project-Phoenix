import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RestAdapter } from '@/services/adapters/RestAdapter';
import { useAuthSelector } from '@/context/AuthContext';

const adapter = new RestAdapter();

const FEED_BADGE_KEY = ['feeds', 'unseen-counts'] as const;
type FeedBadgeKey = 'home' | 'market-pulse';

/**
 * Count of Market Pulse nuggets the current user has not seen yet.
 * Authenticated-only — returns undefined for anonymous users so callers
 * can suppress the badge entirely.
 */
export function useUnseenFeedCounts() {
  const isAuthenticated = useAuthSelector((a) => a.isAuthenticated);
  return useQuery({
    queryKey: FEED_BADGE_KEY,
    queryFn: () => adapter.getUnseenFeedCounts(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

/** Backward-compatible selectors that read from the shared feed badge query. */
export function usePulseUnseenCount() {
  const { data, ...rest } = useUnseenFeedCounts();
  return { data: data?.marketPulse, ...rest };
}

export function useStandardUnseenCount() {
  const { data, ...rest } = useUnseenFeedCounts();
  return { data: data?.home, ...rest };
}

function useMarkSeen(run: (feed: FeedBadgeKey) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (feed: FeedBadgeKey) => run(feed),
    onMutate: async (feed) => {
      await qc.cancelQueries({ queryKey: FEED_BADGE_KEY });
      const prev = qc.getQueryData<{ home: number; marketPulse: number }>(FEED_BADGE_KEY);
      if (prev) {
        qc.setQueryData(FEED_BADGE_KEY, {
          ...prev,
          ...(feed === 'home' ? { home: 0 } : { marketPulse: 0 }),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(FEED_BADGE_KEY, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: FEED_BADGE_KEY });
    },
  });
}

export function useMarkFeedSeen() {
  return useMarkSeen((feed) => adapter.markFeedSeen(feed));
}
