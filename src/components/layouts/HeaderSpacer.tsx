import React from 'react';
import { LAYOUT_CLASSES } from '@/constants/layout';
import { useAppChromeScroll } from '@/context/AppChromeScrollContext';

/**
 * HeaderSpacer: Explicit spacer component for fixed Header
 *
 * LAYOUT INVARIANT:
 * Fixed elements (position: fixed) do NOT reserve layout space.
 * This spacer creates the vertical space that the Header occupies.
 *
 * When the narrow header is slid away on scroll, spacer height goes to 0.
 */
export const HeaderSpacer: React.FC = () => {
  const { narrowHeaderHidden } = useAppChromeScroll();
  return (
    <div
      className={narrowHeaderHidden ? 'h-0 shrink-0' : LAYOUT_CLASSES.HEADER_SPACER}
      aria-hidden
    />
  );
};

