import { describe, expect, it } from 'vitest';
import { contentHasMarkdownTable } from '../contentHasMarkdownTable';

describe('contentHasMarkdownTable', () => {
  it('returns false for plain prose', () => {
    expect(contentHasMarkdownTable('Hello **world**\n')).toBe(false);
  });

  it('detects a GFM-style pipe table', () => {
    const md = `| Col A | Col B |
| --- | --- |
| x | y |`;
    expect(contentHasMarkdownTable(md)).toBe(true);
  });
});
