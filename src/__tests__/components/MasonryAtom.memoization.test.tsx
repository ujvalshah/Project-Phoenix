import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useCallback, useMemo, useState } from 'react';
import type { Article, ExternalLink, PreviewMetadata, PrimaryMedia } from '@/types';
import type { MasonryMediaItem } from '@/utils/masonryMediaHelper';

let mediaRenderCount = 0;

vi.mock('@/components/masonry/MediaBlock', () => ({
  MediaBlock: () => {
    mediaRenderCount += 1;
    return <div data-testid="mock-masonry-media-block" />;
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/context/AuthContext', () => ({
  shallowEqualAuth: (a: unknown, b: unknown) => a === b,
  useAuthSelector: (sel: (s: { user: { id: string } | null }) => unknown) =>
    sel({ user: { id: 'u1' } }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('@/hooks/useMasonryInteraction', () => ({
  useMasonryInteraction: () => ({
    handleClick: vi.fn(),
    showCollectionPopover: false,
    setShowCollectionPopover: vi.fn(),
    collectionAnchor: null,
    setCollectionAnchor: vi.fn(),
    showReportModal: false,
    setShowReportModal: vi.fn(),
    showEditModal: false,
    setShowEditModal: vi.fn(),
  }),
}));

vi.mock('@/components/CollectionPopover', () => ({
  CollectionPopover: () => null,
}));

vi.mock('@/components/ReportModal', () => ({
  ReportModal: () => null,
}));

vi.mock('@/components/CreateNuggetModalLoadable', () => ({
  CreateNuggetModalLoadable: () => null,
}));

import { MasonryAtom } from '@/components/masonry/MasonryAtom';

const makePrimaryImageMedia = (previewUrl: string): PrimaryMedia => ({
  type: 'image',
  url: 'https://example.com/image.jpg',
  thumbnail: 'https://example.com/thumb.jpg',
  showInMasonry: true,
  showInGrid: true,
  masonryTitle: 'Masonry caption',
  previewMetadata: { url: previewUrl } as PreviewMetadata,
});

const makeArticle = (opts: {
  externalUrl?: string;
  previewUrl: string;
}): Article => {
  const externalLinks: ExternalLink[] | undefined = opts.externalUrl
    ? [
        {
          id: 'ext-1',
          url: opts.externalUrl,
          isPrimary: true,
        },
      ]
    : undefined;

  return {
    id: 'article-1',
    title: 'Test Article',
    excerpt: 'ex',
    content: 'content',
    author: { id: 'u1', name: 'Author', avatar_url: 'https://example.com/avatar.jpg' },
    publishedAt: '2024-01-01T00:00:00.000Z',
    tags: ['tag-1'],
    readTime: 3,
    visibility: 'public',
    primaryMedia: makePrimaryImageMedia(opts.previewUrl),
    externalLinks,
  };
};

const tileItem: MasonryMediaItem = {
  id: 'primary',
  type: 'image',
  url: 'https://example.com/image.jpg',
  thumbnail: 'https://example.com/thumb.jpg',
  source: 'primary',
  showInMasonry: true,
  showInGrid: true,
  isLocked: false,
  masonryTitle: 'Masonry caption',
};

function ParentStableTile({ article }: { article: Article }) {
  const [, setTick] = useState(0);
  const onArticleClick = useCallback(() => {}, []);
  const onCategoryClick = useCallback(() => {}, []);
  const prefetched = useMemo(() => [tileItem], []);

  return (
    <>
      <button type="button" data-testid="bump-parent" onClick={() => setTick((n) => n + 1)}>
        bump
      </button>
      <MasonryAtom
        article={article}
        mediaItemId="primary"
        tileMediaItem={tileItem}
        prefetchedAllMasonryItems={prefetched}
        onArticleClick={onArticleClick}
        onCategoryClick={onCategoryClick}
      />
    </>
  );
}

describe('MasonryAtom memoization', () => {
  beforeEach(() => {
    mediaRenderCount = 0;
  });

  it('skips MediaBlock render when a parent re-renders with the same tile props', () => {
    const article = makeArticle({ previewUrl: 'https://preview.example.com/original' });
    render(<ParentStableTile article={article} />);

    const countAfterMount = mediaRenderCount;
    expect(countAfterMount).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('mock-masonry-media-block')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('bump-parent'));
    expect(mediaRenderCount).toBe(countAfterMount);
  });

  it('re-renders MediaBlock when the article reference changes', () => {
    const a1 = makeArticle({ previewUrl: 'https://one.example.com/p.png' });
    const a2 = makeArticle({ previewUrl: 'https://two.example.com/p.png' });

    const { rerender } = render(<ParentStableTile article={a1} />);
    const afterFirstArticle = mediaRenderCount;

    rerender(<ParentStableTile article={a2} />);
    expect(mediaRenderCount).toBeGreaterThan(afterFirstArticle);
  });
});
