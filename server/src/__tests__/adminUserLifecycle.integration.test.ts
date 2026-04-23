import '../loadEnv.js';
import { validateEnv } from '../config/envValidation.js';

validateEnv();

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createAdminUsersApiApp } from './helpers/adminUsersApiApp.js';
import { tryConnectIntegrationMongo, disconnectIntegrationMongo } from './helpers/integrationMongo.js';
import { User } from '../models/User.js';
import { AdminAuditLog } from '../models/AdminAuditLog.js';
import { generateAccessToken } from '../utils/jwt.js';
import * as tokenService from '../services/tokenService.js';

let mongoOk = false;
let app: ReturnType<typeof createAdminUsersApiApp>;

function stamp(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function createUserDoc(role: 'user' | 'admin' = 'user'): Promise<string> {
  const s = stamp();
  const now = new Date().toISOString();
  const email = `lc-${s}@route-test.local`;
  const username = `lc${s.replace(/-/g, '')}`;
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

describe('Admin user lifecycle (PR7b) — suspend / ban / activate / revoke-sessions', () => {
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

  // ── Authorization ──────────────────────────────────────────────────────────

  it('non-admin cannot suspend a user', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const targetId = await createUserDoc('user');
    const otherId = await createUserDoc('user');
    const otherToken = generateAccessToken(otherId, 'user');

    const res = await request(app)
      .post(`/api/admin/users/${targetId}/suspend`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({});

    expect(res.status).toBe(403);

    const after = await User.findById(targetId).select('status tokenVersion');
    expect(after?.status ?? 'active').toBe('active');
    expect(after?.tokenVersion ?? 0).toBe(0);
  });

  it('admin cannot suspend themselves', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin');

    const res = await request(app)
      .post(`/api/admin/users/${adminId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CANNOT_MUTATE_SELF');

    const after = await User.findById(adminId).select('status');
    expect(after?.status ?? 'active').toBe('active');
  });

  // ── Suspend ────────────────────────────────────────────────────────────────

  it('admin suspends a user: status set, tokenVersion bumped, audit row written', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const targetId = await createUserDoc('user');
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin');

    const before = await User.findById(targetId).select('tokenVersion');
    expect(before?.tokenVersion ?? 0).toBe(0);

    const res = await request(app)
      .post(`/api/admin/users/${targetId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'spam reports' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('suspended');
    expect(res.body.sessionsRevoked).toBe(true);

    const after = await User.findById(targetId).select('status tokenVersion');
    expect(after?.status).toBe('suspended');
    expect(after?.tokenVersion).toBe(1);

    const logs = await AdminAuditLog.find({ targetId, action: 'SUSPEND_USER' });
    expect(logs.length).toBe(1);
    expect(logs[0].adminId).toBe(adminId);
    expect(logs[0].previousValue).toEqual({ status: 'active' });
    expect(logs[0].newValue).toEqual({ status: 'suspended' });
    expect((logs[0].metadata as { reason?: string })?.reason).toBe('spam reports');
  });

  it('suspending an already-suspended user is idempotent and does NOT bump tokenVersion again', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const targetId = await createUserDoc('user');
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin');

    // First call: real transition
    await request(app)
      .post(`/api/admin/users/${targetId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const mid = await User.findById(targetId).select('tokenVersion');
    expect(mid?.tokenVersion).toBe(1);

    // Second call: no-op
    const res = await request(app)
      .post(`/api/admin/users/${targetId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.sessionsRevoked).toBe(false);

    const after = await User.findById(targetId).select('tokenVersion');
    expect(after?.tokenVersion).toBe(1); // unchanged

    // Both calls should still leave audit rows so the security timeline shows
    // every admin click, but the second one carries wasAlreadyInState: true.
    const logs = await AdminAuditLog.find({ targetId, action: 'SUSPEND_USER' }).sort({ timestamp: 1 });
    expect(logs.length).toBe(2);
    expect((logs[0].metadata as { wasAlreadyInState?: boolean })?.wasAlreadyInState).toBe(false);
    expect((logs[1].metadata as { wasAlreadyInState?: boolean })?.wasAlreadyInState).toBe(true);
  });

  // ── Ban ────────────────────────────────────────────────────────────────────

  it('admin bans a user: status set, tokenVersion bumped, BAN_USER audit written', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const targetId = await createUserDoc('user');
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin');

    const res = await request(app)
      .post(`/api/admin/users/${targetId}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'TOS violation' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('banned');

    const after = await User.findById(targetId).select('status tokenVersion');
    expect(after?.status).toBe('banned');
    expect(after?.tokenVersion).toBe(1);

    const logs = await AdminAuditLog.find({ targetId, action: 'BAN_USER' });
    expect(logs.length).toBe(1);
    expect(logs[0].previousValue).toEqual({ status: 'active' });
    expect(logs[0].newValue).toEqual({ status: 'banned' });
  });

  // ── Activate ───────────────────────────────────────────────────────────────

  it('admin activates a suspended user: status reset, ACTIVATE audit written, tokenVersion NOT bumped', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const targetId = await createUserDoc('user');
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin');

    // Suspend first (this bumps tokenVersion to 1)
    await request(app)
      .post(`/api/admin/users/${targetId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    // Now activate
    const res = await request(app)
      .post(`/api/admin/users/${targetId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'appeal upheld' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.sessionsRevoked).toBe(false);

    const after = await User.findById(targetId).select('status tokenVersion');
    expect(after?.status).toBe('active');
    expect(after?.tokenVersion).toBe(1); // suspend bumped to 1; activate left it alone

    const logs = await AdminAuditLog.find({ targetId, action: 'ACTIVATE_USER' });
    expect(logs.length).toBe(1);
    expect(logs[0].previousValue).toEqual({ status: 'suspended' });
    expect(logs[0].newValue).toEqual({ status: 'active' });
  });

  // ── Revoke sessions ───────────────────────────────────────────────────────

  it('admin revokes another user’s sessions: tokenVersion bumped, status unchanged, REVOKE_SESSIONS audit written', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const targetId = await createUserDoc('user');
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin');

    const res = await request(app)
      .post(`/api/admin/users/${targetId}/revoke-sessions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'suspected token theft' });

    expect(res.status).toBe(200);
    expect(res.body.tokenVersion).toBe(1);

    const after = await User.findById(targetId).select('status tokenVersion');
    expect(after?.status ?? 'active').toBe('active');
    expect(after?.tokenVersion).toBe(1);

    const logs = await AdminAuditLog.find({ targetId, action: 'REVOKE_SESSIONS' });
    expect(logs.length).toBe(1);
    expect(logs[0].adminId).toBe(adminId);
    expect((logs[0].metadata as { reason?: string })?.reason).toBe('suspected token theft');
  });

  it('lifecycle response is truthful when refresh-token revocation is unavailable', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const targetId = await createUserDoc('user');
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin');
    const revokeSpy = vi
      .spyOn(tokenService, 'revokeAllRefreshTokensDetailed')
      .mockResolvedValueOnce({ ok: false, reason: 'redis_unavailable' });

    const res = await request(app)
      .post(`/api/admin/users/${targetId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('suspended');
    expect(res.body.sessionsRevoked).toBe(false);
    expect(res.body.revocationFailureReason).toBe('redis_unavailable');
    revokeSpy.mockRestore();
  });

  it('lifecycle response surfaces audit persistence failure', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const targetId = await createUserDoc('user');
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin');
    const auditSpy = vi
      .spyOn(AdminAuditLog, 'create')
      .mockRejectedValueOnce(new Error('audit store down'));

    const res = await request(app)
      .post(`/api/admin/users/${targetId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.auditPersisted).toBe(false);
    auditSpy.mockRestore();
  });

  it('admin cannot revoke their own sessions through this endpoint', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin');

    const res = await request(app)
      .post(`/api/admin/users/${adminId}/revoke-sessions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CANNOT_MUTATE_SELF');
  });

  // ── PUT /api/users/:id no longer accepts status ────────────────────────────

  it('PUT /api/users/:id with status field is rejected (status moves through dedicated endpoints only)', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const targetId = await createUserDoc('user');
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin');

    const res = await request(app)
      .put(`/api/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'suspended' });

    // .strict() schema → unknown field is a 400 validation error
    expect(res.status).toBe(400);

    const after = await User.findById(targetId).select('status');
    expect(after?.status ?? 'active').toBe('active');
  });
});
