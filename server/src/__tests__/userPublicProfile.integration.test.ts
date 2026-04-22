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

async function createSensitiveUserDoc(): Promise<string> {
  const s = stamp();
  const now = new Date().toISOString();
  const email = `pub-${s}@route-test.local`;
  const username = `pub${s.replace(/-/g, '')}`;
  const user = await User.create({
    role: 'user',
    tokenVersion: 9,
    auth: { email, emailVerified: true, provider: 'email', createdAt: now },
    profile: {
      displayName: 'Public Person',
      username,
      bio: 'visible bio',
      avatarColor: 'teal',
      // PII — must NOT leak via the public endpoint
      phoneNumber: '+91-555-9000',
      dateOfBirth: '1990-01-01',
      gender: 'female',
      pincode: '560001',
      city: 'Bangalore',
      country: 'India',
      // Public-allowed fields
      title: 'Engineer',
      company: 'Acme',
      location: 'Bangalore',
      website: 'https://example.com',
      linkedin: 'in/pub',
    },
    security: { mfaEnabled: true, lastPasswordChangeAt: now },
    preferences: {
      theme: 'system',
      interestedCategories: ['tech', 'startups'],
      notifications: {
        emailDigest: true,
        productUpdates: false,
        newFollowers: true,
        pushEnabled: true,
        frequency: 'instant',
        categoryFilter: ['tech'],
      },
    },
    appState: { onboardingCompleted: true, lastLoginAt: now },
  });
  return user._id.toString();
}

async function createUserDoc(role: 'user' | 'admin' = 'user'): Promise<string> {
  const s = stamp();
  const now = new Date().toISOString();
  const user = await User.create({
    role,
    auth: { email: `auth-${s}@route-test.local`, emailVerified: true, provider: 'email', createdAt: now },
    profile: { displayName: `u${s}`, username: `u${s.replace(/-/g, '')}` },
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

describe('Public user profile + field-tier authz (PR8)', () => {
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

  // ── P1.5: public allowlist ──────────────────────────────────────────────

  it('GET /api/users/public/:id returns the allowlist shape and no PII', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const userId = await createSensitiveUserDoc();

    const res = await request(app).get(`/api/users/public/${userId}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['id', 'profile', 'role']);
    expect(res.body.id).toBe(userId);
    expect(res.body.role).toBe('user');

    // Public-allowed profile fields are present
    expect(res.body.profile.displayName).toBe('Public Person');
    expect(res.body.profile.bio).toBe('visible bio');
    expect(res.body.profile.title).toBe('Engineer');
    expect(res.body.profile.location).toBe('Bangalore');
    expect(res.body.profile.linkedin).toBe('in/pub');

    // Sensitive fields are NOT present anywhere in the response
    const json = JSON.stringify(res.body);
    expect(json).not.toContain('@route-test.local'); // email
    expect(json).not.toContain('+91-555-9000');      // phoneNumber
    expect(json).not.toContain('1990-01-01');        // dateOfBirth
    expect(json).not.toContain('female');            // gender
    expect(json).not.toContain('560001');            // pincode
    expect(json).not.toContain('lastLoginAt');       // appState
    expect(json).not.toContain('mfaEnabled');        // security
    expect(json).not.toContain('interestedCategories'); // preferences
    expect(json).not.toContain('tokenVersion');      // internal
  });

  it('GET /api/users/public/:id is accessible without authentication', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const userId = await createSensitiveUserDoc();
    const res = await request(app).get(`/api/users/public/${userId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(userId);
  });

  it('GET /api/users/public/:id returns 404 for unknown id', async (ctx) => {
    if (!mongoOk) ctx.skip();
    // Valid ObjectId shape but no document
    const res = await request(app).get('/api/users/public/507f1f77bcf86cd799439011');
    expect(res.status).toBe(404);
  });

  // ── P1.4: field-tier — `role` is admin-only ─────────────────────────────

  it('PUT /api/users/:id with role by self is rejected with 403 (not silently dropped)', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const userId = await createUserDoc('user');
    const userToken = generateAccessToken(userId, 'user');

    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE_CHANGE');

    // Critically: the role didn't change — the silent-drop behavior would
    // also have left it at 'user', so the 403 is what proves we surface
    // the rejection rather than swallowing it.
    const after = await User.findById(userId).select('role');
    expect(after?.role).toBe('user');
  });

  it('PUT /api/users/:id by admin can still change role (sanity check)', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const targetId = await createUserDoc('user');
    const adminId = await createUserDoc('admin');
    const adminToken = generateAccessToken(adminId, 'admin');

    const res = await request(app)
      .put(`/api/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    const after = await User.findById(targetId).select('role');
    expect(after?.role).toBe('admin');
  });

  it('PUT /api/users/:id by self without a role field still works (no regression)', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const userId = await createUserDoc('user');
    const userToken = generateAccessToken(userId, 'user');

    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Edited Name' });

    expect(res.status).toBe(200);
    const after = await User.findById(userId).select('profile.displayName role');
    expect(after?.profile?.displayName).toBe('Edited Name');
    expect(after?.role).toBe('user');
  });
});
