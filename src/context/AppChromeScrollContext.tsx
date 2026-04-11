import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { LAYOUT } from '@/constants/layout';

const SCROLL_THRESHOLD_PX = 50;

interface AppChromeScrollContextValue {
  /** True when window.scrollY exceeds threshold */
  scrollPastThreshold: boolean;
  /** Viewport width &lt; lg (1024px) */
  isViewportNarrow: boolean;
  /** Header primary bar should hide (narrow + scrolled) */
  narrowHeaderHidden: boolean;
}

const AppChromeScrollContext = createContext<AppChromeScrollContextValue | null>(null);

export const AppChromeScrollProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [scrollY, setScrollY] = useState(0);
  const [isViewportNarrow, setIsViewportNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < LAYOUT.LG_BREAKPOINT : false,
  );

  const readScroll = useCallback(() => {
    setScrollY(window.scrollY || window.pageYOffset || 0);
  }, []);

  useEffect(() => {
    readScroll();
    const onResize = () => {
      setIsViewportNarrow(window.innerWidth < LAYOUT.LG_BREAKPOINT);
      readScroll();
    };
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        readScroll();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [readScroll]);

  const value = useMemo<AppChromeScrollContextValue>(() => {
    const scrollPastThreshold = scrollY > SCROLL_THRESHOLD_PX;
    const narrowHeaderHidden = isViewportNarrow && scrollPastThreshold;
    return {
      scrollPastThreshold,
      isViewportNarrow,
      narrowHeaderHidden,
    };
  }, [scrollY, isViewportNarrow]);

  return (
    <AppChromeScrollContext.Provider value={value}>{children}</AppChromeScrollContext.Provider>
  );
};

export function useAppChromeScroll(): AppChromeScrollContextValue {
  const ctx = useContext(AppChromeScrollContext);
  if (!ctx) {
    return {
      scrollPastThreshold: false,
      isViewportNarrow: false,
      narrowHeaderHidden: false,
    };
  }
  return ctx;
}
