import { describe, it, expect } from 'vitest';
import type { Article } from '@/types';
import {
  articleToContentDraft,
  articleToShellDraft,
  emptyShellDraft,
  shellDraftFromModalProps,
} from '../shellDraft';

const baseArticle = (): Article => ({
  id: 'a1',
  title: 'T',
  excerpt: 'E',
  content: 'Body',
  author: { id: 'u1', name: 'U' },
  tags: ['legacy'],
  readTime: 1,
  tagIds: ['tid1', 'tid2'],
  visibility: 'private',
  status: 'draft',
});

describe('shellDraft mappers', () => {
  it('articleToContentDraft copies content, tags, tagIds', () => {
    const a = baseArticle();
    expect(articleToContentDraft(a)).toEqual({
      content: 'Body',
      tags: ['legacy'],
      tagIds: ['tid1', 'tid2'],
    });
  });

  it('articleToContentDraft handles undefined', () => {
    expect(articleToContentDraft(undefined)).toEqual({
      content: '',
      tags: [],
      tagIds: [],
    });
  });

  it('shellDraftFromModalProps edit uses initialData', () => {
    const a = baseArticle();
    const s = shellDraftFromModalProps({ mode: 'edit', initialData: a });
    expect(s.id).toBe('a1');
    expect(s.title).toBe('T');
    expect(s.excerpt).toBe('E');
    expect(s.status).toBe('draft');
    expect(s.visibility).toBe('private');
  });

  it('shellDraftFromModalProps create + prefill uses prefill only', () => {
    const a = baseArticle();
    const s = shellDraftFromModalProps({ mode: 'create', prefillData: a });
    expect(s.id).toBe('');
    expect(s.title).toBe('T');
  });

  it('shellDraftFromModalProps create empty when no prefill', () => {
    expect(shellDraftFromModalProps({ mode: 'create' })).toEqual(emptyShellDraft());
  });

  it('articleToShellDraft edit keeps id', () => {
    const s = articleToShellDraft(baseArticle(), 'edit');
    expect(s.id).toBe('a1');
  });

  it('articleToShellDraft create clears id', () => {
    const s = articleToShellDraft(baseArticle(), 'create');
    expect(s.id).toBe('');
  });
});
