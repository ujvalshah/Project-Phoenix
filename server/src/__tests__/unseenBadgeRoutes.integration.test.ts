import '../loadEnv.js';
import { validateEnv } from '../config/envValidation.js';

validateEnv();

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createArticlesApiApp } from './helpers/articlesApiApp.js';
import { tryConnectIntegrationMongo, disconnectIntegrationMongo } from './helpers/integrationMongo.js';
import { User } from '../models/User.js';
import { Article } from '../models/Article.js';
import { generateAccessToken } from '../utils/jwt.js';

let mongoOk = false;
let app: ReturnType<typeof createArticlesApiApp>;

function stamp(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function createTestUser(): Promise<string> {
  const s = stamp();
  const now = new Date().toISOString();
  const email = `badge-${s}@route-test.local`;
  const username = `badge${s.replace(/-/g, '')}`;
  const user = await User.create({
    role: 'user',
    auth: {
      email,
      emailVerified: true,
      provider: 'email',
      createdAt: now,
    },
    profile: {
      displayName: username,
      username,
    },
    security: { mfaEnabled: false },
    preferences: {
      theme: 'system',
      interestedCategories: [],
      notifications: {
        emailDigest: true,
        productUpdates: false,
        newFollowers: true,
        pushEnabled: false,
        frequency: 'instant',
        categoryFilter: [],
      },
    },
    appState: { onboardingCompleted: true },
  });
  return user._id.toString();
}

async function createArticleDoc(params: {
  authorId: string;
  contentStream?: 'standard' | 'pulse' | 'both';
  visibility?: 'public' | 'private';
  publishedAt?: string;
  readBy?: Record<string, boolean>;
}) {
  const now = params.publishedAt ?? new Date().toISOString();
  return Article.create({
    title: `Badge Article ${stamp()}`,
    content: 'badge test',
    authorId: params.authorId,
    authorName: 'Badge Test Author',
    publishedAt: now,
    ...(params.contentStream ? { contentStream: params.contentStream } : {}),
    ...(params.visibility ? { visibility: params.visibility } : {}),
    ...(params.readBy ? { readBy: params.readBy } : {}),
  });
}

describe('Unseen badge routes integration', () => {
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
    await Promise.all([
      User.deleteMany({ 'auth.email': { $regex: /@route-test\.local$/ } }),
      Article.deleteMany({ authorName: 'Badge Test Author' }),
    ]);
  });

  it('logged-out user gets no unseen counts', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const res = await request(app).get('/api/articles/unseen-counts');
    expect(res.status).toBe(401);
  });

  it('logged-in user with zero unseen returns no badge counts', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const userId = await createTestUser();
    const token = generateAccessToken(userId, 'user');

    const res = await request(app)
      .get('/api/articles/unseen-counts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ home: 0, marketPulse: 0 });
  });

  it('counts unseen only in Home feed', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const userId = await createTestUser();
    const token = generateAccessToken(userId, 'user');

    await createArticleDoc({ authorId: userId, contentStream: 'standard' });
    await createArticleDoc({ authorId: userId, contentStream: 'pulse', readBy: { [userId]: true } });

    const res = await request(app)
      .get('/api/articles/unseen-counts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.home).toBe(1);
    expect(res.body.marketPulse).toBe(0);
  });

  it('counts unseen only in Market Pulse feed', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const userId = await createTestUser();
    const token = generateAccessToken(userId, 'user');

    await createArticleDoc({ authorId: userId, contentStream: 'pulse' });
    await createArticleDoc({ authorId: userId, contentStream: 'standard', readBy: { [userId]: true } });

    const res = await request(app)
      .get('/api/articles/unseen-counts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.home).toBe(0);
    expect(res.body.marketPulse).toBe(1);
  });

  it('counts unseen in both feeds independently and reduces after mark-seen', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const userId = await createTestUser();
    const token = generateAccessToken(userId, 'user');

    await createArticleDoc({ authorId: userId, contentStream: 'both' });
    await createArticleDoc({ authorId: userId, contentStream: 'standard' });
    await createArticleDoc({ authorId: userId, contentStream: 'pulse' });

    const before = await request(app)
      .get('/api/articles/unseen-counts')
      .set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);
    expect(before.body).toEqual({ home: 2, marketPulse: 2 });

    const markHome = await request(app)
      .post('/api/articles/mark-seen')
      .set('Authorization', `Bearer ${token}`)
      .send({ feed: 'home' });
    expect(markHome.status).toBe(200);

    const afterHome = await request(app)
      .get('/api/articles/unseen-counts')
      .set('Authorization', `Bearer ${token}`);
    expect(afterHome.body).toEqual({ home: 0, marketPulse: 2 });

    const markPulse = await request(app)
      .post('/api/articles/mark-seen')
      .set('Authorization', `Bearer ${token}`)
      .send({ feed: 'market-pulse' });
    expect(markPulse.status).toBe(200);

    const afterBoth = await request(app)
      .get('/api/articles/unseen-counts')
      .set('Authorization', `Bearer ${token}`);
    expect(afterBoth.body).toEqual({ home: 0, marketPulse: 0 });
  });

  it('already-seen or old unseen behavior follows per-user unseen rules', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const userId = await createTestUser();
    const token = generateAccessToken(userId, 'user');

    await createArticleDoc({
      authorId: userId,
      contentStream: 'standard',
      readBy: { [userId]: true },
    });
    await createArticleDoc({
      authorId: userId,
      contentStream: 'standard',
      publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });

    const res = await request(app)
      .get('/api/articles/unseen-counts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.home).toBe(1);
    expect(res.body.marketPulse).toBe(0);
  });
});
