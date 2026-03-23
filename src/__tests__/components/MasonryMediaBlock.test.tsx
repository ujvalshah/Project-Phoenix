import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Article, ExternalLink, PreviewMetadata, PrimaryMedia } from '@/types';

// ---------------------------------------------------------------------------
// Mocks: keep MasonryAtom light and deterministic
// ---------------------------------------------------------------------------
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    currentUser: { id: 'u1', role: 'user', name: 'Author' },
  }),
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

vi.mock('@/components/CreateNuggetModal', () => ({
  CreateNuggetModal: () => null,
}));

vi.mock('@/components/ImageLightbox', () => ({
  ImageLightbox: ({ isOpen }: { isOpen: boolean }) => {
    if (!isOpen) return null;
    return <div data-testid="image-lightbox" />;
  },
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

describe('Masonry MediaBlock thumbnail overlay', () => {
  beforeEach(() => {
    (window as any).open = vi.fn();
  });

  it('renders a "Source" button when primary externalLinks exists', () => {
    const externalUrl = 'https://external.example.com/source';
    const previewUrl = 'https://preview.example.com/original';

    const article = makeArticle({ externalUrl, previewUrl });
    render(
      <MasonryAtom
        article={article}
        mediaItemId="primary"
        onArticleClick={vi.fn()}
        onCategoryClick={vi.fn()}
      />
    );

    // Trigger ActionHUD visibility (focus capture on the tile subtree)
    fireEvent.focus(screen.getByRole('button', { name: /view image in gallery/i }));

    const button = screen.getByRole('button', { name: /open source in new tab/i });
    expect(button).toHaveTextContent('Source');

    fireEvent.click(button);
    expect((window as any).open).toHaveBeenCalledWith(externalUrl, '_blank', 'noopener,noreferrer');

    // Click isolation: should not open lightbox just by clicking overlay
    expect(screen.queryByTestId('image-lightbox')).toBeNull();
  });

  it('renders a "Source" button when externalLinks is missing', () => {
    const previewUrl = 'https://preview.example.com/original';
    const article = makeArticle({ previewUrl });

    render(
      <MasonryAtom
        article={article}
        mediaItemId="primary"
        onArticleClick={vi.fn()}
        onCategoryClick={vi.fn()}
      />
    );

    fireEvent.focus(screen.getByRole('button', { name: /view image in gallery/i }));

    const button = screen.getByRole('button', { name: /open source in new tab/i });
    expect(button).toBeTruthy();

    fireEvent.click(button);
    expect((window as any).open).toHaveBeenCalledWith(previewUrl, '_blank', 'noopener,noreferrer');

    // Click isolation: should not open lightbox just by clicking overlay
    expect(screen.queryByTestId('image-lightbox')).toBeNull();
  });
});

