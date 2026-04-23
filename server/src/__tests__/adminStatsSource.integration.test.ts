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

async function createUserDoc(opts: {
  role?: 'user' | 'admin';
  status?: 'active' | 'suspended' | 'banned';
  omitStatus?: boolean;
} = {}): Promise<string> {
  const s = stamp();
  const now = new Date().toISOString();
  const email = `stats-${s}@route-test.local`;
  const username = `st${s.replace(/-/g, '')}`;
  const doc: Record<string, unknown> = {
    role: opts.role ?? 'user',
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
  };
  if (!opts.omitStatus) {
    doc.status = opts.status ?? 'active';
  }
  const user = await User.create(doc);
  return user._id.toString();
}

describe('Admin stats source-of-truth (PR10 / P1.7)', () => {
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

  // The pre-PR10 controller hardcoded `active = total`, which made every
  // dashboard read silently wrong once status was a real field. This test
  // creates a known mix of active/suspended/banned/legacy users and pins the
  // breakdown returned by /api/admin/stats so the regression cannot recur.
  it('counts users by real status field (active vs suspended vs banned), with legacy unset → active', async (ctx) => {
    if (!mongoOk) ctx.skip();

    // Build a known mix.
    const adminId = await createUserDoc({ role: 'admin', status: 'active' });
    await createUserDoc({ status: 'active' });
    await createUserDoc({ status: 'active' });
    await createUserDoc({ status: 'suspended' });
    await createUserDoc({ status: 'suspended' });
    await createUserDoc({ status: 'banned' });
    // Legacy doc written before PR7b — no status field at all. Should fold
    // into the `active` bucket so totals don't lie.
    await createUserDoc({ omitStatus: true });

    const adminToken = generateAccessToken(adminId, 'admin');
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toBeDefined();
    expect(res.body.users.total).toBe(7);
    expect(res.body.users.admins).toBe(1);
    // 3 explicit-active + 1 legacy-unset = 4
    expect(res.body.users.active).toBe(4);
    expect(res.body.users.suspended).toBe(2);
    expect(res.body.users.banned).toBe(1);
    // Inactive is the union — kept on the response for older dashboard widgets.
    expect(res.body.users.inactive).toBe(3);
    // Sanity: the buckets must add up to the total. If they don't, something
    // is double-counted or missed and the dashboard will lie.
    expect(res.body.users.active + res.body.users.suspended + res.body.users.banned).toBe(res.body.users.total);
  });

  // The stats endpoint caches for 2 minutes. After a lifecycle action the
  // cache is intentionally NOT invalidated here (separate concern), so the
  // same /stats call within the window will still return the prior numbers.
  // This test just confirms the FIRST read after lifecycle changes is right —
  // i.e., a fresh cache key sees the real distribution, not the placeholder.
  it('reflects post-lifecycle state on a fresh stats read', async (ctx) => {
    if (!mongoOk) ctx.skip();

    const adminId = await createUserDoc({ role: 'admin', status: 'active' });
    const targetId = await createUserDoc({ status: 'active' });
    const adminToken = generateAccessToken(adminId, 'admin');

    // Suspend the target via the dedicated endpoint.
    const suspendRes = await request(app)
      .post(`/api/admin/users/${targetId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(suspendRes.status).toBe(200);

    // Now read stats. Because the cache was empty (fresh test), this is a
    // real DB read — proves the aggregation sees the post-suspend status.
    const statsRes = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.users.total).toBe(2);
    expect(statsRes.body.users.active).toBe(1);
    expect(statsRes.body.users.suspended).toBe(1);
    expect(statsRes.body.users.banned).toBe(0);
  });

  it('marks repeated reads as cached so clients can surface freshness', async (ctx) => {
    if (!mongoOk) ctx.skip();
    const adminId = await createUserDoc({ role: 'admin', status: 'active' });
    const adminToken = generateAccessToken(adminId, 'admin');

    const first = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(first.status).toBe(200);
    expect(first.body.cached).toBe(false);

    const second = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);
  });
});
