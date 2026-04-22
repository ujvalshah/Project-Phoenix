import '../loadEnv.js';
import { validateEnv } from '../config/envValidation.js';

validateEnv();

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createAdminUsersApiApp } from './helpers/adminUsersApiApp.js';
import { tryConnectIntegrationMongo, disconnectIntegrationMongo } from './helpers/integrationMongo.js';
import { User } from '../models/User.js';
import { generateAccessToken } from '../utils/jwt.js';

let mongoOk = false;
let app: ReturnType<typeof createAdminUsersApiApp>;

function stamp(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function createUserDoc(role: 'user' | 'admin' = 'user'): Promise<string> {
  const s = stamp();
  const now = new Date().toISOString();
  const email = `rl-${s}@route-test.local`;
  const username = `rl${s.replace(/-/g, '')}`;
  const user = await User.create({
    role,
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
  return user._id.toString();
}

describe('Admin mutation rate limiter (PR9 / P1.6)', () => {
  beforeAll(async () => {
    mongoOk = await tryConnectIntegrationMongo();
    if (mongoOk) {
      app = createAdminUsersApiApp();
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
    await User.deleteMany({ 'auth.email': { $regex: /@route-test\.local$/ } });
  });

  // The limiter's max is 30 / minute / admin. We pick `activate` as the
  // hammered endpoint because it's idempotent and doesn't bump tokenVersion,
  // so the side effects of repeated hits stay bounded.
  it('blocks the 31st mutation in the same minute with a 429 + ADMIN_MUTATION_RATE_LIMITED', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const targetId = await createUserDoc('user');
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin');

    // Drive the bucket up to the cap. Each call is 200 OK (idempotent).
    for (let i = 0; i < 30; i++) {
      const ok = await request(app)
        .post(`/api/admin/users/${targetId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(ok.status).toBe(200);
    }

    // The 31st must be throttled.
    const res = await request(app)
      .post(`/api/admin/users/${targetId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('ADMIN_MUTATION_RATE_LIMITED');
    expect(typeof res.body.retryAfter).toBe('number');
    expect(res.body.retryAfter).toBeGreaterThan(0);
    // Standard headers should be present so frontends can read them too.
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  }, 20000);

  // Buckets are keyed by `admin:${userId}` — two different admins each get
  // their own 30/minute budget. This is the property that makes the limiter
  // safe to deploy: incident-response work by Admin A doesn't starve Admin B.
  it('keys per admin: a different admin still has a fresh budget after the first one is exhausted', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const targetId = await createUserDoc('user');
    const adminAId = await createUserDoc('admin');
    const adminBId = await createUserDoc('admin');
    const tokenA = generateAccessToken(adminAId, 'admin');
    const tokenB = generateAccessToken(adminBId, 'admin');

    // Exhaust admin A's bucket.
    for (let i = 0; i < 30; i++) {
      await request(app)
        .post(`/api/admin/users/${targetId}/activate`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});
    }
    const blockedA = await request(app)
      .post(`/api/admin/users/${targetId}/activate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(blockedA.status).toBe(429);

    // Admin B is unaffected.
    const okB = await request(app)
      .post(`/api/admin/users/${targetId}/activate`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({});
    expect(okB.status).toBe(200);
  }, 20000);

  // The limiter is scoped to mutations — read-only admin endpoints (stats,
  // settings GETs, tagging export) should never be gated. We probe `/stats`
  // after a fresh admin makes plenty of GETs to confirm.
  it('does NOT throttle read-only admin endpoints (GET /api/admin/stats)', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin');

    // 50 GETs is well past the 30 mutation cap; if /stats were wired into
    // the limiter, this loop would 429 long before completing.
    for (let i = 0; i < 50; i++) {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    }
  }, 20000);
});
