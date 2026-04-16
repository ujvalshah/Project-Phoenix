import React from 'react';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlights whitespace-separated query terms (min length 2) in plain text.
 * Returns safe text nodes + <mark> — no HTML parsing.
 */
export function highlightPlainText(text: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed || !text) return text;

  const terms = trimmed
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (terms.length === 0) return text;

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    if (!part) return null;
    if (terms.some((t) => part.toLowerCase() === t.toLowerCase())) {
      return (
        <mark
          key={i}
          className="rounded-sm bg-yellow-200/90 px-0.5 text-inherit dark:bg-yellow-500/35"
        >
          {part}
        </mark>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
