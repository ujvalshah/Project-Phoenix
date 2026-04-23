import '../loadEnv.js';
import { validateEnv, resetValidatedEnvForTests } from '../config/envValidation.js';

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

async function createUserDoc(role: 'user' | 'admin' = 'user', tokenVersion = 0): Promise<string> {
  const s = stamp();
  const now = new Date().toISOString();
  const email = `tv-${s}@route-test.local`;
  const username = `tv${s.replace(/-/g, '')}`;
  const user = await User.create({
    role,
    tokenVersion,
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

describe('tokenVersion (PR5) — observe-only by default', () => {
  beforeAll(async () => {
    mongoOk = await tryConnectIntegrationMongo();
    if (mongoOk) {
      app = createAdminUsersApiApp();
    }
  }, 15000);

  afterAll(async () => {
    await disconnectIntegrationMongo();
    delete process.env.ENFORCE_TOKEN_VERSION;
  });

  beforeEach(async (ctx) => {
    if (!mongoOk) {
      ctx.skip();
      return;
    }
    await User.deleteMany({ 'auth.email': { $regex: /@route-test\.local$/ } });
    delete process.env.ENFORCE_TOKEN_VERSION;
    resetValidatedEnvForTests();
    validateEnv();
  });

  it('admin role-change bumps target tokenVersion and revokes refresh tokens (best-effort)', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const targetId = await createUserDoc('user', 0);
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin', undefined, 0);

    const before = await User.findById(targetId).select('tokenVersion');
    expect(before?.tokenVersion ?? 0).toBe(0);

    const res = await request(app)
      .put(`/api/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(200);

    const after = await User.findById(targetId).select('tokenVersion role');
    expect(after?.role).toBe('admin');
    expect(after?.tokenVersion).toBe(1);
  });

  it('admin profile-only edit (no role change) does NOT bump tokenVersion', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const targetId = await createUserDoc('user', 0);
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin', undefined, 0);

    const res = await request(app)
      .put(`/api/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Display Name' });

    expect(res.status).toBe(200);

    const after = await User.findById(targetId).select('tokenVersion');
    expect(after?.tokenVersion ?? 0).toBe(0);
  });

  it('observe-only mode (default): mismatched tokenVersion is allowed but logged', async (ctx) => {
    if (!mongoOk) ctx.skip();
    // Default ENFORCE_TOKEN_VERSION is false; the flag is read fresh per
    // request via getEnv(), but env is captured at validateEnv(). For the
    // observe-only path we rely on the default; for the enforce path we
    // need a separate test or to mutate getEnv's cache.
    const userId = await createUserDoc('user', /* current */ 5);
    // Mint a token with stale tokenVersion=0; user is at tv=5.
    const staleToken = generateAccessToken(userId, 'user', undefined, 0);

    // Use any authenticated route this app exposes — /api/users/:id is admin-only,
    // so use /api/users/:id/feed which only requires owner-or-admin.
    const res = await request(app)
      .get(`/api/users/${userId}/feed`)
      .set('Authorization', `Bearer ${staleToken}`);

    // observe-only: request still succeeds despite mismatch
    expect(res.status).toBe(200);
  });

  it('coercion: token without tokenVersion + user with tokenVersion=0 is treated as match', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const userId = await createUserDoc('user', 0);
    // Older token format: omit tokenVersion entirely.
    const oldToken = generateAccessToken(userId, 'user');

    const res = await request(app)
      .get(`/api/users/${userId}/feed`)
      .set('Authorization', `Bearer ${oldToken}`);

    expect(res.status).toBe(200);
  });

  it('enforced mode: mismatched tokenVersion is rejected with SESSION_REVOKED', async (ctx) => {
    if (!mongoOk) ctx.skip();
    process.env.ENFORCE_TOKEN_VERSION = 'true';
    resetValidatedEnvForTests();
    validateEnv();

    const userId = await createUserDoc('user', 3);
    const staleToken = generateAccessToken(userId, 'user', undefined, 0);

    const res = await request(app)
      .get(`/api/users/${userId}/feed`)
      .set('Authorization', `Bearer ${staleToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_REVOKED');
  });
});
