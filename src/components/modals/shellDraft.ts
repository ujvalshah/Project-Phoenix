import type { Article } from '@/types';

/**
 * Minimal fields for instant modal shell paint — no full Article / media graph.
 * @see docs/refactor-log/create-modal/01-data-contract.md
 */
export type ShellDraft = {
  /** Article id when editing; empty string for create */
  id: string;
  title: string;
  excerpt: string;
  /** Lifecycle shown in shell chrome / footer (edit only; create uses submit intent) */
  status: 'draft' | 'published';
  visibility: 'public' | 'private';
  /** Optional card thumbnail for shell preview */
  coverImageUrl?: string | null;
};

/**
 * Body + tag identifiers for the deferred composer island (no media graph).
 * Full `Article` remains the integration fallback until AdvancedDetail split.
 */
export type ContentDraft = {
  content: string;
  tags: string[];
  tagIds: string[];
};

export function emptyShellDraft(): ShellDraft {
  return {
    id: '',
    title: '',
    excerpt: '',
    status: 'published',
    visibility: 'public',
    coverImageUrl: null,
  };
}

function pickCoverImageUrl(article: Article): string | null {
  const primary = article.primaryMedia?.url;
  if (primary) return primary;
  const legacy = article.media?.url;
  if (legacy) return legacy;
  const img0 = article.images?.[0];
  if (img0) return img0;
  return null;
}

function lifecycleFromArticle(a: Article | undefined): 'draft' | 'published' {
  return a?.status === 'draft' ? 'draft' : 'published';
}

/**
 * Derive shell summary from a full article (edit source or duplicate prefill).
 */
export function articleToShellDraft(article: Article | undefined, mode: 'create' | 'edit'): ShellDraft {
  if (!article) {
    return emptyShellDraft();
  }
  const visibility = (article.visibility ?? 'public') as 'public' | 'private';
  return {
    id: mode === 'edit' ? article.id : '',
    title: article.title ?? '',
    excerpt: article.excerpt ?? '',
    status: lifecycleFromArticle(article),
    visibility,
    coverImageUrl: pickCoverImageUrl(article),
  };
}

/**
 * Map `initialData` / `prefillData` into shell state at the loadable boundary.
 */
export function shellDraftFromModalProps(params: {
  mode: 'create' | 'edit';
  initialData?: Article;
  prefillData?: Article;
}): ShellDraft {
  const { mode, initialData, prefillData } = params;
  if (mode === 'edit' && initialData) {
    return articleToShellDraft(initialData, 'edit');
  }
  if (mode === 'create' && prefillData) {
    return articleToShellDraft(prefillData, 'create');
  }
  return emptyShellDraft();
}

export function articleToContentDraft(article: Article | undefined): ContentDraft {
  if (!article) {
    return { content: '', tags: [], tagIds: [] };
  }
  return {
    content: article.content ?? '',
    tags: Array.isArray(article.tags) ? [...article.tags] : [],
    tagIds: Array.isArray(article.tagIds) ? [...article.tagIds] : [],
  };
}

/** Phase 3 (v2): prefer `ContentDraft` body when non-empty; else article. Legacy: always article body. */
export function pickComposerInitialContent(
  composerHydrationV2: boolean,
  draft: ContentDraft,
  articleContent: string | undefined,
): string {
  if (!composerHydrationV2) {
    return articleContent ?? '';
  }
  return draft.content !== '' ? draft.content : (articleContent ?? '');
}

/** Phase 3 (v2): prefer `ContentDraft` tags when non-empty; else article. Legacy: always article tag ids. */
export function pickComposerInitialTagIds(
  composerHydrationV2: boolean,
  draft: ContentDraft,
  articleTagIds: string[] | undefined,
): string[] {
  if (!composerHydrationV2) {
    return [...(articleTagIds ?? [])];
  }
  return draft.tagIds.length > 0 ? [...draft.tagIds] : [...(articleTagIds ?? [])];
}
