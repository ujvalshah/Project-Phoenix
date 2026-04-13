import { useQuery } from '@tanstack/react-query';
import { RestAdapter } from '@/services/adapters/RestAdapter';

const adapter = new RestAdapter();

export function usePulseTodayCount() {
  return useQuery({
    queryKey: ['pulse', 'today-count'],
    queryFn: () => adapter.getPulseTodayCount(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
