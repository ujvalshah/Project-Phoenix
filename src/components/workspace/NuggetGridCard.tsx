import React from 'react';
import { ExternalLink, Globe, Lock } from 'lucide-react';
import type { Article } from '@/types';
import { getThumbnailUrl } from '@/utils/mediaClassifier';
import { formatDate } from '@/utils/formatters';
import { getNuggetPrimaryHref, getNuggetSourceLabel } from './articleSourceLabel';

interface NuggetGridCardProps {
  article: Article;
  selectionMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onOpen: (article: Article) => void;
}

const MAX_TAGS = 2;

export const NuggetGridCard: React.FC<NuggetGridCardProps> = ({
  article,
  selectionMode,
  isSelected,
  onSelect,
  onOpen,
}) => {
  const thumb = getThumbnailUrl(article);
  const source = getNuggetSourceLabel(article);
  const href = getNuggetPrimaryHref(article);
  const vis = article.visibility ?? 'private';
  const tags = (article.tags ?? []).filter(Boolean);
  const extraTags = Math.max(0, tags.length - MAX_TAGS);
  const displayTags = tags.slice(0, MAX_TAGS);

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

  return (
    <article
      className={[
        'group flex h-full flex-col overflow-hidden rounded-md bg-white motion-safe:transition-colors dark:bg-slate-950/50',
        isSelected
          ? 'ring-1 ring-slate-900 ring-offset-2 ring-offset-slate-50 dark:ring-slate-100 dark:ring-offset-slate-950'
          : 'ring-1 ring-slate-200/60 hover:ring-slate-300/80 dark:ring-slate-800 dark:hover:ring-slate-600',
      ].join(' ')}
    >
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selectionMode ? isSelected : undefined}
        onClick={() => (selectionMode ? onSelect(article.id) : onOpen(article))}
        onKeyDown={handleKeyDown}
        className="flex flex-1 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:focus-visible:ring-slate-200 dark:focus-visible:ring-offset-slate-950"
      >
        <div className="relative aspect-[2/1] w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] font-medium text-slate-400">
              No preview
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col px-3.5 pb-3 pt-3">
          <h2 className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-50">
            {article.title?.trim() || 'Untitled'}
          </h2>
          {article.excerpt?.trim() && (
            <p className="mt-1.5 line-clamp-1 text-xs leading-snug text-slate-500 dark:text-slate-400">
              {article.excerpt.trim()}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-600 dark:text-slate-300">{source}</span>
            <span className="text-slate-300 dark:text-slate-600" aria-hidden>
              ·
            </span>
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
            <span className="text-slate-300 dark:text-slate-600" aria-hidden>
              ·
            </span>
            <span>{published}</span>
            {updated && (
              <>
                <span className="text-slate-300 dark:text-slate-600" aria-hidden>
                  ·
                </span>
                <span>Upd. {updated}</span>
              </>
            )}
          </div>

          {(displayTags.length > 0 || extraTags > 0) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500 dark:text-slate-400">
              {displayTags.map((t) => (
                <span key={t}>{t}</span>
              ))}
              {extraTags > 0 && <span className="text-slate-400 dark:text-slate-500">+{extraTags} more</span>}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-0.5 border-t border-slate-100/90 px-2 py-1.5 dark:border-slate-800/80">
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-7 items-center gap-1 rounded px-2 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 dark:focus-visible:outline-slate-200"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            Source
          </a>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(article);
          }}
          className="inline-flex h-7 items-center rounded px-2 text-[11px] font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:outline-slate-200"
        >
          Open
        </button>
      </div>
    </article>
  );
};
