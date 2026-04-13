import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

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
    return w >= 1024 && w < 1280;
  });

  const setSidebarCollapsed = useCallback((v: boolean) => {
    setSidebarCollapsedState(v);
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsedState((c) => !c);
  }, []);

  const expandSidebar = useCallback(() => {
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
