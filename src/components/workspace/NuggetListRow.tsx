import React from 'react';
import { ExternalLink, Globe, Lock, Pencil, Trash2 } from 'lucide-react';
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
  canManage?: boolean;
  onEdit?: (article: Article) => void;
  onDelete?: (article: Article) => void;
}

const TAG_CAP = (compact: boolean) => (compact ? 1 : 2);

export const NuggetListRow: React.FC<NuggetListRowProps> = ({
  article,
  selectionMode,
  isSelected,
  onSelect,
  onOpen,
  compact = false,
  canManage = false,
  onEdit,
  onDelete,
}) => {
  const [showAllTags, setShowAllTags] = React.useState(false);
  const thumb = getThumbnailUrl(article);
  const source = getNuggetSourceLabel(article);
  const href = getNuggetPrimaryHref(article);
  const vis = article.visibility ?? 'private';
  const tags = Array.from(
    new Set(
      (article.tags ?? [])
        .map((t) => t?.trim())
        .filter((t): t is string => Boolean(t)),
    ),
  );
  const cap = TAG_CAP(compact);
  const extraTags = Math.max(0, tags.length - cap);
  const displayTags = showAllTags ? tags : tags.slice(0, cap);

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

  const thumbBox = compact ? 'h-11 w-16 shrink-0' : 'h-[3.5rem] w-[6rem] shrink-0';

  return (
    <article
      className={[
        'rounded-xl border bg-white shadow-sm transition-shadow duration-200 hover:shadow-md dark:bg-slate-900/80',
        isSelected
          ? 'border-primary-500 ring-1 ring-primary-500'
          : 'border-slate-200 dark:border-slate-700',
      ].join(' ')}
    >
      <div
        className={`flex gap-3 ${compact ? 'p-2.5' : 'p-3.5'}`}
        role="button"
        tabIndex={0}
        aria-pressed={selectionMode ? isSelected : undefined}
        onClick={() => (selectionMode ? onSelect(article.id) : onOpen(article))}
        onKeyDown={handleKeyDown}
      >
        <div className={`relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900 ${thumbBox}`}>
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">—</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">
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
              compact ? 'line-clamp-1 text-sm leading-[1.35]' : 'line-clamp-2 text-[0.9375rem] leading-[1.35]'
            }`}
          >
            {article.title?.trim() || 'Untitled'}
          </h2>
          {!compact && article.excerpt?.trim() && (
            <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{article.excerpt.trim()}</p>
          )}
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
                  {showAllTags ? 'Show less' : `+${extraTags}`}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 self-stretch items-end justify-end gap-1 pb-0.5">
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hidden min-h-[32px] min-w-[32px] items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:inline-flex dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
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
            className="inline-flex min-h-[32px] items-center rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Open
          </button>
          {canManage && onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(article);
              }}
              className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          {canManage && onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(article);
              }}
              className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:border-red-800/60 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
