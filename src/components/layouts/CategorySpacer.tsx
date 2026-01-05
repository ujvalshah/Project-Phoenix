import React from 'react';
import { LAYOUT_CLASSES } from '@/constants/layout';

/**
 * CategorySpacer: Explicit spacer component for sticky TagFilterBar
 * 
 * CATEGORY PHASE-OUT: Kept name for backward compatibility, but used with TagFilterBar
 * 
 * LAYOUT INVARIANT:
 * Sticky elements (position: sticky) do NOT reserve layout space.
 * This spacer creates the vertical space that the TagFilterBar occupies.
 * 
 * Height is sourced from LAYOUT_CLASSES to ensure sync with TagFilterBar.
 * 
 * STICKY RULE:
 * Sticky elements float.
 * A CategorySpacer MUST follow the TagFilterBar component in layout.
 */
export const CategorySpacer: React.FC = () => (
  <div className={LAYOUT_CLASSES.CATEGORY_SPACER} aria-hidden />
);

