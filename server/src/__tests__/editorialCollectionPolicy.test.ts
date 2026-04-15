import { describe, it, expect } from 'vitest';
import {
  isAdminRole,
  canModifyCollectionMetadata,
  canModifyCollectionEntriesPolicy,
  canViewCollectionPolicy,
  canCreateCollectionOfType
} from '../utils/editorialCollectionPolicy.js';

const publicCol = { type: 'public' as const, creatorId: 'u1' };
const privateCol = { type: 'private' as const, creatorId: 'u1' };

describe('editorialCollectionPolicy', () => {
  describe('isAdminRole', () => {
    it('accepts admin (case-insensitive)', () => {
      expect(isAdminRole('admin')).toBe(true);
      expect(isAdminRole('Admin')).toBe(true);
      expect(isAdminRole('  ADMIN  ')).toBe(true);
    });
    it('rejects non-admin', () => {
      expect(isAdminRole('user')).toBe(false);
      expect(isAdminRole(undefined)).toBe(false);
    });
  });

  describe('canCreateCollectionOfType', () => {
    it('allows admin to create public', () => {
      expect(canCreateCollectionOfType('public', 'admin')).toBe(true);
    });
    it('forbids standard user from creating public (default when type omitted)', () => {
      expect(canCreateCollectionOfType(undefined, 'user')).toBe(false);
      expect(canCreateCollectionOfType('public', 'user')).toBe(false);
    });
    it('allows any authenticated path for private (auth checked elsewhere)', () => {
      expect(canCreateCollectionOfType('private', 'user')).toBe(true);
      expect(canCreateCollectionOfType('private', 'admin')).toBe(true);
    });
  });

  describe('canModifyCollectionMetadata', () => {
    it('allows admin on public', () => {
      expect(canModifyCollectionMetadata(publicCol, 'u2', 'admin')).toBe(true);
    });
    it('forbids non-admin on public', () => {
      expect(canModifyCollectionMetadata(publicCol, 'u1', 'user')).toBe(false);
    });
    it('allows creator on private', () => {
      expect(canModifyCollectionMetadata(privateCol, 'u1', 'user')).toBe(true);
    });
    it('forbids other user on private', () => {
      expect(canModifyCollectionMetadata(privateCol, 'u2', 'user')).toBe(false);
    });
  });

  describe('canModifyCollectionEntriesPolicy', () => {
    it('mirrors metadata rules for public/private', () => {
      expect(canModifyCollectionEntriesPolicy(publicCol, 'u1', 'user')).toBe(false);
      expect(canModifyCollectionEntriesPolicy(publicCol, 'u1', 'admin')).toBe(true);
      expect(canModifyCollectionEntriesPolicy(privateCol, 'u1', 'user')).toBe(true);
      expect(canModifyCollectionEntriesPolicy(privateCol, 'u2', 'user')).toBe(false);
    });
  });

  describe('canViewCollectionPolicy', () => {
    it('public is always viewable', () => {
      expect(canViewCollectionPolicy(publicCol, undefined, undefined)).toBe(true);
    });
    it('private requires auth as creator or admin', () => {
      expect(canViewCollectionPolicy(privateCol, undefined, undefined)).toBe(false);
      expect(canViewCollectionPolicy(privateCol, 'u1', 'user')).toBe(true);
      expect(canViewCollectionPolicy(privateCol, 'u2', 'admin')).toBe(true);
      expect(canViewCollectionPolicy(privateCol, 'u2', 'user')).toBe(false);
    });
  });
});
