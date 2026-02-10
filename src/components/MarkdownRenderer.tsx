import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { isYouTubeTimestampLink, extractYouTubeVideoIdAndTimestamp } from '@/utils/youtubeUtils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /** Called when a hashtag is clicked */
  onTagClick?: (tag: string) => void;
  /** Whether to apply prose styling (for drawer/full view) */
  prose?: boolean;
  /** Called when a YouTube timestamp link is clicked (videoId, timestamp in seconds) */
  onYouTubeTimestampClick?: (videoId: string, timestamp: number, originalUrl: string) => void;
}

/**
 * Shared Markdown Renderer with GitHub-Flavored Markdown (GFM) support.
 * 
 * Features:
 * - GFM tables render correctly
 * - Tables are horizontally scrollable on small screens
 * - Security: skipHtml prevents raw HTML injection
 * - Consistent styling across feed and drawer views
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(({
  content,
  className = '',
  onTagClick,
  prose = false,
  onYouTubeTimestampClick,
}) => {
  // Memoize components to avoid recreating on each render
  const components: Components = useMemo(() => ({
    // Table wrapper for horizontal scrolling
    table: ({ children }) => (
      <div className="markdown-table-wrapper overflow-x-auto -mx-1 px-1">
        <table className="markdown-table w-full border-collapse my-3 text-xs sm:text-sm">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-slate-50 dark:bg-slate-800/50">
        {children}
      </thead>
    ),
    th: ({ children }) => (
      <th className="text-left font-bold px-2.5 py-1.5 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap text-xs sm:text-sm">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 align-top text-xs sm:text-sm">
        {children}
      </td>
    ),
    tbody: ({ children }) => (
      <tbody>
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr>
        {children}
      </tr>
    ),
    // Headers - PHASE 1: All headings use same size as body (text-xs = 12px), bold for emphasis, compact spacing
    h1: ({ children }) => (
      <h1 className="text-xs font-bold mt-1.5 mb-1 text-slate-900 dark:text-white leading-tight">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xs font-bold mt-1.5 mb-1 text-slate-900 dark:text-white leading-tight">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-xs font-bold mt-1.5 mb-1 text-slate-900 dark:text-white leading-tight">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-xs font-bold mt-1.5 mb-1 text-slate-900 dark:text-white leading-tight">
        {children}
      </h4>
    ),
    // Paragraphs - Inherit line-height from parent (CardContent applies leading-relaxed for Hybrid cards)
    p: ({ children }) => (
      <p className="mb-1.5">
        {children}
      </p>
    ),
    // Lists - Improved spacing for better mobile readability
    ul: ({ children }) => (
      <ul className="list-disc list-outside ml-4 mb-2 space-y-1">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside ml-4 mb-2 space-y-1">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="pl-0.5">
        {children}
      </li>
    ),
    // Blockquote
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-slate-300 dark:border-slate-600 pl-4 italic my-4 text-slate-600 dark:text-slate-400">
        {children}
      </blockquote>
    ),
    // Inline code
    code: ({ children, className }) => {
      // Check if this is a code block (has language class) or inline code
      const isCodeBlock = className?.includes('language-');
      if (isCodeBlock) {
        return (
          <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-sm font-mono overflow-x-auto">
            {children}
          </code>
        );
      }
      return (
        <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-pink-600 dark:text-pink-400">
          {children}
        </code>
      );
    },
    // Code blocks
    pre: ({ children }) => (
      <pre className="bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto my-3">
        {children}
      </pre>
    ),
    // Links
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-primary-600 dark:text-primary-400 hover:underline"
      >
        {children}
      </a>
    ),
    // Strong/Bold
    strong: ({ children }) => (
      <strong className="font-bold text-slate-900 dark:text-slate-100">
        {children}
      </strong>
    ),
    // Emphasis/Italic
    em: ({ children }) => (
      <em className="italic">
        {children}
      </em>
    ),
    // Horizontal rule
    hr: () => (
      <hr className="my-6 border-slate-200 dark:border-slate-700" />
    ),
  }), []);

  // Process hashtags and YouTube timestamps in content before rendering
  const processedContent = useMemo(() => {
    if (!content) return '';
    
    let processed = content;
    
    // Convert hashtags to clickable links (if onTagClick is provided)
    // Match #word patterns but not inside markdown links
    if (onTagClick) {
      processed = processed.replace(
        /(^|\s)(#[a-zA-Z0-9_]+)/g,
        (_, prefix, tag) => `${prefix}[${tag}](hashtag:${tag.slice(1)})`
      );
    }
    
    // Convert plain text YouTube timestamps to clickable links
    // Pattern: (MM:SS) or (H:MM:SS) - matches timestamps in parentheses
    // Only convert if onYouTubeTimestampClick is provided
    if (onYouTubeTimestampClick) {
      if (import.meta.env.DEV) {
        console.log('[MarkdownRenderer] Processing content for timestamps:', {
          contentLength: processed.length,
          hasTimestampPattern: /\(\d{2}:\d{2}\)/.test(processed),
        });
      }
      
      // Match timestamps like (00:36), (05:20), (1:23:45)
      // Use two separate patterns for clarity
      
      // Pattern 1: (H:MM:SS) format - 3 parts with colons
      const beforePattern1 = processed;
      processed = processed.replace(
        /(^|[^[])\s*\((\d{1,2}):(\d{2}):(\d{2})\)/g,
        (match, prefix, hours, minutes, seconds) => {
          const totalSeconds = parseInt(hours, 10) * 3600 + parseInt(minutes, 10) * 60 + parseInt(seconds, 10);
          if (import.meta.env.DEV) {
            console.log('[MarkdownRenderer] Pattern 1 match:', { match, hours, minutes, seconds, totalSeconds });
          }
          if (totalSeconds > 0) {
            return `${prefix}[${match.trim()}](${`youtube-timestamp:${totalSeconds}`})`;
          }
          return match;
        }
      );
      
      // Pattern 2: (MM:SS) format - 2 parts, both 2 digits (most common)
      processed = processed.replace(
        /(^|[^[])\s*\((\d{2}):(\d{2})\)/g,
        (match, prefix, minutes, seconds) => {
          // Check if this was already converted by pattern 1 (avoid double conversion)
          if (match.includes('youtube-timestamp:')) {
            return match;
          }
          const totalSeconds = parseInt(minutes, 10) * 60 + parseInt(seconds, 10);
          if (import.meta.env.DEV) {
            console.log('[MarkdownRenderer] Pattern 2 match:', { match, minutes, seconds, totalSeconds });
          }
          if (totalSeconds > 0) {
            return `${prefix}[${match.trim()}](${`youtube-timestamp:${totalSeconds}`})`;
          }
          return match;
        }
      );
      
      if (import.meta.env.DEV && beforePattern1 !== processed) {
        console.log('[MarkdownRenderer] Content after timestamp processing:', {
          original: beforePattern1.substring(0, 200),
          processed: processed.substring(0, 200),
        });
      }
    }
    
    return processed;
  }, [content, onTagClick, onYouTubeTimestampClick]);

  // Custom link handler for hashtags
  const handleLinkClick = useMemo(() => {
    if (!onTagClick) return undefined;
    
    return (e: React.MouseEvent<HTMLAnchorElement>) => {
      const href = (e.target as HTMLAnchorElement).getAttribute('href');
      if (href?.startsWith('hashtag:')) {
        e.preventDefault();
        e.stopPropagation();
        onTagClick(href.slice(8)); // Remove 'hashtag:' prefix
      }
    };
  }, [onTagClick]);

  // Override link component if we have hashtag or YouTube timestamp handling
  const finalComponents = useMemo(() => {
    const hasCustomHandlers = onTagClick || onYouTubeTimestampClick;
    if (!hasCustomHandlers) return components;
    
    return {
      ...components,
      a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
        // Handle hashtags
        if (href?.startsWith('hashtag:') && onTagClick) {
          return (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onTagClick(href.slice(8));
              }}
              className="text-primary-600 dark:text-primary-400 font-medium hover:underline cursor-pointer"
            >
              {children}
            </span>
          );
        }
        
        // Handle plain text timestamp links (converted from "(MM:SS)" format)
        if (href?.startsWith('youtube-timestamp:') && onYouTubeTimestampClick) {
          const timestamp = parseInt(href.slice('youtube-timestamp:'.length), 10);
          if (import.meta.env.DEV) {
            console.log('[MarkdownRenderer] Plain text timestamp link detected:', {
              href,
              timestamp,
              isValid: !isNaN(timestamp) && timestamp > 0,
              children: typeof children === 'string' ? children : 'ReactNode',
            });
          }
          if (!isNaN(timestamp) && timestamp > 0) {
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (import.meta.env.DEV) {
                    console.log('[MarkdownRenderer] Plain text timestamp clicked:', { timestamp });
                  }
                  // Pass empty videoId - handler will get it from article context
                  onYouTubeTimestampClick('', timestamp, '');
                }}
                className="text-primary-600 dark:text-primary-400 hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit"
              >
                {children}
              </button>
            );
          }
        }
        
        // Handle YouTube timestamp links (actual YouTube URLs with timestamp parameter)
        if (href && isYouTubeTimestampLink(href) && onYouTubeTimestampClick) {
          const { videoId, timestamp } = extractYouTubeVideoIdAndTimestamp(href);
          if (import.meta.env.DEV) {
            console.log('[MarkdownRenderer] YouTube timestamp link detected:', {
              href,
              videoId,
              timestamp,
              children: typeof children === 'string' ? children : 'ReactNode',
            });
          }
          if (videoId && timestamp !== null) {
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (import.meta.env.DEV) {
                    console.log('[MarkdownRenderer] Timestamp clicked:', { videoId, timestamp, href });
                  }
                  onYouTubeTimestampClick(videoId, timestamp, href);
                }}
                className="text-primary-600 dark:text-primary-400 hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit"
              >
                {children}
              </button>
            );
          }
        }
        
        // Regular link behavior
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-primary-600 dark:text-primary-400 hover:underline"
          >
            {children}
          </a>
        );
      },
    };
  }, [components, onTagClick, onYouTubeTimestampClick]);

  if (!content) return null;

  return (
    <div 
      className={`markdown-content ${prose ? 'prose prose-slate dark:prose-invert max-w-none' : ''} ${className}`}
      onClick={handleLinkClick ? (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'A') {
          handleLinkClick(e as unknown as React.MouseEvent<HTMLAnchorElement>);
        }
      } : undefined}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={finalComponents}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';

/**
 * Utility function to detect if content contains markdown tables.
 * Used by CardContent to decide whether to force expansion or hide tables in collapsed state.
 */
export function contentHasTable(content: string): boolean {
  if (!content) return false;
  
  // Check for table patterns: lines with pipes and separator lines
  const lines = content.split('\n');
  let hasTableHeader = false;
  let hasTableSeparator = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Table row with pipes
    if (trimmed.includes('|') && !trimmed.startsWith('|')) {
      hasTableHeader = true;
    }
    // Or proper table row starting and ending with pipes
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      hasTableHeader = true;
    }
    // Table separator (e.g., |---|---|)
    if (/^\|?[\s\-:]+\|[\s\-:|]+\|?$/.test(trimmed)) {
      hasTableSeparator = true;
    }
  }
  
  return hasTableHeader && hasTableSeparator;
}


