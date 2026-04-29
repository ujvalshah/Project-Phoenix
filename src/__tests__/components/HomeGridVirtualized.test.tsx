import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Article } from '@/types';
import {
  HomeGridVirtualized,
  type HomeGridVirtualizedApi,
} from '@/components/feed/HomeGridVirtualized';

const scrollToIndex = vi.fn();

vi.mock('@/components/NewsCard', () => ({
  NewsCard: ({ article }: { article: Article }) => (
    <div data-testid={`card-${article.id}`}>{article.title ?? article.id}</div>
  ),
}));

let virtualizerRowCount = 0;
let virtualItems: Array<{ index: number; key: string; start: number }> = [];

vi.mock('@tanstack/react-virtual', () => ({
  useWindowVirtualizer: (opts: { count: number }) => {
    virtualizerRowCount = opts.count;
    return {
      getVirtualItems: () => virtualItems,
      getTotalSize: () => Math.max(1, virtualizerRowCount) * 300,
      measureElement: vi.fn(),
      scrollToIndex,
      measure: vi.fn(),
    };
  },
}));

function makeArticle(id: string): Article {
  return {
    id,
    title: `Title ${id}`,
    excerpt: 'e',
    content: 'c',
    author: { id: 'u', name: 'Author' },
    tags: [],
    readTime: 1,
  };
}

describe('HomeGridVirtualized', () => {
  beforeEach(() => {
    scrollToIndex.mockClear();
    virtualizerRowCount = 0;
    virtualItems = [{ index: 0, key: 'row-0', start: 0 }];
  });

  it('passes row count to virtualizer from chunked grid', () => {
    const articles = [makeArticle('1'), makeArticle('2'), makeArticle('3')];
    const apiRef: React.MutableRefObject<HomeGridVirtualizedApi | null> = { current: null };
    render(
      <HomeGridVirtualized
        displayArticles={articles}
        columnCount={2}
        shouldAnimate={false}
        staggerCapIndex={20}
        onCategoryClick={() => undefined}
        onCardClick={() => undefined}
        disableInlineExpansion={false}
        registerCard={() => undefined}
        scrollMarginTop={0}
        apiRef={apiRef}
      />,
    );
    expect(virtualizerRowCount).toBe(2);
  });

  it('only renders cards for virtual rows returned by getVirtualItems', () => {
    const articles = [
      makeArticle('a'),
      makeArticle('b'),
      makeArticle('c'),
      makeArticle('d'),
    ];
    virtualItems = [{ index: 0, key: 'row-0', start: 0 }];
    const apiRef: React.MutableRefObject<HomeGridVirtualizedApi | null> = { current: null };
    render(
      <HomeGridVirtualized
        displayArticles={articles}
        columnCount={2}
        shouldAnimate={false}
        staggerCapIndex={20}
        onCategoryClick={() => undefined}
        onCardClick={() => undefined}
        disableInlineExpansion={false}
        registerCard={() => undefined}
        scrollMarginTop={0}
        apiRef={apiRef}
      />,
    );
    expect(screen.getByTestId('card-a')).toBeInTheDocument();
    expect(screen.getByTestId('card-b')).toBeInTheDocument();
    expect(screen.queryByTestId('card-c')).not.toBeInTheDocument();
    expect(screen.queryByTestId('card-d')).not.toBeInTheDocument();
  });

  it('scrollToFlatArticleIndex scrolls to the correct row', () => {
    const articles = [makeArticle('1'), makeArticle('2'), makeArticle('3')];
    const apiRef: React.MutableRefObject<HomeGridVirtualizedApi | null> = { current: null };
    render(
      <HomeGridVirtualized
        displayArticles={articles}
        columnCount={2}
        shouldAnimate={false}
        staggerCapIndex={20}
        onCategoryClick={() => undefined}
        onCardClick={() => undefined}
        disableInlineExpansion={false}
        registerCard={() => undefined}
        scrollMarginTop={120}
        apiRef={apiRef}
      />,
    );
    apiRef.current?.scrollToFlatArticleIndex(2);
    expect(scrollToIndex).toHaveBeenCalledWith(1, { align: 'nearest' });
  });

  it('subtracts scrollMarginTop from row translateY to avoid top spacer', () => {
    const articles = [makeArticle('1'), makeArticle('2')];
    virtualItems = [{ index: 0, key: 'row-0', start: 240 }];
    const apiRef: React.MutableRefObject<HomeGridVirtualizedApi | null> = { current: null };
    const { container } = render(
      <HomeGridVirtualized
        displayArticles={articles}
        columnCount={2}
        shouldAnimate={false}
        staggerCapIndex={20}
        onCategoryClick={() => undefined}
        onCardClick={() => undefined}
        disableInlineExpansion={false}
        registerCard={() => undefined}
        scrollMarginTop={200}
        apiRef={apiRef}
      />,
    );
    const row = container.querySelector('[data-virtual-row="0"]') as HTMLDivElement;
    expect(row.style.transform).toBe('translateY(40px)');
  });
});
