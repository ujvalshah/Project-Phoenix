import React from 'react';
import { LAYOUT_CLASSES } from '@/constants/layout';

/**
 * MainContentTopSpacer: Breathing room between fixed/sticky chrome and page content.
 *
 * LAYOUT INVARIANT:
 * Same value on all breakpoints (dense dashboard: 16px / 1rem via Tailwind h-4).
 * Using rem keeps the gap proportional when users increase base font size on small screens.
 */
interface MainContentTopSpacerProps {
  className?: string;
}

export const MainContentTopSpacer: React.FC<MainContentTopSpacerProps> = ({ className }) => (
  <div className={className ?? LAYOUT_CLASSES.CONTENT_TOP_SPACER} aria-hidden />
);
