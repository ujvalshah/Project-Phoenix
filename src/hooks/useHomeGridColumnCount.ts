import { useMemo } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/**
 * Column count aligned with Tailwind `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
 * (md ≥768, lg ≥1024, xl ≥1280).
 */
export function useHomeGridColumnCount(): number {
  const mdUp = useMediaQuery('(min-width: 768px)');
  const lgUp = useMediaQuery('(min-width: 1024px)');
  const xlUp = useMediaQuery('(min-width: 1280px)');

  return useMemo(() => {
    if (xlUp) return 4;
    if (lgUp) return 3;
    if (mdUp) return 2;
    return 1;
  }, [mdUp, lgUp, xlUp]);
}
