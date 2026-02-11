import React, { useState, useCallback, useLayoutEffect, useRef, useMemo, useEffect } from 'react';
import { twMerge } from 'tailwind-merge';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { MarkdownRenderer, contentHasTable } from '@/components/MarkdownRenderer';
import { CardTitle } from './CardTitle';

interface CardContentProps {
  excerpt: string;
  content: string;
  isTextNugget: boolean;
  variant?: 'grid' | 'feed' | 'masonry' | 'utility'; // Design System: Variant-specific typography
  className?: string;
  allowExpansion?: boolean; // Allow expansion via fade overlay click (Hybrid cards only)
  cardType?: 'hybrid' | 'media-only'; // Card type - truncation ONLY for Hybrid cards
  title?: string; // Optional title to include inside truncation wrapper
  onYouTubeTimestampClick?: (videoId: string, timestamp: number, originalUrl: string) => void;
}

/**
 * CardContent: Standardized content container with truncation & fade
 * 
 * RULES (Two-Card Architecture):
 * - Hybrid cards: Truncation + fade + expand/collapse apply to title + body content
 * - Media-Only cards: NO truncation, NO fade, NO expand/collapse (just render content)
 * - Truncation wrapper wraps BOTH title (if provided) and body content (never media, tags, footer)
 * - This ensures consistent fade alignment regardless of title length
 * - Fade overlay click expands the entire wrapper area (title + body together)
 * - Card body click (outside fade) opens article drawer (handled by parent)
 */
export const CardContent: React.FC<CardContentProps> = React.memo(({
  excerpt,
  content,
  isTextNugget,
  variant = 'grid', // Default to grid
  className,
  allowExpansion = false,
  cardType = 'hybrid', // Default to hybrid for backward compatibility
  title, // Optional title to include inside truncation wrapper
  onYouTubeTimestampClick,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Single source of truth for expansion state
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Overflow detection - measured once when collapsed, stored for use when expanded
  // hadOverflowWhenCollapsed: true if content overflowed during initial measurement
  const [hadOverflowWhenCollapsed, setHadOverflowWhenCollapsed] = useState(false);
  const [measured, setMeasured] = useState(false);
  
  // Strip leading markdown headers (h1/h2) to prevent title duplication
  // CardTitle component already renders the title separately, so headers in content are redundant
  const displayContent = useMemo(() => {
    const rawContent = content || excerpt;
    if (!rawContent) return '';
    
    const lines = rawContent.split('\n');
    const strippedLines: string[] = [];
    let skipMode = true; // Start in skip mode (skip headers and empty lines)
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (skipMode) {
        // Skip leading empty lines
        if (!trimmed) {
          continue;
        }
        
        // Skip leading h1 or h2 headers only
        // Match: # Title (h1) or ## Title (h2), but NOT ### Title (h3+)
        const isH1 = trimmed.startsWith('# ') && !trimmed.startsWith('##');
        const isH2 = trimmed.startsWith('## ') && !trimmed.startsWith('###');
        
        if (isH1 || isH2) {
          // Skip this header line and continue skipping empty lines after it
          continue;
        }
        
        // If we find any other content (including h3+ headers), exit skip mode
        skipMode = false;
      }
      
      // Keep all content after we've processed leading headers
      strippedLines.push(line);
    }
    
    const result = strippedLines.join('\n');
    // Remove leading/trailing whitespace but preserve internal formatting
    return result.trim();
  }, [content, excerpt]);
  
  // Detect if content contains tables - tables should not be line-clamped
  const hasTable = useMemo(() => contentHasTable(displayContent), [displayContent]);

  // Measurement-based overflow detection using useLayoutEffect
  // CRITICAL: Only measure when collapsed (max-height applied)
  // Once measured, store the result and don't re-measure while expanded
  useLayoutEffect(() => {
    // Only measure when NOT expanded (collapsed state with max-height)
    if (isExpanded) {
      // Don't re-measure when expanded - keep the stored overflow state
      return;
    }
    
    // Reset measurement state when content changes
    setMeasured(false);
    
    const element = contentRef.current;
    
    // Guard: No element to measure
    if (!element) {
      setHadOverflowWhenCollapsed(false);
      setMeasured(true);
      return;
    }
    
    // Guard: Empty or whitespace-only content - no overflow possible
    if (!displayContent || displayContent.trim().length === 0) {
      setHadOverflowWhenCollapsed(false);
      setMeasured(true);
      return;
    }

    // Wait for layout to stabilize - use double RAF to ensure fonts and layout are fully rendered
    const rafId1 = requestAnimationFrame(() => {
      const rafId2 = requestAnimationFrame(() => {
        if (!contentRef.current || isExpanded) return;
        
        const el = contentRef.current;
        
        // Get computed styles for line height calculation
        const computedStyle = window.getComputedStyle(el);
        const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.5;
        const fontSize = parseFloat(computedStyle.fontSize) || 12;
        
        // Measurement-based overflow detection (collapsed state only)
        // scrollHeight = full content height (including clipped content)
        // clientHeight = visible height (respects max-height)
        // offsetHeight = visible height including borders
        const scrollHeight = el.scrollHeight;
        const clientHeight = el.clientHeight;
        const offsetHeight = el.offsetHeight;
        
        // Calculate approximate line count
        const approximateLineCount = scrollHeight / lineHeight;
        const visibleLineCount = clientHeight / lineHeight;
        
        // MINIMUM THRESHOLD: Require at least 2-3 visible lines before truncation triggers
        // This prevents truncation for very short content that fits in 1-2 lines
        const MIN_VISIBLE_LINES = 2.5; // Require at least 2.5 lines visible before truncation
        const hasMinimumContent = visibleLineCount >= MIN_VISIBLE_LINES;
        
        // Overflow detection: content overflows if scrollHeight exceeds clientHeight
        // Add 1px tolerance to account for rounding/subpixel rendering
        const isOverflowing = scrollHeight > clientHeight + 1;
        
        // Only show truncation if:
        // 1. Content actually overflows AND
        // 2. There's enough visible content (minimum threshold)
        const shouldTruncate = isOverflowing && hasMinimumContent;
        
        setHadOverflowWhenCollapsed(shouldTruncate);
        setMeasured(true);
      });
      
      return () => cancelAnimationFrame(rafId2);
    });

    // Set up ResizeObserver for layout changes with debouncing (collapsed state only)
    let debounceTimeout: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      // Only re-measure if still collapsed
      if (isExpanded) return;
      
      if (debounceTimeout) {
        window.clearTimeout(debounceTimeout);
      }
      debounceTimeout = window.setTimeout(() => {
        if (!contentRef.current || isExpanded) return;
        
        const el = contentRef.current;
        const computedStyle = window.getComputedStyle(el);
        const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.5;
        
        const scrollHeight = el.scrollHeight;
        const clientHeight = el.clientHeight;
        const visibleLineCount = clientHeight / lineHeight;
        const MIN_VISIBLE_LINES = 2.5;
        
        const hasMinimumContent = visibleLineCount >= MIN_VISIBLE_LINES;
        const isOverflowing = scrollHeight > clientHeight + 1;
        const shouldTruncate = isOverflowing && hasMinimumContent;
        
        // Only update if value actually changed
        setHadOverflowWhenCollapsed(prev => prev !== shouldTruncate ? shouldTruncate : prev);
      }, 100); // 100ms debounce to prevent flicker
    });

    resizeObserver.observe(element);

    return () => {
      cancelAnimationFrame(rafId1);
      if (debounceTimeout) {
        window.clearTimeout(debounceTimeout);
      }
      resizeObserver.disconnect();
    };
  }, [displayContent, isExpanded]);

  // Handle fade overlay click to expand
  const handleFadeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent drawer/card click
    e.preventDefault();
    if (allowExpansion && !isExpanded) {
      setIsExpanded(true);
    }
  }, [allowExpansion, isExpanded]);

  // Handle content area click to expand (for mobile/feed views)
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    // Only expand if:
    // 1. Expansion is allowed
    // 2. Content is not already expanded
    // 3. Content is truncated (has overflow)
    // 4. Not clicking on interactive elements (links, buttons)
    const target = e.target as HTMLElement;
    if (target.closest('a') || target.closest('button') || target.closest('[role="button"]')) {
      return; // Let interactive elements handle their own clicks
    }
    
    if (allowExpansion && !isExpanded && hadOverflowWhenCollapsed && measured) {
      e.stopPropagation(); // Prevent card click (drawer) on desktop
      setIsExpanded(true);
    }
  }, [allowExpansion, isExpanded, hadOverflowWhenCollapsed, measured]);

  // Handle collapse click
  const handleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent drawer/card click
    e.preventDefault();
    setIsExpanded(false);
  }, []);

  // TRUNCATION LOGIC (Two-Card Architecture):
  // - Both Hybrid and Media-Only cards: Apply truncation + fade + expand/collapse when content overflows
  // - This ensures "Read more" is available for any card with overflowing content
  // NOTE: Tables use a different max-height (200px vs 180px) but still get truncation + fade
  const isHybridCard = cardType === 'hybrid';
  const isMediaOnlyCard = cardType === 'media-only';

  // CRITICAL FIX: We need max-height APPLIED to measure overflow correctly.
  // The flow is:
  // 1. Apply max-height constraint (always, until measurement completes)
  // 2. Measure scrollHeight vs clientHeight
  // 3. If overflow detected → keep max-height, show "Read more"
  // 4. If no overflow → remove max-height, hide "Read more"

  // CRITICAL FIX: Separate truncation from expansion
  // - Truncation should ALWAYS apply when content overflows (for grid cards)
  // - Expansion controls only show when allowExpansion={true}
  // - When allowExpansion={false}, content is truncated but clicking opens drawer instead
  
  // shouldApplyMaxHeight: Apply constraint when overflow detected, regardless of allowExpansion
  // This ensures content is always truncated in grid view, even when expansion is disabled
  const shouldApplyMaxHeight = !isExpanded && (!measured || hadOverflowWhenCollapsed);

  // shouldShowFade: Show fade overlay when content is truncated
  // - If allowExpansion={true}: Show fade with "Read more" button
  // - If allowExpansion={false}: Show subtle fade only (no button) to indicate truncation
  const shouldShowFade = !isExpanded && hadOverflowWhenCollapsed && measured;

  // shouldClamp: Show "Read more" button only when expansion is allowed
  // When allowExpansion={false}, content is truncated but no "Read more" button is shown
  const shouldClamp = allowExpansion && shouldShowFade;

  // Show collapse control when: expanded, AND allowExpansion, AND content had overflow
  const showCollapse = allowExpansion && isExpanded && hadOverflowWhenCollapsed;
  
  // 🔍 AUDIT LOGGING - Truncation Application
  // Calculate approximate line count for body text
  const bodyLineCount = useMemo(() => {
    if (!displayContent) return 0;
    const lines = displayContent.split('\n').filter(line => line.trim().length > 0);
    return lines.length;
  }, [displayContent]);
  
  useEffect(() => {
    // Get current measurements for runtime audit
    const el = contentRef.current;
    const scrollHeight = el?.scrollHeight ?? 0;
    const clientHeight = el?.clientHeight ?? 0;
    const offsetHeight = el?.offsetHeight ?? 0;
    const computedStyle = el ? window.getComputedStyle(el) : null;
    const lineHeight = computedStyle 
      ? parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.5 
      : 0;
    const visibleLines = lineHeight > 0 ? Math.floor(clientHeight / lineHeight) : 0;
    const MIN_VISIBLE_LINES = 2.5;
    
    // Warn if measurement might be wrong (scrollHeight === clientHeight with long content)
    if (measured && !hadOverflowWhenCollapsed && displayContent.length > 200) {
      console.warn('[TRUNCATION-AUDIT-RUNTIME] ⚠️ Long content but no overflow detected!', {
        contentLength: displayContent.length,
        scrollHeight,
        clientHeight,
        areEqual: scrollHeight === clientHeight,
        maxHeightApplied: shouldApplyMaxHeight,
      });
    }
  }, [cardType, isHybridCard, allowExpansion, hasTable, isExpanded, shouldApplyMaxHeight, shouldClamp, showCollapse, hadOverflowWhenCollapsed, measured, bodyLineCount, displayContent.length]);

  return (
    <div 
      className={twMerge('relative flex-1 min-h-0 flex flex-col w-full', className)}
    >
      {/* TRUNCATION WRAPPER: Wraps BOTH title and body content for consistent fade alignment */}
      <div
        ref={contentRef}
        className={twMerge(
          // DEFAULT STATE: Fixed max-height with overflow hidden when collapsed
          // EXPANDED STATE: No height constraint, content shows fully
          shouldClamp ? 'relative overflow-hidden' : '',
          // Make content clickable for expansion when truncated (mobile/feed)
          allowExpansion && !isExpanded && hadOverflowWhenCollapsed && measured ? 'cursor-pointer' : ''
        )}
        onClick={handleContentClick}
        style={{
          // DEFAULT STATE: Fixed max-height constraint when collapsed (Hybrid cards only)
          // EXPANDED STATE: No max-height, content fills naturally
          // Card height MUST NOT expand unless manually expanded
          // Media-Only cards: NO max-height constraints
          // 
          // CRITICAL: Apply max-height BEFORE measurement to enable overflow detection!
          // Flow: Apply constraint → Measure → Keep if overflow, remove if not
          ...(shouldApplyMaxHeight ? { 
            // Tables get taller max-height (200px), regular content gets 180px
            maxHeight: hasTable ? '200px' : '180px',
            overflow: 'hidden',
            position: 'relative' as const
          } : undefined)
        }}
      >
        {/* Title (if provided) - included in truncation wrapper */}
        {title && (
          <div className={variant === 'grid' ? 'mb-2' : 'mb-2'}>
            <CardTitle title={title} variant={variant} />
          </div>
        )}
        
        {/* Body content */}
        <div
          className={twMerge(
            'nugget-content',
            // PHASE 1: All body text uses same base size (text-xs = 12px)
            // Body uses regular weight vs bold title for hierarchy
            variant === 'feed' 
              ? 'text-xs text-slate-700 dark:text-slate-300' 
              : 'text-xs text-slate-600 dark:text-slate-400',
            // Apply relaxed line-height (1.625) for Hybrid cards only - improves readability
            isHybridCard ? 'leading-relaxed' : ''
          )}
        >
          <MarkdownRenderer 
            content={displayContent} 
            onYouTubeTimestampClick={onYouTubeTimestampClick}
          />
        </div>
        {/* FADE OVERLAY: Show when content is truncated */}
        {/* - If allowExpansion={true}: Show fade with "Read more" button */}
        {/* - If allowExpansion={false}: Show subtle fade only (indicates truncation, clicking card opens drawer) */}
        {shouldShowFade && (
          <>
            {/* Light mode fade overlay */}
            <div 
              className="absolute inset-x-0 bottom-0 h-20 pointer-events-none dark:hidden"
              style={{
                background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.7) 30%, rgba(255, 255, 255, 0.9) 60%, rgba(255, 255, 255, 1) 100%)',
                zIndex: 5
              }}
            />
            {/* Dark mode fade overlay */}
            <div 
              className="absolute inset-x-0 bottom-0 h-20 pointer-events-none hidden dark:block"
              style={{
                background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0) 0%, rgba(15, 23, 42, 0.7) 30%, rgba(15, 23, 42, 0.9) 60%, rgba(15, 23, 42, 1) 100%)',
                zIndex: 5
              }}
            />
            {/* Clickable expand button overlay - Only show when expansion is allowed */}
            {shouldClamp && (
              <div 
                className="absolute inset-x-0 bottom-0 h-20 pointer-events-auto cursor-pointer flex items-end justify-center pb-3"
                onClick={handleFadeClick}
                style={{ zIndex: 10 }}
              >
                <button
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-slate-800 backdrop-blur-sm px-4 py-2 rounded-lg border-2 border-slate-300 dark:border-slate-600 shadow-md hover:shadow-lg hover:border-primary-400 dark:hover:border-primary-500 transition-all min-h-[44px]"
                  aria-label="Expand content to read more"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleFadeClick(e as unknown as React.MouseEvent);
                    }
                  }}
                >
                  <span>Read more</span>
                  <ChevronDown size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {/* EXPANDED STATE: Collapse control appears at bottom when expanded */}
      {showCollapse && (
        <div className="mt-2 flex justify-center">
          <button
            onClick={handleCollapse}
            className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            aria-label="Collapse content"
          >
            <ChevronUp size={14} />
            <span>Collapse</span>
          </button>
        </div>
      )}
    </div>
  );
});

