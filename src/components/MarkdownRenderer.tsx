import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { twMerge } from 'tailwind-merge';
import { isYouTubeUrl, extractYouTubeVideoIdAndTimestamp } from '@/utils/youtubeUtils';

/** Tailwind Typography stack for `prose` mode (long-form docs). */
const DOCUMENT_MARKDOWN_PROSE_CLASSES = [
  'prose prose-slate dark:prose-invert prose-lg max-w-none',
  'prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900 dark:prose-headings:text-slate-50',
  'prose-h1:text-3xl sm:prose-h1:text-[2rem] prose-h1:mt-0 prose-h1:mb-4',
  'prose-h2:mt-10 prose-h2:mb-4 prose-h2:text-2xl sm:prose-h2:text-[1.65rem]',
  'prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-xl',
  'prose-h4:mt-6 prose-h4:mb-2',
  'prose-p:leading-[1.75] prose-p:text-slate-600 dark:prose-p:text-slate-400',
  'prose-li:my-1.5 prose-li:marker:text-slate-400 dark:prose-li:marker:text-slate-500',
  'prose-ul:my-5 prose-ol:my-5',
  'prose-blockquote:border-l-primary-500 dark:prose-blockquote:border-l-primary-500',
  'prose-strong:text-slate-900 dark:prose-strong:text-slate-100',
  'prose-hr:border-slate-200 dark:prose-hr:border-slate-700 prose-hr:my-10',
  'prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-a:font-medium prose-a:no-underline hover:prose-a:underline',
  'prose-code:text-pink-700 dark:prose-code:text-pink-400 prose-code:bg-slate-100 dark:prose-code:bg-slate-800/80 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.9em] prose-code:font-normal before:prose-code:content-none after:prose-code:content-none',
  'prose-pre:bg-slate-100 dark:prose-pre:bg-slate-800/80 prose-pre:text-slate-800 dark:prose-pre:text-slate-200',
].join(' ');

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /** Called when a hashtag is clicked */
  onTagClick?: (tag: string) => void;
  /** Document typography via @tailwindcss/typography (`prose` / `prose-*` modifiers) */
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
  const [activeTimestampHref, setActiveTimestampHref] = useState<string | null>(null);
  const clearTimestampHighlightTimeoutRef = useRef<number | null>(null);

  const highlightTimestamp = useCallback((href: string) => {
    setActiveTimestampHref(href);
    if (clearTimestampHighlightTimeoutRef.current !== null) {
      window.clearTimeout(clearTimestampHighlightTimeoutRef.current);
    }
    clearTimestampHighlightTimeoutRef.current = window.setTimeout(() => {
      setActiveTimestampHref(null);
      clearTimestampHighlightTimeoutRef.current = null;
    }, 900);
  }, []);

  useEffect(() => {
    return () => {
      if (clearTimestampHighlightTimeoutRef.current !== null) {
        window.clearTimeout(clearTimestampHighlightTimeoutRef.current);
      }
    };
  }, []);

  // Compact components for card/feed views (prose=false)
  const compactComponents: Components = useMemo(() => ({
    table: ({ children }) => (
      <div className="markdown-table-wrapper overflow-x-auto -mx-1 px-1">
        <table className="markdown-table w-full border-collapse my-3 text-xs sm:text-sm">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-slate-50 dark:bg-slate-800/50">{children}</thead>
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
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr>{children}</tr>,
    h1: ({ children }) => (
      <h1 className="text-xs font-bold mt-1.5 mb-1 text-slate-900 dark:text-white leading-tight">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xs font-bold mt-1.5 mb-1 text-slate-900 dark:text-white leading-tight">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-xs font-bold mt-1.5 mb-1 text-slate-900 dark:text-white leading-tight">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-xs font-bold mt-1.5 mb-1 text-slate-900 dark:text-white leading-tight">{children}</h4>
    ),
    p: ({ children }) => <p className="mb-1.5">{children}</p>,
    ul: ({ children }) => (
      <ul className="list-disc list-outside ml-4 mb-2 space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside ml-4 mb-2 space-y-1">{children}</ol>
    ),
    li: ({ children }) => <li className="pl-0.5">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-slate-300 dark:border-slate-600 pl-4 italic my-4 text-slate-600 dark:text-slate-400">
        {children}
      </blockquote>
    ),
    code: ({ children, className }) => {
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
    pre: ({ children }) => (
      <pre className="bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto my-3">{children}</pre>
    ),
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary-600 dark:text-primary-400 hover:underline">
        {children}
      </a>
    ),
    strong: ({ children }) => (
      <strong className="font-bold text-slate-900 dark:text-slate-100">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    hr: () => <hr className="my-6 border-slate-200 dark:border-slate-700" />,
  }), []);

  // Document mode: typography from @tailwindcss/typography on the root; only
  // override tables so wide GFM tables scroll instead of blowing the layout.
  const documentTableComponents: Components = useMemo(
    () => ({
      table: ({ children }) => (
        <div className="not-prose my-8 w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">{children}</table>
        </div>
      ),
      thead: ({ children }) => (
        <thead className="bg-slate-50 dark:bg-slate-800/50">{children}</thead>
      ),
      th: ({ children }) => (
        <th className="font-semibold px-4 py-2.5 border-b-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
          {children}
        </th>
      ),
      td: ({ children }) => (
        <td className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 align-top">
          {children}
        </td>
      ),
    }),
    []
  );

  const components = prose ? documentTableComponents : compactComponents;

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
                  highlightTimestamp(href);
                  // Pass empty videoId - handler will get it from article context
                  onYouTubeTimestampClick('', timestamp, '');
                }}
                className={twMerge(
                  'text-primary-600 dark:text-primary-400 hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit rounded-sm transition-colors',
                  activeTimestampHref === href && 'bg-primary-100 dark:bg-primary-900/40'
                )}
              >
                {children}
              </button>
            );
          }
        }
        
        // Handle YouTube video links (with or without timestamp) — route all to in-app player
        if (href && isYouTubeUrl(href) && onYouTubeTimestampClick) {
          const { videoId, timestamp } = extractYouTubeVideoIdAndTimestamp(href);
          if (videoId) {
            const startTime = timestamp ?? 0;
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  highlightTimestamp(href);
                  onYouTubeTimestampClick(videoId, startTime, href);
                }}
                className={twMerge(
                  'text-primary-600 dark:text-primary-400 hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit rounded-sm transition-colors',
                  activeTimestampHref === href && 'bg-primary-100 dark:bg-primary-900/40'
                )}
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
  }, [components, onTagClick, onYouTubeTimestampClick, activeTimestampHref, highlightTimestamp]);

  if (!content) return null;

  const rootClassName = twMerge('markdown-content', prose && DOCUMENT_MARKDOWN_PROSE_CLASSES, className);

  return (
    <div
      className={rootClassName}
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

/** @deprecated Prefer {@link contentHasMarkdownTable} — kept for callers outside CardContent */
export {
  contentHasMarkdownTable as contentHasTable,
} from '@/utils/contentHasMarkdownTable';


