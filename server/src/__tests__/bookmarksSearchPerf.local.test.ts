import '../loadEnv.js';
import { validateEnv } from '../config/envValidation.js';
import { initLogger } from '../utils/logger.js';

validateEnv();
initLogger();

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createBookmarksCollectionsApiApp } from './helpers/bookmarksCollectionsApiApp.js';
import { User } from '../models/User.js';
import { Article } from '../models/Article.js';
import { Bookmark } from '../models/Bookmark.js';
import { BookmarkCollection } from '../models/BookmarkCollection.js';
import { BookmarkCollectionLink } from '../models/BookmarkCollectionLink.js';
import { Collection } from '../models/Collection.js';
import { generateAccessToken } from '../utils/jwt.js';
import { ensureDefaultCollection } from '../utils/bookmarkHelpers.js';

let mongoOk = false;
let app: ReturnType<typeof createBookmarksCollectionsApiApp>;
let memMongo: MongoMemoryServer | null = null;

function stamp(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function percentile(sortedMs: number[], p: number): number {
  if (sortedMs.length === 0) return 0;
  const idx = Math.min(
    sortedMs.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedMs.length) - 1)
  );
  return sortedMs[idx];
}

async function createUser(): Promise<string> {
  const s = stamp();
  const now = new Date().toISOString();
  const email = `perf-${s}@book-api-test.local`;
  const username = `perf${s.replace(/-/g, '')}`;
  const doc = await User.create({
    role: 'user',
    auth: { email, emailVerified: true, provider: 'email', createdAt: now },
    profile: { displayName: username, username },
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
  return doc._id.toString();
}

describe('bookmarks search perf harness (local)', () => {
  beforeAll(async () => {
    process.env.MONGOMS_START_TIMEOUT = '120000';
    process.env.MONGOMS_DOWNLOAD_DIR = path.resolve(process.cwd(), '.cache', 'mongodb-binaries');
    memMongo = await MongoMemoryServer.create();
    await mongoose.connect(memMongo.getUri(), {
      dbName: 'nuggets_vitest_bookmarks_perf',
    });
    mongoOk = true;
    app = createBookmarksCollectionsApiApp();
  }, 180000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    if (memMongo) {
      await memMongo.stop();
      memMongo = null;
    }
  });

  beforeEach(async (ctx) => {
    if (!mongoOk) {
      ctx.skip();
      return;
    }
    await Promise.all([
      User.deleteMany({ 'auth.email': { $regex: /@book-api-test\.local$/ } }),
      Article.deleteMany({ authorName: 'Perf Author' }),
      Bookmark.deleteMany({}),
      BookmarkCollection.deleteMany({}),
      BookmarkCollectionLink.deleteMany({}),
      Collection.deleteMany({ canonicalName: { $regex: /^vitest-pub-/ } }),
    ]);
  });

  it('reports p50/p95 for GET /api/bookmarks?q=needle', async (ctx) => {
    if (!mongoOk) ctx.skip();

    const userId = await createUser();
    const token = generateAccessToken(userId, 'user');
    const folderId = await ensureDefaultCollection(userId);
    const nowIso = new Date().toISOString();

    const totalBookmarks = 120;
    const needleEvery = 4;
    for (let i = 0; i < totalBookmarks; i += 1) {
      const hasNeedle = i % needleEvery === 0;
      const article = await Article.create({
        title: hasNeedle ? `bookmark needle title ${i}` : `bookmark plain title ${i}`,
        content: hasNeedle ? `contains needle token ${i}` : `plain content ${i}`,
        authorId: userId,
        authorName: 'Perf Author',
        publishedAt: nowIso,
      });
      const bm = await Bookmark.create({
        userId,
        itemId: article._id.toString(),
        itemType: 'nugget',
        createdAt: nowIso,
        lastAccessedAt: nowIso,
      });
      await BookmarkCollectionLink.create({
        userId,
        bookmarkId: bm._id.toString(),
        collectionId: folderId,
        createdAt: nowIso,
      });
    }

    const samples: number[] = [];
    const runs = 12;
    for (let i = 0; i < runs; i += 1) {
      const start = performance.now();
      const res = await request(app)
        .get('/api/bookmarks')
        .query({ q: 'needle', page: 1, limit: 20 })
        .set('Authorization', `Bearer ${token}`);
      const elapsed = performance.now() - start;
      expect(res.status).toBe(200);
      samples.push(elapsed);
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const p50 = percentile(sorted, 50);
    const p95 = percentile(sorted, 95);
    const avg = sorted.reduce((s, n) => s + n, 0) / sorted.length;

    // Printed for local perf tracking; docs capture headline numbers.
    // eslint-disable-next-line no-console
    console.log(
      `[WO-03 harness] runs=${runs} dataset=${totalBookmarks} q=needle limit=20 p50=${p50.toFixed(
        2
      )}ms p95=${p95.toFixed(2)}ms avg=${avg.toFixed(2)}ms`
    );

    expect(p95).toBeGreaterThan(0);
  }, 300000);
});

