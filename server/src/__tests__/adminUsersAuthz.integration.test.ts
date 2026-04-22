import '../loadEnv.js';
import { validateEnv } from '../config/envValidation.js';

validateEnv();

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createAdminUsersApiApp } from './helpers/adminUsersApiApp.js';
import { tryConnectIntegrationMongo, disconnectIntegrationMongo } from './helpers/integrationMongo.js';
import { User } from '../models/User.js';
import { AdminAuditLog } from '../models/AdminAuditLog.js';
import { generateAccessToken } from '../utils/jwt.js';

let mongoOk = false;
let app: ReturnType<typeof createAdminUsersApiApp>;

function stamp(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function createUserDoc(role: 'user' | 'admin' = 'user'): Promise<string> {
  const s = stamp();
  const now = new Date().toISOString();
  const email = `authz-${s}@route-test.local`;
  const username = `authz${s.replace(/-/g, '')}`;
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

describe('Admin/Users authorization (PR2 + PR3)', () => {
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
    await Promise.all([
      User.deleteMany({ 'auth.email': { $regex: /@route-test\.local$/ } }),
      AdminAuditLog.deleteMany({ 'metadata.targetEmail': { $regex: /@route-test\.local$/ } }),
    ]);
  });

  // ── PR2: GET /api/admin/stats now requires admin role ──────────────────

  it('GET /api/admin/stats — non-admin is forbidden', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const userId = await createUserDoc('user');
    const token = generateAccessToken(userId, 'user');

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('GET /api/admin/stats — admin succeeds', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const adminId = await createUserDoc('admin');
    const token = generateAccessToken(adminId, 'admin');

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toBeDefined();
  });

  // ── PR3: GET /api/users/:id/feed owner-or-admin scope ──────────────────

  it('GET /api/users/:id/feed — other authenticated user is forbidden', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const ownerId = await createUserDoc('user');
    const otherId = await createUserDoc('user');
    const otherToken = generateAccessToken(otherId, 'user');

    const res = await request(app)
      .get(`/api/users/${ownerId}/feed`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);

    // And the target user's lastLoginAt must NOT have been written.
    const after = await User.findById(ownerId);
    expect(after?.appState?.lastLoginAt).toBeUndefined();
  });

  it('GET /api/users/:id/feed — owner succeeds and lastLoginAt advances', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const ownerId = await createUserDoc('user');
    const ownerToken = generateAccessToken(ownerId, 'user');

    const before = await User.findById(ownerId);
    expect(before?.appState?.lastLoginAt).toBeUndefined();

    const res = await request(app)
      .get(`/api/users/${ownerId}/feed`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);

    const after = await User.findById(ownerId);
    expect(after?.appState?.lastLoginAt).toBeDefined();
  });

  it('GET /api/users/:id/feed — admin reading another user does NOT touch lastLoginAt', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const ownerId = await createUserDoc('user');
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin');

    const res = await request(app)
      .get(`/api/users/${ownerId}/feed`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const after = await User.findById(ownerId);
    expect(after?.appState?.lastLoginAt).toBeUndefined();
  });

  // ── PR4: admin-on-other mutations write AdminAuditLog rows ─────────────

  it('PUT /api/users/:id by admin writes UPDATE_USER_ROLE on role change', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const targetId = await createUserDoc('user');
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin');

    const res = await request(app)
      .put(`/api/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(200);

    const logs = await AdminAuditLog.find({ targetId, action: 'UPDATE_USER_ROLE' });
    expect(logs.length).toBe(1);
    expect(logs[0].adminId).toBe(adminId);
    expect(logs[0].previousValue).toEqual({ role: 'user' });
    expect(logs[0].newValue).toEqual({ role: 'admin' });
  });

  it('PUT /api/users/:id by user editing self does NOT write AdminAuditLog', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const userId = await createUserDoc('user');
    const userToken = generateAccessToken(userId, 'user');

    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'New Display Name' });

    expect(res.status).toBe(200);

    const logs = await AdminAuditLog.find({ targetId: userId });
    expect(logs.length).toBe(0);
  });

  it('DELETE /api/users/:id by admin writes DELETE_USER', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const targetId = await createUserDoc('user');
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin');

    const targetEmailBefore = (await User.findById(targetId))?.auth?.email;

    const res = await request(app)
      .delete(`/api/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    const logs = await AdminAuditLog.find({ targetId, action: 'DELETE_USER' });
    expect(logs.length).toBe(1);
    expect(logs[0].adminId).toBe(adminId);
    expect((logs[0].previousValue as { email?: string })?.email).toBe(targetEmailBefore);
  });
});
