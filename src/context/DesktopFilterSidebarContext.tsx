import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LAYOUT } from '@/constants/layout';

interface DesktopFilterSidebarStateValue {
  /** Home feed at lg+ — header filter control toggles sidebar instead of a dropdown */
  isInlineDesktopFiltersActive: boolean;
  sidebarCollapsed: boolean;
}

interface DesktopFilterSidebarActionsValue {
  setInlineDesktopFiltersActive: (v: boolean) => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebarCollapsed: () => void;
  expandSidebar: () => void;
}

const DesktopFilterSidebarStateContext = createContext<DesktopFilterSidebarStateValue | null>(null);
const DesktopFilterSidebarActionsContext = createContext<DesktopFilterSidebarActionsValue | null>(null);

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

  const stateValue = useMemo(
    () => ({
      isInlineDesktopFiltersActive,
      sidebarCollapsed,
    }),
    [
      isInlineDesktopFiltersActive,
      sidebarCollapsed,
    ],
  );

  const actionsValue = useMemo(
    () => ({
      setInlineDesktopFiltersActive,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
      expandSidebar,
    }),
    [
      setInlineDesktopFiltersActive,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
      expandSidebar,
    ],
  );

  return (
    <DesktopFilterSidebarActionsContext.Provider value={actionsValue}>
      <DesktopFilterSidebarStateContext.Provider value={stateValue}>
        {children}
      </DesktopFilterSidebarStateContext.Provider>
    </DesktopFilterSidebarActionsContext.Provider>
  );
};

export function useDesktopFilterSidebarState(): DesktopFilterSidebarStateValue {
  const stateCtx = useContext(DesktopFilterSidebarStateContext);
  if (!stateCtx) {
    throw new Error('useDesktopFilterSidebarState must be used within DesktopFilterSidebarProvider');
  }
  return stateCtx;
}

export function useDesktopFilterSidebarActions(): DesktopFilterSidebarActionsValue {
  const actionsCtx = useContext(DesktopFilterSidebarActionsContext);
  if (!actionsCtx) {
    throw new Error('useDesktopFilterSidebarActions must be used within DesktopFilterSidebarProvider');
  }
  return actionsCtx;
}

export function useDesktopFilterSidebar(): DesktopFilterSidebarStateValue & DesktopFilterSidebarActionsValue {
  return {
    ...useDesktopFilterSidebarState(),
    ...useDesktopFilterSidebarActions(),
  };
}
