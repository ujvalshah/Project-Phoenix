import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LAYOUT } from '@/constants/layout';

/**
 * INVARIANT — DO NOT REINTRODUCE SCROLL-LINKED LAYOUT MUTATION.
 *
 * This controller drives `narrowHeaderHidden`, consumed by Header /
 * MobileBottomNav / PageStack. Those consumers animate via transform +
 * opacity ONLY. Mutating document height, sticky `top`, or padding in
 * response to this state causes browser scroll-anchoring to compensate
 * `scrollY`, which this listener then reads as phantom user scroll —
 * producing an oscillation loop (the "vibration" bug). Keep the state
 * compositor-only at all call sites.
 */

/** While within this top zone, chrome remains visible and stable */
const TOP_SAFE_ZONE_PX = 112;
/**
 * Ignore tiny per-frame jitter and bounce noise. Tuned above iOS Safari's
 * 1–3px slow-scroll granularity so finger tremor can't chip at accumulators.
 */
const SCROLL_NOISE_PX = 4;
/** Hide reluctantly: require meaningful cumulative downward travel */
const HIDE_ACCUMULATED_PX = 44;
/**
 * Show threshold. Deliberately well above the amplitude of iOS rubber-band
 * rebound deltas so bounce-back at top/bottom edges doesn't flash the header.
 * Still far below a deliberate scroll-up intent (~80–150px).
 */
const SHOW_ACCUMULATED_PX = 24;

interface AppChromeScrollContextValue {
  /** Viewport width &lt; lg (1024px) */
  isViewportNarrow: boolean;
  /**
   * Narrow only: chrome (fixed header + docked category rail) hidden after scrolling down;
   * shown again when scrolling up or when near the top of the page.
   */
  narrowHeaderHidden: boolean;
  /** Guard chrome visibility while user interacts with bottom chrome controls. */
  setChromeInteractionActive: (active: boolean) => void;
}

const AppChromeScrollContext = createContext<AppChromeScrollContextValue | null>(null);

export const AppChromeScrollProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isViewportNarrow, setIsViewportNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < LAYOUT.LG_BREAKPOINT : false,
  );
  /** Narrow viewports only: true = header/category chrome slid away */
  const [narrowChromeHidden, setNarrowChromeHidden] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  const lastScrollYRef = useRef(0);
  const narrowChromeHiddenRef = useRef(false);
  const downAccumRef = useRef(0);
  const upAccumRef = useRef(0);
  const interactionLockRef = useRef(false);
  const prefersReducedMotionRef = useRef(prefersReducedMotion);
  useLayoutEffect(() => {
    prefersReducedMotionRef.current = prefersReducedMotion;
  }, [prefersReducedMotion]);

  const setChromeInteractionActive = useCallback((active: boolean) => {
    interactionLockRef.current = active;
    if (active) {
      downAccumRef.current = 0;
      upAccumRef.current = 0;
      if (narrowChromeHiddenRef.current) {
        narrowChromeHiddenRef.current = false;
        setNarrowChromeHidden(false);
      }
    }
  }, []);

  const setHiddenIfChanged = useCallback((next: boolean) => {
    if (narrowChromeHiddenRef.current === next) return;
    narrowChromeHiddenRef.current = next;
    setNarrowChromeHidden(next);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionPreferenceChange = () => setPrefersReducedMotion(mq.matches);
    onMotionPreferenceChange();
    mq.addEventListener('change', onMotionPreferenceChange);
    return () => mq.removeEventListener('change', onMotionPreferenceChange);
  }, []);

  /** When reduced motion is enabled, force chrome visible and avoid scroll-driven hide churn. */
  useEffect(() => {
    if (!prefersReducedMotion) return;
    downAccumRef.current = 0;
    upAccumRef.current = 0;
    queueMicrotask(() => setHiddenIfChanged(false));
  }, [prefersReducedMotion, setHiddenIfChanged]);

  useEffect(() => {
    const readNarrow = () => {
      const narrow = window.innerWidth < LAYOUT.LG_BREAKPOINT;
      setIsViewportNarrow(narrow);
      if (!narrow) {
        downAccumRef.current = 0;
        upAccumRef.current = 0;
        setHiddenIfChanged(false);
      }
    };

    lastScrollYRef.current = window.scrollY || 0;
    narrowChromeHiddenRef.current = false;

    // Zero accumulators on gesture start so stale noise/momentum from the
    // previous gesture can't leak across and trip a threshold on the next one.
    const onGestureStart = () => {
      downAccumRef.current = 0;
      upAccumRef.current = 0;
    };

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY || 0;

        // Rubber-band guard: iOS Safari (and Android overscroll) can briefly
        // report scrollY past document bounds during elastic bounce. Those
        // deltas aren't user intent — snapshot position and bail so they
        // don't enter the accumulators.
        const maxY =
          document.documentElement.scrollHeight - window.innerHeight;
        if (y < 0 || y > maxY) {
          lastScrollYRef.current = y;
          return;
        }

        const narrow = window.innerWidth < LAYOUT.LG_BREAKPOINT;
        if (!narrow) {
          downAccumRef.current = 0;
          upAccumRef.current = 0;
          setHiddenIfChanged(false);
          lastScrollYRef.current = y;
          return;
        }

        if (interactionLockRef.current) {
          downAccumRef.current = 0;
          upAccumRef.current = 0;
          setHiddenIfChanged(false);
          lastScrollYRef.current = y;
          return;
        }

        if (prefersReducedMotionRef.current) {
          downAccumRef.current = 0;
          upAccumRef.current = 0;
          setHiddenIfChanged(false);
          lastScrollYRef.current = y;
          return;
        }

        const lastY = lastScrollYRef.current;
        const delta = y - lastY;
        lastScrollYRef.current = y;

        if (y <= TOP_SAFE_ZONE_PX) {
          downAccumRef.current = 0;
          upAccumRef.current = 0;
          setHiddenIfChanged(false);
          return;
        }

        if (Math.abs(delta) <= SCROLL_NOISE_PX) {
          return;
        }

        if (delta > 0) {
          downAccumRef.current += delta;
          upAccumRef.current = 0;
          if (!narrowChromeHiddenRef.current && downAccumRef.current >= HIDE_ACCUMULATED_PX) {
            setHiddenIfChanged(true);
            downAccumRef.current = 0;
          }
          return;
        }

        upAccumRef.current += Math.abs(delta);
        downAccumRef.current = 0;
        if (narrowChromeHiddenRef.current && upAccumRef.current >= SHOW_ACCUMULATED_PX) {
          setHiddenIfChanged(false);
          upAccumRef.current = 0;
        }
      });
    };

    readNarrow();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', readNarrow);
    window.addEventListener('pointerdown', onGestureStart, { passive: true });
    window.addEventListener('touchstart', onGestureStart, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', readNarrow);
      window.removeEventListener('pointerdown', onGestureStart);
      window.removeEventListener('touchstart', onGestureStart);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [setHiddenIfChanged]);

  const value = useMemo<AppChromeScrollContextValue>(() => {
    const narrowHeaderHidden =
      isViewportNarrow && narrowChromeHidden && !prefersReducedMotion;
    return {
      isViewportNarrow,
      narrowHeaderHidden,
      setChromeInteractionActive,
    };
  }, [isViewportNarrow, narrowChromeHidden, prefersReducedMotion, setChromeInteractionActive]);

  return (
    <AppChromeScrollContext.Provider value={value}>{children}</AppChromeScrollContext.Provider>
  );
};

export function useAppChromeScroll(): AppChromeScrollContextValue {
  const ctx = useContext(AppChromeScrollContext);
  if (!ctx) {
    return {
      isViewportNarrow: false,
      narrowHeaderHidden: false,
      setChromeInteractionActive: () => undefined,
    };
  }
  return ctx;
}
