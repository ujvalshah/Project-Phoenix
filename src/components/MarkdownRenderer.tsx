import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /** Called when a hashtag is clicked */
  onTagClick?: (tag: string) => void;
  /** Whether to apply prose styling (for drawer/full view) */
  prose?: boolean;
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
}) => {
  // Memoize components to avoid recreating on each render
  const components: Components = useMemo(() => ({
    // Table wrapper for horizontal scrolling
    table: ({ children }) => (
      <div className="markdown-table-wrapper overflow-x-auto -mx-1 px-1">
        <table className="markdown-table w-full border-collapse my-3 text-xs">
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
      <th className="text-left font-bold px-2.5 py-1.5 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap text-xs">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 align-top text-xs">
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
    // Lists - PHASE 1: Compact spacing, no nested structure issues
    ul: ({ children }) => (
      <ul className="list-disc list-outside ml-4 mb-2 space-y-0.5">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside ml-4 mb-2 space-y-0.5">
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

  // Process hashtags in content before rendering
  const processedContent = useMemo(() => {
    if (!content) return '';
    
    // Convert hashtags to clickable links (if onTagClick is provided)
    // Match #word patterns but not inside markdown links
    if (onTagClick) {
      return content.replace(
        /(^|\s)(#[a-zA-Z0-9_]+)/g,
        (_, prefix, tag) => `${prefix}[${tag}](hashtag:${tag.slice(1)})`
      );
    }
    return content;
  }, [content, onTagClick]);

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

  // Override link component if we have hashtag handling
  const finalComponents = useMemo(() => {
    if (!onTagClick) return components;
    
    return {
      ...components,
      a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
        if (href?.startsWith('hashtag:')) {
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
  }, [components, onTagClick]);

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


