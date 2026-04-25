import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const { articleFindById, collectionFindById } = vi.hoisted(() => ({
  articleFindById: vi.fn(),
  collectionFindById: vi.fn(),
}));

vi.mock('../models/Article.js', () => ({
  Article: {
    findById: articleFindById,
  },
}));

vi.mock('../models/Collection.js', () => ({
  Collection: {
    findById: collectionFindById,
  },
}));

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { ogMiddleware } from '../middleware/ogMiddleware.js';

function createMockReq(overrides: Partial<Request> = {}): Request {
  const req = {
    method: 'GET',
    path: '/article/507f1f77bcf86cd799439011',
    protocol: 'https',
    headers: { 'user-agent': 'WhatsApp/2.23' },
    get: (key: string) => (key.toLowerCase() === 'host' ? 'ignored.example' : undefined),
    ...overrides,
  } as unknown as Request;
  return req;
}

function createMockRes() {
  const res = {
    set: vi.fn(),
    status: vi.fn(),
    type: vi.fn(),
    send: vi.fn(),
  } as unknown as Response;

  (res.status as any).mockReturnValue(res);
  (res.type as any).mockReturnValue(res);

  return res;
}

describe('ogMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PUBLIC_SITE_URL;
    delete process.env.FRONTEND_URL;
  });

  it('uses canonical env origin and metadata title fallback for article OG', async () => {
    process.env.PUBLIC_SITE_URL = 'https://nuggets.one/';
    articleFindById.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: '507f1f77bcf86cd799439011',
          title: '',
          excerpt: '',
          content: 'Longer content fallback',
          visibility: 'public',
          media: { previewMetadata: { title: 'Metadata Title' } },
          created_at: '2026-01-01T00:00:00.000Z',
        }),
    });

    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    ogMiddleware(req, res, next);
    await Promise.resolve();
    await Promise.resolve();

    expect(res.status).toHaveBeenCalledWith(200);
    const html = (res.send as any).mock.calls[0][0] as string;
    expect(html).toContain('Metadata Title');
    expect(html).toContain('https://nuggets.one/article/507f1f77bcf86cd799439011');
    expect(html).toContain('https://nuggets.one/og-default.png');
    expect(next).not.toHaveBeenCalled();
  });
});

