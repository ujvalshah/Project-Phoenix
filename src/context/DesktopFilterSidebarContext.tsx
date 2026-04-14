import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LAYOUT } from '@/constants/layout';

interface DesktopFilterSidebarContextValue {
  /** Home feed at lg+ — header filter control toggles sidebar instead of a dropdown */
  isInlineDesktopFiltersActive: boolean;
  setInlineDesktopFiltersActive: (v: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebarCollapsed: () => void;
  expandSidebar: () => void;
}

const DesktopFilterSidebarContext = createContext<DesktopFilterSidebarContextValue | null>(null);

export const DesktopFilterSidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInlineDesktopFiltersActive, setIsInlineDesktopFiltersActive] = useState(false);
  const setInlineDesktopFiltersActive = useCallback((v: boolean) => {
    setIsInlineDesktopFiltersActive(v);
  }, []);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() => {
    if (typeof window === 'undefined') return false;
    const w = window.innerWidth;
    return w >= LAYOUT.LG_BREAKPOINT;
  });
  const userExplicitRef = React.useRef(false);

  // Auto-collapse on resize for desktop widths, but only when the user
  // hasn't explicitly toggled.
  useEffect(() => {
    const onResize = () => {
      if (userExplicitRef.current) return;
      const w = window.innerWidth;
      if (w >= LAYOUT.LG_BREAKPOINT) setSidebarCollapsedState(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const setSidebarCollapsed = useCallback((v: boolean) => {
    userExplicitRef.current = true;
    setSidebarCollapsedState(v);
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    userExplicitRef.current = true;
    setSidebarCollapsedState((c) => !c);
  }, []);

  const expandSidebar = useCallback(() => {
    userExplicitRef.current = true;
    setSidebarCollapsedState(false);
  }, []);

  const value = useMemo(
    () => ({
      isInlineDesktopFiltersActive,
      setInlineDesktopFiltersActive,
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
      expandSidebar,
    }),
    [
      isInlineDesktopFiltersActive,
      setInlineDesktopFiltersActive,
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
      expandSidebar,
    ],
  );

  return <DesktopFilterSidebarContext.Provider value={value}>{children}</DesktopFilterSidebarContext.Provider>;
};

export function useDesktopFilterSidebar(): DesktopFilterSidebarContextValue {
  const ctx = useContext(DesktopFilterSidebarContext);
  if (!ctx) {
    throw new Error('useDesktopFilterSidebar must be used within DesktopFilterSidebarProvider');
  }
  return ctx;
}
