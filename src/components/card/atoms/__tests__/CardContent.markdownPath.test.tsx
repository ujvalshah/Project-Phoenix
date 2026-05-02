import { beforeAll, describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { CardContent } from '../CardContent';

describe('CardContent markdown path selection', () => {
  /** Preloads the lazily chunked MarkdownRenderer used inside CardContent (Suspense resolves in jsdom). */
  beforeAll(async () => {
    await import('@/components/MarkdownRenderer');
  });
  it('uses lightweight excerpt for collapsed body without a table (no GFM root)', () => {
    const { container } = render(
      <CardContent
        excerpt=""
        content={'Plain text with **no** table\n\nLine 2'}
        isTextNugget
        variant="grid"
        allowExpansion
      />,
    );
    expect(container.querySelector('.markdown-content')).toBeNull();
  });

  it('loads full markdown for pipe tables (GFM)', async () => {
    const tableMd = `| A | B |
| --- | --- |
| 1 | 2 |`;
    const { container } = render(
      <CardContent
        excerpt=""
        content={tableMd}
        isTextNugget
        variant="grid"
        allowExpansion={false}
      />,
    );
    await waitFor(
      () => {
        expect(container.querySelector('.markdown-content')).not.toBeNull();
      },
      { timeout: 4000 },
    );
  });
});
