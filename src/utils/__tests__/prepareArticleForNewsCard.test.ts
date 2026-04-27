import { describe, expect, it } from 'vitest';
import { hasValidAuthor, prepareArticleForNewsCard } from '@/utils/errorHandler';

describe('prepareArticleForNewsCard', () => {
  it('returns null for null/undefined input', () => {
    expect(prepareArticleForNewsCard(null)).toBeNull();
    expect(prepareArticleForNewsCard(undefined)).toBeNull();
  });

  it('normalizes author and satisfies hasValidAuthor', () => {
    const raw = {
      id: 'n1',
      title: 'T',
      author: { id: 'a1', name: 'Alice' },
    };
    const p = prepareArticleForNewsCard(raw);
    expect(p).not.toBeNull();
    expect(hasValidAuthor(p)).toBe(true);
    expect(p.id).toBe('n1');
  });

});
