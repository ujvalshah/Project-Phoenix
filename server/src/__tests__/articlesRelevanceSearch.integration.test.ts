import '../loadEnv.js';
import { validateEnv } from '../config/envValidation.js';

validateEnv();

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createArticlesApiApp } from './helpers/articlesApiApp.js';
import { tryConnectIntegrationMongo, disconnectIntegrationMongo } from './helpers/integrationMongo.js';
import { Article } from '../models/Article.js';

let mongoOk = false;
let app: ReturnType<typeof createArticlesApiApp>;

function stamp(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

describe('Articles relevance search regression', () => {
  beforeAll(async () => {
    mongoOk = await tryConnectIntegrationMongo();
    if (mongoOk) {
      app = createArticlesApiApp();
    }
  }, 15000);

  afterAll(async () => {
    await disconnectIntegrationMongo();
  });

  beforeEach(async (ctx) => {
    if (!mongoOk) {
      ctx.skip();
      return;
    }
    await Article.deleteMany({ title: { $regex: /^Iconiq (Regression|Hybrid) RouteTest/ } });
  });

  it('returns 200 and non-empty payload for q=iconiq in relevance mode', async (ctx) => {
    if (!mongoOk) ctx.skip();

    const now = new Date().toISOString();
    await Article.create({
      title: `Iconiq Regression RouteTest ${stamp()}`,
      excerpt: 'iconiq relevance integration coverage',
      content: 'iconiq relevance integration coverage content',
      authorId: 'route-test-author',
      authorName: 'Route Test',
      publishedAt: now,
      visibility: 'public',
      tags: ['iconiq'],
      source_type: 'text',
    });

    const res = await request(app).get('/api/articles').query({
      q: 'iconiq',
      searchMode: 'relevance',
      page: 1,
      limit: 25,
      contentStream: 'standard',
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('hybrid mode falls back to partial regex matches without breaking committed search', async (ctx) => {
    if (!mongoOk) ctx.skip();

    const now = new Date().toISOString();
    const title = `Iconiq Hybrid RouteTest ${stamp()}`;
    await Article.create({
      title,
      excerpt: 'hybrid fallback coverage',
      content: 'hybrid fallback coverage content',
      authorId: 'route-test-author',
      authorName: 'Route Test',
      publishedAt: now,
      visibility: 'public',
      tags: ['iconiq'],
      source_type: 'text',
    });

    const hybrid = await request(app).get('/api/articles').query({
      q: 'oniq',
      searchMode: 'hybrid',
      page: 1,
      limit: 25,
      contentStream: 'standard',
    });

    const relevance = await request(app).get('/api/articles').query({
      q: 'oniq',
      searchMode: 'relevance',
      page: 1,
      limit: 25,
      contentStream: 'standard',
    });

    expect(hybrid.status).toBe(200);
    expect(Array.isArray(hybrid.body?.data)).toBe(true);
    expect(hybrid.body.data.length).toBeGreaterThan(0);
    expect(hybrid.body.data.some((doc: { title?: string }) => doc?.title === title)).toBe(true);

    expect(relevance.status).toBe(200);
    expect(Array.isArray(relevance.body?.data)).toBe(true);
    expect(relevance.body.data.some((doc: { title?: string }) => doc?.title === title)).toBe(false);
  });
});
