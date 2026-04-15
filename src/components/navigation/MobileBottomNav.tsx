import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Home, Layers } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useFilters } from '@/context/FilterStateContext';
import { useAppChromeScroll } from '@/context/AppChromeScrollContext';
import { isFeatureEnabled } from '@/constants/featureFlags';
import { LAYOUT } from '@/constants/layout';
import { Z_INDEX } from '@/constants/zIndex';
import { usePulseUnseenCount, useStandardUnseenCount } from '@/hooks/usePulseUnseen';

const NAV_LABEL_CLASS = 'text-[11px] font-medium leading-tight tracking-[0.01em]';

interface BottomNavItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  indicator?: React.ReactNode;
}

const BottomNavItem: React.FC<BottomNavItemProps> = ({
  to,
  label,
  icon,
  active,
  onClick,
  ariaLabel,
  indicator,
}) => (
  <Link
    to={to}
    onClick={onClick}
    className={twMerge(
      'relative flex min-h-[58px] flex-col items-center justify-center rounded-xl px-2 py-1.5 transition-all duration-200 ease-out',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
      active
        ? 'bg-primary-50/90 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
        : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200',
    )}
    aria-current={active ? 'page' : undefined}
    aria-label={ariaLabel ?? label}
  >
    <span
      className={twMerge(
        'mb-0.5 inline-flex items-center justify-center',
        active ? 'text-primary-600 dark:text-primary-300' : 'text-slate-500 dark:text-slate-400',
      )}
      aria-hidden
    >
      {icon}
    </span>
    <span className={twMerge(NAV_LABEL_CLASS, active ? 'font-semibold' : 'font-medium')}>
      {label}
    </span>
    <span
      className={twMerge(
        'absolute inset-x-8 top-0.5 h-[2px] rounded-full transition-opacity duration-200',
        active ? 'bg-primary-500 opacity-100 dark:bg-primary-400' : 'opacity-0',
      )}
      aria-hidden
    />
    {indicator}
  </Link>
);

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
  const { isViewportNarrow, narrowHeaderHidden, setChromeInteractionActive } = useAppChromeScroll();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { data: pulseUnseenCount } = usePulseUnseenCount();
  const { data: standardUnseenCount } = useStandardUnseenCount();
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
  // Mobile bottom nav uses a dot (presence indicator) rather than a number:
  // follows Material 3 / Instagram / X convention for feed-style destinations
  // where quantity isn't actionable. The exact count lives on the desktop header.
  const pulseHasUpdates = (pulseUnseenCount ?? 0) > 0;
  const pulseBadgeLabel = useMemo(() => {
    if (!pulseHasUpdates) return '';
    return pulseUnseenCount != null && pulseUnseenCount > 99
      ? '99+ unseen Market Pulse updates'
      : `${pulseUnseenCount ?? 0} unseen Market Pulse updates`;
  }, [pulseHasUpdates, pulseUnseenCount]);
  const standardHasUpdates = (standardUnseenCount ?? 0) > 0;
  const standardBadgeLabel = useMemo(() => {
    if (!standardHasUpdates) return '';
    return standardUnseenCount != null && standardUnseenCount > 99
      ? '99+ unseen Home updates'
      : `${standardUnseenCount ?? 0} unseen Home updates`;
  }, [standardHasUpdates, standardUnseenCount]);

  return (
    <nav
      role="navigation"
      aria-label="Primary destinations"
      onTouchStart={() => setChromeInteractionActive(true)}
      onTouchEnd={() => setChromeInteractionActive(false)}
      onTouchCancel={() => setChromeInteractionActive(false)}
      onFocusCapture={() => setChromeInteractionActive(true)}
      onBlurCapture={() => setChromeInteractionActive(false)}
      className={twMerge(
        'fixed bottom-0 left-0 right-0 border-t border-slate-200/80 bg-white/95 pb-[max(env(safe-area-inset-bottom),0px)] shadow-[0_-8px_20px_-16px_rgba(15,23,42,0.35)] backdrop-blur-lg transition-[transform,opacity] duration-300 ease-out dark:border-slate-800/80 dark:bg-slate-950/92 dark:shadow-black/40 lg:hidden',
        chromeHidden && 'pointer-events-none translate-y-full opacity-0',
      )}
      style={{ zIndex: Z_INDEX.MOBILE_BOTTOM_NAV }}
    >
      <div className={twMerge('grid min-h-[64px] items-stretch px-2 pb-1 pt-1', gridCols)}>
        <BottomNavItem
          to="/"
          label="Home"
          icon={<Home size={19} strokeWidth={isStandard ? 2.3 : 2.1} />}
          active={isStandard}
          onClick={() => {
            filters.setContentStream('standard');
            if (isStandard) window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          indicator={standardHasUpdates ? (
            <span
              className="absolute right-3 top-2.5 flex h-2.5 w-2.5 items-center justify-center rounded-full border border-white bg-primary-500 dark:border-slate-950"
              aria-label={standardBadgeLabel}
              title={standardBadgeLabel}
            >
              <span className="sr-only">{standardBadgeLabel}</span>
            </span>
          ) : undefined}
        />

        {pulseEnabled && (
          <BottomNavItem
            to="/"
            label="Market Pulse"
            icon={<Activity size={19} strokeWidth={isPulse ? 2.3 : 2.1} />}
            active={isPulse}
            onClick={() => {
              filters.setContentStream('pulse');
              if (isPulse) window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-label="Market Pulse"
            indicator={pulseHasUpdates ? (
              <span
                className="absolute right-3 top-2.5 flex h-2.5 w-2.5 items-center justify-center rounded-full border border-white bg-amber-500 dark:border-slate-950"
                aria-label={pulseBadgeLabel}
                title={pulseBadgeLabel}
              >
                <span className="sr-only">{pulseBadgeLabel}</span>
              </span>
            ) : undefined}
          />
        )}

        <BottomNavItem
          to="/collections"
          label="Collections"
          icon={<Layers size={19} strokeWidth={isCollections ? 2.3 : 2.1} />}
          active={isCollections}
          onClick={() => {
            if (isCollections) window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </div>
    </nav>
  );
};
