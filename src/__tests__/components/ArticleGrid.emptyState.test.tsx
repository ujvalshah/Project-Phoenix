import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ArticleGrid } from '@/components/ArticleGrid';

describe('ArticleGrid empty-state rendering', () => {
  it('does not show empty state while feed refetch is in progress', () => {
    render(
      <MemoryRouter>
        <ArticleGrid
          articles={[]}
          viewMode="grid"
          isLoading={false}
          isFeedRefetching
          onArticleClick={() => undefined}
          onCategoryClick={() => undefined}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Refreshing feed/i)).toBeInTheDocument();
    expect(screen.queryByText(/No nuggets found/i)).not.toBeInTheDocument();
  });
});
