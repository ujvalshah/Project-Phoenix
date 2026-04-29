import React from 'react';

const URL_IN_TEXT = /\b(https?:\/\/[^\s<>"')]+)/gi;

interface LightweightMarkdownExcerptProps {
  /** Raw markdown-like text; markdown syntax is shown mostly verbatim (no full GFM parse). */
  content: string;
  className?: string;
}

function stopClick(e: React.MouseEvent): void {
  e.stopPropagation();
}

/**
 * Collapsed card body: no react-markdown/remark — line breaks preserved, http(s) URLs linkified.
 *
 * **Product trade-off:** `**bold**`, lists, blockquotes, and tables appear as plain text until
 * expand or article detail. Markdown tables still route through full `MarkdownRenderer` in
 * `CardContent` when `contentHasMarkdownTable` is true (rare).
 */
export const LightweightMarkdownExcerpt: React.FC<LightweightMarkdownExcerptProps> = ({
  content,
  className = '',
}) => {
  if (!content.trim()) return null;

  const lines = content.split('\n');

  return (
    <div className={className}>
      {lines.map((line, lineIndex) => (
        <React.Fragment key={lineIndex}>
          {lineIndex > 0 ? <br /> : null}
          <LineWithLinks line={line} lineKey={lineIndex} />
        </React.Fragment>
      ))}
    </div>
  );
};

function LineWithLinks({ line, lineKey }: { line: string; lineKey: number }): React.ReactNode {
  const parts: React.ReactNode[] = [];
  URL_IN_TEXT.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partKey = 0;

  while ((match = URL_IN_TEXT.exec(line)) !== null) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push(
        <span key={`${lineKey}-${partKey++}`}>{line.slice(lastIndex, start)}</span>,
      );
    }
    let url = match[1] ?? '';
    url = url.replace(/[)\].,;!?]+$/u, '');
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad scheme');
      const href = u.toString();
      parts.push(
        <a
          key={`${lineKey}-${partKey++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 dark:text-primary-400 hover:underline break-all"
          onClick={stopClick}
        >
          {href}
        </a>,
      );
    } catch {
      parts.push(<span key={`${lineKey}-${partKey++}`}>{match[0]}</span>);
    }
    lastIndex = URL_IN_TEXT.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(<span key={`${lineKey}-${partKey++}`}>{line.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? <>{parts}</> : null;
}

LightweightMarkdownExcerpt.displayName = 'LightweightMarkdownExcerpt';
