import React from 'react';

/**
 * Feed/list excerpt markdown: **no react-markdown / remark** — small inline subset only.
 * Block syntax (lists, headings, tables) stays plain until expand or detail view.
 */

const URL_IN_TEXT = /\b(https?:\/\/[^\s<>"')]+)/gi;

export type SlimSeg =
  | { t: 'plain'; s: string }
  | { t: 'code'; s: string }
  | { t: 'strike'; children: SlimSeg[] }
  | { t: 'bold'; children: SlimSeg[] }
  | { t: 'italic'; children: SlimSeg[] }
  | { t: 'a'; labelChildren: SlimSeg[]; href: string };

function stopClick(e: React.MouseEvent): void {
  e.stopPropagation();
}

/**
 * Left-to-right inline parse: code → md links → star/underscore bold → strike → italic.
 */
export function parseSlimFeedInline(source: string): SlimSeg[] {
  if (!source) return [];

  const patterns: Array<{ re: RegExp; map: (m: RegExpExecArray) => SlimSeg }> = [
    {
      re: /^`([^`]+)`/,
      map: (m) => ({ t: 'code', s: m[1] ?? '' }),
    },
    {
      re: /^\[([^\]]*)\]\(([^)\s]+)\)/,
      map: (m) => ({
        t: 'a',
        labelChildren: parseSlimFeedInline(m[1] ?? ''),
        href: m[2] ?? '',
      }),
    },
    {
      re: /^\*\*((?:[^*]|\*(?!\*))+?)\*\*/,
      map: (m) => ({ t: 'bold', children: parseSlimFeedInline(m[1] ?? '') }),
    },
    {
      re: /^~~((?:[^~]|~(?!~))+?)~~/,
      map: (m) => ({ t: 'strike', children: parseSlimFeedInline(m[1] ?? '') }),
    },
    {
      re: /^__((?:[^_]|_(?!_))+?)__/,
      map: (m) => ({ t: 'bold', children: parseSlimFeedInline(m[1] ?? '') }),
    },
    {
      re: /^\*((?:[^*])+?)\*/,
      map: (m) => ({ t: 'italic', children: parseSlimFeedInline(m[1] ?? '') }),
    },
    {
      re: /^_([^_]+)_/,
      map: (m) => ({ t: 'italic', children: parseSlimFeedInline(m[1] ?? '') }),
    },
  ];

  for (const { re, map } of patterns) {
    const m = re.exec(source);
    if (m && m.index === 0) {
      const seg = map(m);
      const rest = source.slice(m[0].length);
      if (!rest) return [seg];
      return [seg, ...parseSlimFeedInline(rest)];
    }
  }

  const nextSpecial = findNextSpecialIndex(source);
  if (nextSpecial < 0 || nextSpecial === 0) {
    return [{ t: 'plain', s: source }];
  }
  return [
    { t: 'plain', s: source.slice(0, nextSpecial) },
    ...parseSlimFeedInline(source.slice(nextSpecial)),
  ];
}

function findNextSpecialIndex(s: string): number {
  const idxs = ['`', '[', '*', '~', '_']
    .map((ch) => s.indexOf(ch))
    .filter((i) => i >= 0);
  return idxs.length ? Math.min(...idxs) : -1;
}

function linkifyPlain(text: string, keyPrefix: string): React.ReactNode {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  URL_IN_TEXT.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partKey = 0;

  while ((match = URL_IN_TEXT.exec(text)) !== null) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push(<span key={`${keyPrefix}-t-${partKey++}`}>{text.slice(lastIndex, start)}</span>);
    }
    let url = match[1] ?? '';
    url = url.replace(/[)\].,;!?]+$/u, '');
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad scheme');
      const href = u.toString();
      parts.push(
        <a
          key={`${keyPrefix}-u-${partKey++}`}
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
      parts.push(<span key={`${keyPrefix}-x-${partKey++}`}>{match[0]}</span>);
    }
    lastIndex = URL_IN_TEXT.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`${keyPrefix}-t-${partKey++}`}>{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? <>{parts}</> : null;
}

function segsToReact(segs: SlimSeg[], keyPrefix: string): React.ReactNode {
  return (
    <>
      {segs.map((seg, i) => {
        const k = `${keyPrefix}-${i}`;
        switch (seg.t) {
          case 'plain':
            return <React.Fragment key={k}>{linkifyPlain(seg.s, k)}</React.Fragment>;
          case 'code':
            return (
              <code
                key={k}
                className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-pink-700 dark:bg-slate-800/80 dark:text-pink-400"
              >
                {seg.s}
              </code>
            );
          case 'strike':
            return (
              <del key={k} className="line-through opacity-90">
                {segsToReact(seg.children, `${k}-s`)}
              </del>
            );
          case 'bold':
            return (
              <strong key={k} className="font-semibold text-slate-900 dark:text-slate-100">
                {segsToReact(seg.children, `${k}-b`)}
              </strong>
            );
          case 'italic':
            return (
              <em key={k} className="italic">
                {segsToReact(seg.children, `${k}-i`)}
              </em>
            );
          case 'a': {
            let href = seg.href.trim();
            try {
              const u = new URL(href);
              if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad');
              href = u.toString();
            } catch {
              return <span key={k}>{segsToReact(seg.labelChildren, `${k}-bad`)}</span>;
            }
            return (
              <a
                key={k}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:underline break-all"
                onClick={stopClick}
              >
                {segsToReact(seg.labelChildren, `${k}-lbl`)}
              </a>
            );
          }
          default:
            return null;
        }
      })}
    </>
  );
}

export function renderSlimMarkdownLine(line: string, lineKey: number): React.ReactNode {
  const segs = parseSlimFeedInline(line);
  return segsToReact(segs, `L${lineKey}`);
}
