import React from 'react';
import { renderSlimMarkdownLine } from './slimFeedMarkdown';

interface LightweightMarkdownExcerptProps {
  /** Raw markdown-like text; expanded/article detail use full `MarkdownRenderer`. */
  content: string;
  className?: string;
}

/**
 * Collapsed card body / Suspense fallback: **no react-markdown / remark**.
 *
 * Supports inline: line breaks, auto-linked URLs, `[label](url)`, `` `code` ``, `**bold**` /
 * `__bold__`, `*italic*` / `_italic_`, `~~strike~~`.
 *
 * Block markdown (lists, headings, tables, etc.) stays plain until expand or detail — tables
 * still upgrade to full `MarkdownRenderer` in `CardContent` via `contentHasMarkdownTable`.
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
          {renderSlimMarkdownLine(line, lineIndex)}
        </React.Fragment>
      ))}
    </div>
  );
};

LightweightMarkdownExcerpt.displayName = 'LightweightMarkdownExcerpt';
