import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { RestAdapter } from '@/services/adapters/RestAdapter';
import { useAuthSelector } from '@/context/AuthContext';

const adapter = new RestAdapter();

const PULSE_KEY = ['pulse', 'unseen-count'] as const;
const STANDARD_KEY = ['standard', 'unseen-count'] as const;

/**
 * Count of Market Pulse nuggets the current user has not seen yet.
 * Authenticated-only — returns undefined for anonymous users so callers
 * can suppress the badge entirely.
 */
export function usePulseUnseenCount() {
  const isAuthenticated = useAuthSelector((a) => a.isAuthenticated);
  return useQuery({
    queryKey: PULSE_KEY,
    queryFn: () => adapter.getPulseUnseenCount(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

/** Same as usePulseUnseenCount, but for the Home (standard) feed. */
export function useStandardUnseenCount() {
  const isAuthenticated = useAuthSelector((a) => a.isAuthenticated);
  return useQuery({
    queryKey: STANDARD_KEY,
    queryFn: () => adapter.getStandardUnseenCount(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

function useMarkSeen(queryKey: QueryKey, run: () => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<number>(queryKey);
      qc.setQueryData<number>(queryKey, 0);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(queryKey, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
    },
  });
}

/**
 * Marks the Pulse feed as seen and optimistically clears the badge.
 * Fires when the user actually lands on the Pulse stream.
 */
export function useMarkPulseSeen() {
  return useMarkSeen(PULSE_KEY, () => adapter.markPulseSeen());
}

/** Same as useMarkPulseSeen, but for the Home (standard) feed. */
export function useMarkStandardSeen() {
  return useMarkSeen(STANDARD_KEY, () => adapter.markStandardSeen());
}
