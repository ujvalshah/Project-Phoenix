import React from 'react';
import { LAYOUT_CLASSES } from '@/constants/layout';

/**
 * HeaderSpacer: Explicit spacer component for fixed Header
 * 
 * LAYOUT INVARIANT:
 * Fixed elements (position: fixed) do NOT reserve layout space.
 * This spacer creates the vertical space that the Header occupies.
 * 
 * Heights are sourced from LAYOUT_CLASSES to ensure sync with Header.
 */
export const HeaderSpacer: React.FC = () => (
  <div className={LAYOUT_CLASSES.HEADER_SPACER} aria-hidden />
);

