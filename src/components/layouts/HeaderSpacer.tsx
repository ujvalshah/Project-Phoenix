import React from 'react';
import { LAYOUT_CLASSES } from '@/constants/layout';

/**
 * HeaderSpacer: Explicit spacer component for fixed Header
 *
 * LAYOUT INVARIANT:
 * Fixed elements (position: fixed) do NOT reserve layout space.
 * This spacer creates the vertical space that the Header occupies.
 *
 * Height is STATIC regardless of scroll-driven header visibility.
 * The header hides via compositor-only transform; document flow never changes.
 * Why: a scroll-linked height toggle causes browser scroll-anchoring to
 * compensate scrollY, which our scroll listener reads as phantom deltas and
 * oscillates the hide/show state — the "vibration" bug on mobile.
 *
 * DO NOT make this height depend on `narrowHeaderHidden` or any scroll state.
 * See src/context/AppChromeScrollContext.tsx for the full invariant.
 */
export const HeaderSpacer: React.FC = () => {
  return <div className={LAYOUT_CLASSES.HEADER_SPACER} aria-hidden />;
};

