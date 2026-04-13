import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';
import { useFilters } from '@/context/FilterStateContext';
import { useAppChromeScroll } from '@/context/AppChromeScrollContext';
import { isFeatureEnabled } from '@/constants/featureFlags';
import { LAYOUT } from '@/constants/layout';
import { Z_INDEX } from '@/constants/zIndex';
import { usePulseTodayCount } from '@/hooks/usePulseTodayCount';

/** Text-only tabs: no icons — labels carry the affordance */
const NAV_LABEL_CLASS =
  'text-center text-[11px] font-semibold leading-snug tracking-tight text-balance';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * Mobile-only primary destinations: Home, Market Pulse (feature-flagged), Collections.
 * Coordinates with filter state (contentStream) and document scroll chrome (hide on scroll down).
 */
export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const filters = useFilters();
  const { isViewportNarrow, narrowHeaderHidden } = useAppChromeScroll();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { data: pulseTodayCount } = usePulseTodayCount();
  const pulseEnabled = isFeatureEnabled('MARKET_PULSE');

  const showShell =
    isViewportNarrow &&
    (location.pathname === '/' || location.pathname.startsWith('/collections'));

  useEffect(() => {
    if (!showShell) {
      document.documentElement.style.removeProperty('--mobile-bottom-nav-inset');
      return;
    }
    document.documentElement.style.setProperty(
      '--mobile-bottom-nav-inset',
      `calc(${LAYOUT.MOBILE_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
    );
    return () => {
      document.documentElement.style.removeProperty('--mobile-bottom-nav-inset');
    };
  }, [showShell]);

  if (!showShell) {
    return null;
  }

  const chromeHidden = narrowHeaderHidden && !prefersReducedMotion;

  const isHome = location.pathname === '/';
  const isCollections = location.pathname.startsWith('/collections');
  const isStandard = isHome && filters.contentStream === 'standard';
  const isPulse = isHome && filters.contentStream === 'pulse';

  const gridCols = pulseEnabled ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className={twMerge(
        'fixed bottom-0 left-0 right-0 border-t border-slate-200/90 bg-white/92 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_24px_-8px_rgba(15,23,42,0.12)] backdrop-blur-md transition-[transform,opacity] duration-300 ease-out dark:border-slate-800/90 dark:bg-slate-950/92 dark:shadow-black/25 lg:hidden',
        chromeHidden && 'pointer-events-none translate-y-full opacity-0',
      )}
      style={{ zIndex: Z_INDEX.MOBILE_BOTTOM_NAV }}
    >
      <div className={twMerge('grid min-h-[52px] items-stretch px-1 py-1.5', gridCols)}>
        <Link
          to="/"
          onClick={() => filters.setContentStream('standard')}
          className={twMerge(
            'flex min-h-[48px] items-center justify-center rounded-lg px-1 py-1 text-slate-500 transition-colors dark:text-slate-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
            isStandard && 'text-primary-600 dark:text-primary-400',
          )}
          aria-current={isStandard ? 'page' : undefined}
        >
          <span className={NAV_LABEL_CLASS}>Home</span>
        </Link>

        {pulseEnabled && (
          <Link
            to="/"
            onClick={() => filters.setContentStream('pulse')}
            className={twMerge(
              'relative flex min-h-[48px] items-center justify-center rounded-lg px-1 py-1 text-slate-500 transition-colors dark:text-slate-400',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
              isPulse && 'text-primary-600 dark:text-primary-400',
            )}
            aria-current={isPulse ? 'page' : undefined}
            aria-label="Market Pulse"
          >
            {pulseTodayCount != null && pulseTodayCount > 0 && (
              <span
                className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-semibold leading-none text-white"
                aria-hidden
              >
                {pulseTodayCount > 99 ? '99+' : pulseTodayCount}
              </span>
            )}
            <span className={`${NAV_LABEL_CLASS} flex flex-col items-center leading-none`}>
              <span>Market</span>
              <span className="mt-0.5">Pulse</span>
            </span>
          </Link>
        )}

        <Link
          to="/collections"
          className={twMerge(
            'flex min-h-[48px] items-center justify-center rounded-lg px-1 py-1 text-slate-500 transition-colors dark:text-slate-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
            isCollections && 'text-primary-600 dark:text-primary-400',
          )}
          aria-current={isCollections ? 'page' : undefined}
        >
          <span className={NAV_LABEL_CLASS}>Collections</span>
        </Link>
      </div>
    </nav>
  );
};
