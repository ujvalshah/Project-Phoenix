
import React from 'react';

interface MainLayoutProps {
  children: React.ReactNode;
}

/**
 * ARCHITECTURAL INVARIANT: MainLayout Structure
 * 
 * This component enforces the critical layout architecture:
 * 
 * 1. Header MUST be rendered OUTSIDE this layout (in App.tsx)
 *    - Header is sticky positioned and owns its vertical space (h-14 = 56px)
 *    - Header must NEVER be conditionally rendered or wrapped by stateful containers
 * 
 * 2. This layout provides ONLY the page content container
 *    - NO padding-top compensation for header height
 *    - Header owns its space, content flows naturally below it
 *    - Does NOT wrap Header component
 * 
 * 3. Scroll ownership:
 *    - Body/document is the scroll container
 *    - Header is sticky (not fixed) and participates in document flow
 *    - Page content scrolls independently
 * 
 * 4. Width constraints:
 *    - Applied at page level, not layout level
 *    - Ensures consistency across routes
 * 
 * LAYOUT INVARIANT:
 * The Header owns its vertical space.
 * No other component may offset for header height.
 * Any spacing issues must be fixed by removing duplication,
 * not by adding new padding or margins.
 * 
 * VIOLATION WARNING:
 * If Header is moved inside MainLayout or wrapped by flex/grid containers,
 * layout instability WILL occur regardless of CSS fixes.
 */
export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 font-sans selection:bg-primary-500/30">
      {/* 
        Content container - NO padding-top compensation.
        Header is rendered OUTSIDE this container in App.tsx.
        Header owns its space (h-14 = 56px), content flows naturally below.
      */}
      {children}
    </div>
  );
};
