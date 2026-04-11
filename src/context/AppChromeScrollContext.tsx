import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LAYOUT } from '@/constants/layout';

/** Below this offset from the top, direction-based hide/show applies */
const TOP_REVEAL_PX = 16;
/** Ignore tiny scroll jitter (px per frame) */
const DIRECTION_DELTA_PX = 8;

interface AppChromeScrollContextValue {
  /** True when window.scrollY is past the small top offset */
  scrollPastThreshold: boolean;
  /** Viewport width &lt; lg (1024px) */
  isViewportNarrow: boolean;
  /**
   * Narrow only: chrome (fixed header + docked category rail) hidden after scrolling down;
   * shown again when scrolling up or when near the top of the page.
   */
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
  /** Narrow viewports only: true = header/category chrome slid away */
  const [narrowChromeHidden, setNarrowChromeHidden] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const readNarrow = () => {
      const narrow = window.innerWidth < LAYOUT.LG_BREAKPOINT;
      setIsViewportNarrow(narrow);
      if (!narrow) {
        setNarrowChromeHidden(false);
      }
    };

    lastScrollYRef.current = window.scrollY || 0;

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY || 0;
        setScrollY(y);

        const narrow = window.innerWidth < LAYOUT.LG_BREAKPOINT;
        if (!narrow) {
          setNarrowChromeHidden(false);
          lastScrollYRef.current = y;
          return;
        }

        const lastY = lastScrollYRef.current;
        const delta = y - lastY;
        lastScrollYRef.current = y;

        if (y <= TOP_REVEAL_PX) {
          setNarrowChromeHidden(false);
          return;
        }

        if (delta > DIRECTION_DELTA_PX) {
          setNarrowChromeHidden(true);
        } else if (delta < -DIRECTION_DELTA_PX) {
          setNarrowChromeHidden(false);
        }
      });
    };

    readNarrow();
    setScrollY(window.scrollY || 0);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', readNarrow);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', readNarrow);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const value = useMemo<AppChromeScrollContextValue>(() => {
    const scrollPastThreshold = scrollY > TOP_REVEAL_PX;
    const narrowHeaderHidden = isViewportNarrow && narrowChromeHidden;
    return {
      scrollPastThreshold,
      isViewportNarrow,
      narrowHeaderHidden,
    };
  }, [scrollY, isViewportNarrow, narrowChromeHidden]);

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
