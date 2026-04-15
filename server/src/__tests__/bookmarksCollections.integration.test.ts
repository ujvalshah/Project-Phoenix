import '../loadEnv.js';
import { validateEnv } from '../config/envValidation.js';

validateEnv();

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createBookmarksCollectionsApiApp } from './helpers/bookmarksCollectionsApiApp.js';
import {
  tryConnectIntegrationMongo,
  disconnectIntegrationMongo
} from './helpers/integrationMongo.js';
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

function stamp(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function createTestUser(role: 'user' | 'admin'): Promise<string> {
  const s = stamp();
  const email = `u-${s}@book-api-test.local`;
  const username = `user${s.replace(/-/g, '')}`;
  const now = new Date().toISOString();
  const doc = await User.create({
    role,
    auth: {
      email,
      emailVerified: true,
      provider: 'email',
      createdAt: now
    },
    profile: {
      displayName: username,
      username
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
        categoryFilter: []
      }
    },
    appState: { onboardingCompleted: true }
  });
  return doc._id.toString();
}

async function createArticle(authorId: string, title: string, content = ''): Promise<string> {
  const now = new Date().toISOString();
  const a = await Article.create({
    title,
    content,
    authorId,
    authorName: 'Test Author',
    publishedAt: now
  });
  return a._id.toString();
}

describe('Bookmarks + collections HTTP integration', () => {
  beforeAll(async () => {
    mongoOk = await tryConnectIntegrationMongo();
    if (mongoOk) {
      app = createBookmarksCollectionsApiApp();
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
      User.deleteMany({ 'auth.email': { $regex: /@book-api-test\.local$/ } }),
      Article.deleteMany({ authorName: 'Test Author' }),
      Bookmark.deleteMany({}),
      BookmarkCollection.deleteMany({}),
      BookmarkCollectionLink.deleteMany({}),
      Collection.deleteMany({ canonicalName: { $regex: /^vitest-pub-/ } })
    ]);
  });

  it('POST /api/bookmarks/assign succeeds for own bookmark and folders', async (ctx) => {
    if (!mongoOk) ctx.skip();

    const userId = await createTestUser('user');
    const token = generateAccessToken(userId, 'user');
    const itemId = await createArticle(userId, 'My nugget');
    const defaultFolderId = await ensureDefaultCollection(userId);
    const extraFolder = await BookmarkCollection.create({
      userId,
      name: 'Extra',
      canonicalName: `extra-${stamp()}`,
      description: '',
      order: 1,
      isDefault: false,
      bookmarkCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const bm = await Bookmark.create({
      userId,
      itemId,
      itemType: 'nugget',
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString()
    });
    const bookmarkId = bm._id.toString();
    const now = new Date().toISOString();
    await BookmarkCollectionLink.create({
      userId,
      bookmarkId,
      collectionId: defaultFolderId,
      createdAt: now
    });
    await BookmarkCollection.updateOne(
      { _id: defaultFolderId },
      { $set: { bookmarkCount: 1 } }
    );

    const res = await request(app)
      .post('/api/bookmarks/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bookmarkId,
        collectionIds: [defaultFolderId, extraFolder._id.toString()]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(new Set(res.body.collectionIds)).toEqual(
      new Set([defaultFolderId, extraFolder._id.toString()])
    );

    const links = await BookmarkCollectionLink.find({ bookmarkId }).lean();
    expect(links).toHaveLength(2);
  });

  it('POST /api/bookmarks/assign rejects foreign folder with 403', async (ctx) => {
    if (!mongoOk) ctx.skip();

    const userA = await createTestUser('user');
    const userB = await createTestUser('user');
    const tokenA = generateAccessToken(userA, 'user');
    const bFolder = await BookmarkCollection.create({
      userId: userB,
      name: 'B only',
      canonicalName: `bonly-${stamp()}`,
      description: '',
      order: 1,
      isDefault: false,
      bookmarkCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const itemId = await createArticle(userA, 'A item');
    const defaultA = await ensureDefaultCollection(userA);
    const bm = await Bookmark.create({
      userId: userA,
      itemId,
      itemType: 'nugget',
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString()
    });
    const bookmarkId = bm._id.toString();
    await BookmarkCollectionLink.create({
      userId: userA,
      bookmarkId,
      collectionId: defaultA,
      createdAt: new Date().toISOString()
    });

    const res = await request(app)
      .post('/api/bookmarks/assign')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        bookmarkId,
        collectionIds: [defaultA, bFolder._id.toString()]
      });

    expect(res.status).toBe(403);
  });

  it('POST /api/bookmarks/assign returns 404 for another user bookmark', async (ctx) => {
    if (!mongoOk) ctx.skip();

    const userA = await createTestUser('user');
    const userB = await createTestUser('user');
    const tokenA = generateAccessToken(userA, 'user');
    const itemId = await createArticle(userB, 'B item');
    const defaultB = await ensureDefaultCollection(userB);
    const bm = await Bookmark.create({
      userId: userB,
      itemId,
      itemType: 'nugget',
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString()
    });
    const bookmarkId = bm._id.toString();

    const res = await request(app)
      .post('/api/bookmarks/assign')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        bookmarkId,
        collectionIds: [defaultB]
      });

    expect(res.status).toBe(404);
  });

  it('POST /api/bookmarks/assign dedupes folder ids (single link per folder)', async (ctx) => {
    if (!mongoOk) ctx.skip();

    const userId = await createTestUser('user');
    const token = generateAccessToken(userId, 'user');
    const itemId = await createArticle(userId, 'Dedup');
    const folderId = await ensureDefaultCollection(userId);
    const bm = await Bookmark.create({
      userId,
      itemId,
      itemType: 'nugget',
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString()
    });
    const bookmarkId = bm._id.toString();

    const res = await request(app)
      .post('/api/bookmarks/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bookmarkId,
        collectionIds: [folderId, folderId, folderId]
      });

    expect(res.status).toBe(200);
    expect(res.body.collectionIds).toEqual([folderId]);
    const links = await BookmarkCollectionLink.find({ bookmarkId }).lean();
    expect(links).toHaveLength(1);
  });

  it('GET /api/bookmarks?q= filters before pagination (total, hasMore)', async (ctx) => {
    if (!mongoOk) ctx.skip();

    const userId = await createTestUser('user');
    const token = generateAccessToken(userId, 'user');
    const folderId = await ensureDefaultCollection(userId);

    const needleA = await createArticle(userId, 'alpha NEEDLE one', 'x');
    const needleB = await createArticle(userId, 'beta two', 'NEEDLE in content');
    const plain = await createArticle(userId, 'gamma three', 'no match here');

    for (const itemId of [needleA, needleB, plain]) {
      const bm = await Bookmark.create({
        userId,
        itemId,
        itemType: 'nugget',
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString()
      });
      const bid = bm._id.toString();
      await BookmarkCollectionLink.create({
        userId,
        bookmarkId: bid,
        collectionId: folderId,
        createdAt: new Date().toISOString()
      });
    }

    const p1 = await request(app)
      .get('/api/bookmarks')
      .query({ q: 'NEEDLE', limit: 1, page: 1 })
      .set('Authorization', `Bearer ${token}`);

    expect(p1.status).toBe(200);
    expect(p1.body.meta.total).toBe(2);
    expect(p1.body.meta.hasMore).toBe(true);
    expect(p1.body.data).toHaveLength(1);

    const p2 = await request(app)
      .get('/api/bookmarks')
      .query({ q: 'NEEDLE', limit: 1, page: 2 })
      .set('Authorization', `Bearer ${token}`);

    expect(p2.status).toBe(200);
    expect(p2.body.meta.total).toBe(2);
    expect(p2.body.meta.hasMore).toBe(false);
    expect(p2.body.data).toHaveLength(1);
  });

  it('GET /api/bookmarks combines q= with collectionId filter', async (ctx) => {
    if (!mongoOk) ctx.skip();

    const userId = await createTestUser('user');
    const token = generateAccessToken(userId, 'user');
    const folderA = await ensureDefaultCollection(userId);
    const folderB = await BookmarkCollection.create({
      userId,
      name: 'Other',
      canonicalName: `other-${stamp()}`,
      description: '',
      order: 2,
      isDefault: false,
      bookmarkCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const inBoth = await createArticle(userId, 'ZZZ specialtoken ZZZ', '');
    const inAOnly = await createArticle(userId, 'also specialtoken', '');
    const inBOnly = await createArticle(userId, 'specialtoken only B', '');
    const nowIso = new Date().toISOString();

    async function addBookmarkInFolder(itemId: string, col: string) {
      const bm = await Bookmark.create({
        userId,
        itemId,
        itemType: 'nugget',
        createdAt: nowIso,
        lastAccessedAt: nowIso
      });
      await BookmarkCollectionLink.create({
        userId,
        bookmarkId: bm._id.toString(),
        collectionId: col,
        createdAt: nowIso
      });
    }

    const bmBoth = await Bookmark.create({
      userId,
      itemId: inBoth,
      itemType: 'nugget',
      createdAt: nowIso,
      lastAccessedAt: nowIso
    });
    const bidBoth = bmBoth._id.toString();
    await BookmarkCollectionLink.create({
      userId,
      bookmarkId: bidBoth,
      collectionId: folderA,
      createdAt: nowIso
    });
    await BookmarkCollectionLink.create({
      userId,
      bookmarkId: bidBoth,
      collectionId: folderB._id.toString(),
      createdAt: nowIso
    });

    await addBookmarkInFolder(inAOnly, folderA);
    await addBookmarkInFolder(inBOnly, folderB._id.toString());

    const res = await request(app)
      .get('/api/bookmarks')
      .query({
        q: 'specialtoken',
        collectionId: folderA,
        limit: 20,
        page: 1
      })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((row: { itemId: string }) => row.itemId);
    expect(ids).toContain(inBoth);
    expect(ids).toContain(inAOnly);
    expect(ids).not.toContain(inBOnly);
    expect(res.body.meta.total).toBe(2);
  });

  it('editorial public collection: standard user cannot create / mutate; admin can', async (ctx) => {
    if (!mongoOk) ctx.skip();

    const standardId = await createTestUser('user');
    const adminId = await createTestUser('admin');
    const stdToken = generateAccessToken(standardId, 'user');
    const admToken = generateAccessToken(adminId, 'admin');
    const articleId = await createArticle(adminId, 'Editorial item');

    const denyCreate = await request(app)
      .post('/api/collections')
      .set('Authorization', `Bearer ${stdToken}`)
      .send({
        name: 'Vitest Public Deny',
        type: 'public',
        description: ''
      });
    expect(denyCreate.status).toBe(403);

    const pubName = `vitest-pub-${stamp()}`;
    const okCreate = await request(app)
      .post('/api/collections')
      .set('Authorization', `Bearer ${admToken}`)
      .send({
        name: pubName,
        type: 'public',
        description: ''
      });
    expect(okCreate.status).toBe(201);
    const colId = okCreate.body.id ?? okCreate.body._id;
    const collectionId = String(colId);

    const denyAdd = await request(app)
      .post(`/api/collections/${collectionId}/entries`)
      .set('Authorization', `Bearer ${stdToken}`)
      .send({ articleId });
    expect(denyAdd.status).toBe(403);

    const okAdd = await request(app)
      .post(`/api/collections/${collectionId}/entries`)
      .set('Authorization', `Bearer ${admToken}`)
      .send({ articleId });
    expect(okAdd.status).toBe(200);

    const denyRm = await request(app)
      .delete(`/api/collections/${collectionId}/entries/${articleId}`)
      .set('Authorization', `Bearer ${stdToken}`);
    expect(denyRm.status).toBe(403);

    const denyPut = await request(app)
      .put(`/api/collections/${collectionId}`)
      .set('Authorization', `Bearer ${stdToken}`)
      .send({ name: 'Renamed' });
    expect(denyPut.status).toBe(403);

    const denyDel = await request(app)
      .delete(`/api/collections/${collectionId}`)
      .set('Authorization', `Bearer ${stdToken}`);
    expect(denyDel.status).toBe(403);

    const okPut = await request(app)
      .put(`/api/collections/${collectionId}`)
      .set('Authorization', `Bearer ${admToken}`)
      .send({ name: `${pubName} renamed` });
    expect(okPut.status).toBe(200);

    const okDel = await request(app)
      .delete(`/api/collections/${collectionId}`)
      .set('Authorization', `Bearer ${admToken}`);
    expect(okDel.status).toBe(204);
  });
});
