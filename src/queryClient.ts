
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data remains fresh for 5 minutes. Prevents immediate refetching on window focus.
      staleTime: 1000 * 60 * 5, 
      gcTime: 1000 * 60 * 30, // Keep unused data in cache for 30 mins
      retry: 1,
      refetchOnWindowFocus: false, // Disabled for better UX/Performance in this specific app type
    },
  },
});
