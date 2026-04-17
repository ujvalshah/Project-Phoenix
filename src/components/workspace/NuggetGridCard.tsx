import React, { useMemo, useState } from 'react';
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
  const [showAllTags, setShowAllTags] = useState(false);
  const thumb = getThumbnailUrl(article);
  const source = getNuggetSourceLabel(article);
  const href = getNuggetPrimaryHref(article);
  const vis = article.visibility ?? 'private';
  const tags = useMemo(
    () =>
      Array.from(
        new Set(
          (article.tags ?? [])
            .map((t) => t?.trim())
            .filter((t): t is string => Boolean(t)),
        ),
      ),
    [article.tags],
  );
  const extraTags = Math.max(0, tags.length - MAX_TAGS);
  const displayTags = showAllTags ? tags : tags.slice(0, MAX_TAGS);

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
        'group flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow duration-200 hover:shadow-md dark:bg-slate-900/80',
        isSelected
          ? 'border-primary-500 ring-1 ring-primary-500'
          : 'border-slate-200 dark:border-slate-700',
      ].join(' ')}
    >
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selectionMode ? isSelected : undefined}
        onClick={() => (selectionMode ? onSelect(article.id) : onOpen(article))}
        onKeyDown={handleKeyDown}
        className="flex flex-1 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-slate-100 dark:bg-slate-900">
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] font-medium text-slate-400">
              No preview
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 px-4 pb-2.5 pt-3">
          <h2 className="line-clamp-2 text-[0.9375rem] font-semibold leading-[1.35] tracking-tight text-slate-900 dark:text-slate-50">
            {article.title?.trim() || 'Untitled'}
          </h2>
          {article.excerpt?.trim() && (
            <p className="mt-1.5 line-clamp-1 text-xs leading-snug text-slate-500 dark:text-slate-400">
              {article.excerpt.trim()}
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
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
            <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
              {displayTags.map((t) => (
                <span key={t} className="rounded-full bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800/80">
                  {t}
                </span>
              ))}
              {extraTags > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllTags((prev) => !prev);
                  }}
                  className="text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  aria-label={showAllTags ? 'Collapse tags' : `View ${extraTags} more tags`}
                >
                  {showAllTags ? 'Show less' : `+${extraTags} more`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-3 py-2 dark:border-slate-800">
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
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
          className="inline-flex min-h-[32px] items-center rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Open
        </button>
      </div>
    </article>
  );
};
