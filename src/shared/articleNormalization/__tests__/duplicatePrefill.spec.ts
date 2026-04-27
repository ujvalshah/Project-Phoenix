import { describe, expect, it } from 'vitest';
import type { Article } from '@/types';
import { buildDuplicatePrefill } from '../duplicatePrefill';

function buildArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'article-1',
    title: 'Original title',
    excerpt: 'Original excerpt',
    content: 'Original content',
    author: { id: 'author-1', name: 'Author' },
    tags: ['market'],
    readTime: 1,
    visibility: 'private',
    status: 'published',
    publishedAt: '2026-01-01T10:00:00.000Z',
    created_at: '2026-01-01T09:00:00.000Z',
    updated_at: '2026-01-01T09:30:00.000Z',
    mediaIds: ['m-1', 'm-2'],
    externalLinks: [
      {
        id: 'link-old',
        url: 'https://example.com/story',
        isPrimary: true,
        addedAt: '2026-01-01T09:15:00.000Z',
      },
    ],
    ...overrides,
  };
}

describe('buildDuplicatePrefill', () => {
  it('strips identity/system fields and resets lifecycle state', () => {
    const source = buildArticle();
    const { article } = buildDuplicatePrefill(source);

    expect(article.id).not.toBe(source.id);
    expect(article.title).toBe('Original title (Copy)');
    expect(article.status).toBe('draft');
    expect(article.publishedAt).toBeNull();
    expect(article.created_at).toBeUndefined();
    expect(article.updated_at).toBeUndefined();
    expect(article.mediaIds).toBeUndefined();
    expect(article.displayImageIndex).toBeUndefined();
  });

  it('regenerates external link ids/timestamps while preserving content', () => {
    const source = buildArticle({
      externalLinks: [
        { id: 'l1', url: 'https://one.test', isPrimary: false, addedAt: '2025-01-01T00:00:00.000Z' },
        { id: 'l2', url: 'https://two.test', isPrimary: true, addedAt: '2025-01-02T00:00:00.000Z' },
      ],
    });

    const { article } = buildDuplicatePrefill(source);
    expect(article.externalLinks).toBeDefined();
    expect(article.externalLinks?.length).toBe(2);
    expect(article.externalLinks?.[0].id).not.toBe('l1');
    expect(article.externalLinks?.[1].id).not.toBe('l2');
    expect(article.externalLinks?.[0].addedAt).toBeTypeOf('string');
    expect(article.externalLinks?.map((l) => l.url)).toEqual([
      'https://one.test',
      'https://two.test',
    ]);
    expect(article.externalLinks?.some((l) => l.isPrimary)).toBe(true);
  });

  it('collects source urls from media, supporting media, images, and video', () => {
    const source = buildArticle({
      media: {
        type: 'link',
        url: 'https://media.test',
        previewMetadata: { url: 'https://origin.test' },
      },
      supportingMedia: [{ type: 'image', url: 'https://support.test/img.png' }],
      images: ['https://img.test/a.png'],
      video: 'https://youtube.com/watch?v=abc',
    });

    const { sourceUrls } = buildDuplicatePrefill(source);
    expect(sourceUrls).toEqual([
      'https://origin.test',
      'https://media.test',
      'https://youtube.com/watch?v=abc',
      'https://support.test/img.png',
      'https://img.test/a.png',
    ]);
  });

  it('does not append duplicate copy suffix repeatedly', () => {
    const source = buildArticle({ title: 'Original title (Copy)' });
    const { article } = buildDuplicatePrefill(source);
    expect(article.title).toBe('Original title (Copy)');
  });
});

