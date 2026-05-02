import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { parseSlimFeedInline, renderSlimMarkdownLine } from '../slimFeedMarkdown';

describe('parseSlimFeedInline', () => {
  it('parses bold then italic as sibling segments', () => {
    expect(parseSlimFeedInline('**b** _c_')).toEqual([
      { t: 'bold', children: [{ t: 'plain', s: 'b' }] },
      { t: 'plain', s: ' ' },
      { t: 'italic', children: [{ t: 'plain', s: 'c' }] },
    ]);
  });

  it('parses strike', () => {
    const segs = parseSlimFeedInline('~~x~~');
    expect(segs).toEqual([{ t: 'strike', children: [{ t: 'plain', s: 'x' }] }]);
  });
});

describe('renderSlimMarkdownLine', () => {
  it('linkifies URLs inside italic', () => {
    render(<div>{renderSlimMarkdownLine('*see https://a.com/b*', 0)}</div>);
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://a.com/b');
  });
});
