import { describe, expect, it } from 'vitest';
import { getSafeUsernameHandle } from '@/utils/userIdentity';

describe('getSafeUsernameHandle', () => {
  it('returns existing username when present', () => {
    expect(getSafeUsernameHandle({
      username: 'Jane_Doe',
      displayName: 'Jane Doe',
      userId: 'abc123',
    })).toBe('jane_doe');
  });

  it('derives handle from display name when username is missing', () => {
    expect(getSafeUsernameHandle({
      username: '',
      displayName: 'Launch Ready User',
      userId: 'abc123',
    })).toBe('launch_ready_use');
  });

  it('falls back to stable user id based handle', () => {
    expect(getSafeUsernameHandle({
      username: '',
      displayName: '',
      userId: '507f1f77bcf86cd799439011',
    })).toBe('user_507f1f');
  });
});
