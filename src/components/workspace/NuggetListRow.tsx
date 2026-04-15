import React from 'react';
import { ExternalLink, Globe, Lock } from 'lucide-react';
import type { Article } from '@/types';
import { getThumbnailUrl } from '@/utils/mediaClassifier';
import { formatDate } from '@/utils/formatters';
import { getNuggetPrimaryHref, getNuggetSourceLabel } from './articleSourceLabel';

interface NuggetListRowProps {
  article: Article;
  selectionMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onOpen: (article: Article) => void;
  compact?: boolean;
}

const TAG_CAP = (compact: boolean) => (compact ? 1 : 2);

export const NuggetListRow: React.FC<NuggetListRowProps> = ({
  article,
  selectionMode,
  isSelected,
  onSelect,
  onOpen,
  compact = false,
}) => {
  const thumb = getThumbnailUrl(article);
  const source = getNuggetSourceLabel(article);
  const href = getNuggetPrimaryHref(article);
  const vis = article.visibility ?? 'private';
  const tags = (article.tags ?? []).filter(Boolean);
  const cap = TAG_CAP(compact);
  const extraTags = Math.max(0, tags.length - cap);
  const displayTags = tags.slice(0, cap);

  const published = article.publishedAt ? formatDate(article.publishedAt, false) : '—';
  const updatedRaw = article.updated_at ?? article.created_at;
  const updated = updatedRaw ? formatDate(updatedRaw, false) : null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (selectionMode) onSelect(article.id);
      else onOpen(article);
    }
  };

  const thumbBox = compact ? 'h-11 w-16 shrink-0' : 'h-[3.25rem] w-[5.5rem] shrink-0';

  return (
    <article
      className={[
        'rounded-md bg-white motion-safe:transition-colors dark:bg-slate-950/50',
        isSelected
          ? 'ring-1 ring-slate-900 ring-offset-2 ring-offset-slate-50 dark:ring-slate-100 dark:ring-offset-slate-950'
          : 'ring-1 ring-slate-200/60 hover:ring-slate-300/80 dark:ring-slate-800 dark:hover:ring-slate-600',
      ].join(' ')}
    >
      <div
        className={`flex gap-3 ${compact ? 'p-2.5' : 'p-3'}`}
        role="button"
        tabIndex={0}
        aria-pressed={selectionMode ? isSelected : undefined}
        onClick={() => (selectionMode ? onSelect(article.id) : onOpen(article))}
        onKeyDown={handleKeyDown}
      >
        <div className={`relative overflow-hidden bg-slate-100 dark:bg-slate-900 ${thumbBox}`}>
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">—</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-600 dark:text-slate-300">{source}</span>
            <span aria-hidden>·</span>
            {vis === 'public' ? (
              <span className="inline-flex items-center gap-0.5">
                <Globe className="h-3 w-3" aria-hidden />
                Public
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5">
                <Lock className="h-3 w-3" aria-hidden />
                Draft
              </span>
            )}
            <span aria-hidden>·</span>
            <span>{published}</span>
            {updated && !compact && (
              <>
                <span aria-hidden>·</span>
                <span>Upd. {updated}</span>
              </>
            )}
          </div>
          <h2
            className={`mt-0.5 font-semibold tracking-tight text-slate-900 dark:text-slate-50 ${
              compact ? 'line-clamp-1 text-sm' : 'line-clamp-2 text-[0.9375rem] leading-snug'
            }`}
          >
            {article.title?.trim() || 'Untitled'}
          </h2>
          {!compact && article.excerpt?.trim() && (
            <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{article.excerpt.trim()}</p>
          )}
          {(displayTags.length > 0 || extraTags > 0) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500 dark:text-slate-400">
              {displayTags.map((t) => (
                <span key={t}>{t}</span>
              ))}
              {extraTags > 0 && <span className="text-slate-400">+{extraTags}</span>}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end justify-center gap-0.5">
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-200 dark:focus-visible:outline-slate-200"
              title="Source"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(article);
            }}
            className="px-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 dark:text-slate-300 dark:hover:text-slate-100 dark:focus-visible:outline-slate-200"
          >
            Open
          </button>
        </div>
      </div>
    </article>
  );
};
