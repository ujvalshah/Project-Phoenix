import { describe, it, expect } from 'vitest';
import { toPublicUserView } from '../utils/userPublicView.js';

/**
 * Unit tests for the public user allowlist (PR8 / P1.5).
 *
 * These tests don't need Mongo — they pin the contract for what is and
 * isn't exposed to anonymous callers. If you change the allowlist, update
 * these tests deliberately; they exist to make accidental field leaks loud.
 */
describe('toPublicUserView (PR8 / P1.5) — strict public allowlist', () => {
  // A user document with every sensitive field populated. Mirrors what
  // `User.findById(...).select('-password')` would actually return.
  const fullUser = {
    _id: { toString: () => 'user_abc' },
    role: 'user' as const,
    status: 'suspended',
    tokenVersion: 7,
    auth: {
      email: 'private@example.com',
      emailVerified: true,
      provider: 'email',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-06-01T00:00:00Z',
    },
    security: {
      mfaEnabled: true,
      lastPasswordChangeAt: '2024-05-01T00:00:00Z',
    },
    preferences: {
      theme: 'dark',
      interestedCategories: ['tech', 'startups'],
      notifications: {
        emailDigest: true,
        productUpdates: false,
        newFollowers: true,
        pushEnabled: true,
        frequency: 'instant',
        categoryFilter: ['tech'],
        timezone: 'Asia/Kolkata',
      },
    },
    appState: {
      lastLoginAt: '2024-12-01T12:00:00Z',
      onboardingCompleted: true,
      featureFlags: { earlyAccess: true },
    },
    profile: {
      displayName: 'Public Name',
      username: 'publicname',
      bio: 'Building things.',
      avatarUrl: 'https://example.com/a.png',
      avatarColor: 'blue',
      // Public profile fields
      title: 'Engineer',
      company: 'Acme',
      location: 'Bangalore',
      website: 'https://example.com',
      twitter: '@public',
      linkedin: 'in/public',
      youtube: 'public',
      instagram: '@public',
      facebook: 'public',
      // PII — must NOT appear in the view
      phoneNumber: '+91-555-0100',
      dateOfBirth: '1990-01-01',
      gender: 'male',
      pincode: '560001',
      city: 'Bangalore',
      country: 'India',
    },
  };

  it('returns the documented allowlist shape and nothing else at the top level', () => {
    const view = toPublicUserView(fullUser);
    expect(view).not.toBeNull();
    // Lock the exact key set so adding a top-level field to User without
    // updating the allowlist will break this test.
    expect(Object.keys(view!).sort()).toEqual(['id', 'profile', 'role']);
  });

  it('exposes id derived from _id and the user role', () => {
    const view = toPublicUserView(fullUser);
    expect(view?.id).toBe('user_abc');
    expect(view?.role).toBe('user');
  });

  it('NEVER exposes email, security, preferences, appState, status, or tokenVersion', () => {
    const view = toPublicUserView(fullUser) as unknown as Record<string, unknown>;
    expect(view).not.toHaveProperty('auth');
    expect(view).not.toHaveProperty('email');
    expect(view).not.toHaveProperty('security');
    expect(view).not.toHaveProperty('preferences');
    expect(view).not.toHaveProperty('appState');
    expect(view).not.toHaveProperty('status');
    expect(view).not.toHaveProperty('tokenVersion');
    expect(view).not.toHaveProperty('password');
    // Spot-check the JSON-serialized form too — accidental enumerable
    // properties on prototype objects can sneak past hasOwnProperty.
    const json = JSON.stringify(view);
    expect(json).not.toContain('private@example.com');
    expect(json).not.toContain('lastLoginAt');
    expect(json).not.toContain('mfaEnabled');
    expect(json).not.toContain('tokenVersion');
    expect(json).not.toContain('suspended');
  });

  it('NEVER exposes PII inside profile (phoneNumber, dateOfBirth, gender, pincode, city, country)', () => {
    const view = toPublicUserView(fullUser);
    const profileKeys = Object.keys(view!.profile);
    expect(profileKeys).not.toContain('phoneNumber');
    expect(profileKeys).not.toContain('dateOfBirth');
    expect(profileKeys).not.toContain('gender');
    expect(profileKeys).not.toContain('pincode');
    expect(profileKeys).not.toContain('city');
    expect(profileKeys).not.toContain('country');
    // The free-text `location` IS exposed (user-set display string), so make
    // sure the assertion above isn't accidentally also stripping it.
    expect(view?.profile.location).toBe('Bangalore');
  });

  it('exposes the documented profile public fields when populated', () => {
    const view = toPublicUserView(fullUser);
    expect(view?.profile.displayName).toBe('Public Name');
    expect(view?.profile.username).toBe('publicname');
    expect(view?.profile.bio).toBe('Building things.');
    expect(view?.profile.avatarUrl).toBe('https://example.com/a.png');
    expect(view?.profile.avatarColor).toBe('blue');
    expect(view?.profile.title).toBe('Engineer');
    expect(view?.profile.company).toBe('Acme');
    expect(view?.profile.website).toBe('https://example.com');
    expect(view?.profile.twitter).toBe('@public');
    expect(view?.profile.linkedin).toBe('in/public');
    expect(view?.profile.youtube).toBe('public');
    expect(view?.profile.instagram).toBe('@public');
    expect(view?.profile.facebook).toBe('public');
  });

  it('omits empty optional fields rather than emitting empty strings', () => {
    const minimal = {
      _id: 'user_min',
      role: 'user',
      profile: {
        displayName: 'Min',
        username: 'min',
        bio: '', // empty string should not leak as ""
      },
    };
    const view = toPublicUserView(minimal);
    expect(view?.profile.displayName).toBe('Min');
    expect(view?.profile.username).toBe('min');
    expect(view?.profile.bio).toBeUndefined();
    expect(view?.profile.title).toBeUndefined();
    expect(view?.profile.location).toBeUndefined();
  });

  it('coerces an unknown role to "user" (never trusts the doc to upgrade)', () => {
    const view = toPublicUserView({
      _id: 'u1',
      role: 'superadmin' as unknown as string,
      profile: { displayName: 'X', username: 'x' },
    });
    expect(view?.role).toBe('user');
  });

  it('handles Mongoose-style documents with toObject()', () => {
    const docLike = {
      toObject() {
        return {
          _id: { toString: () => 'mongo_id' },
          role: 'admin',
          profile: { displayName: 'Mongo', username: 'mongo' },
          status: 'banned',
        };
      },
    };
    const view = toPublicUserView(docLike);
    expect(view?.id).toBe('mongo_id');
    expect(view?.role).toBe('admin');
    expect(view as unknown as Record<string, unknown>).not.toHaveProperty('status');
  });

  it('returns null for null/undefined or unidentifiable inputs', () => {
    expect(toPublicUserView(null)).toBeNull();
    expect(toPublicUserView(undefined)).toBeNull();
    expect(toPublicUserView({ profile: { displayName: 'a', username: 'a' } })).toBeNull();
  });
});
