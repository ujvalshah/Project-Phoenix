import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

vi.mock('../services/tokenService.js', () => ({
  isTokenBlacklisted: vi.fn(),
}));

vi.mock('../utils/jwt.js', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  createRequestLogger: vi.fn(() => ({
    warn: vi.fn(),
  })),
}));

import { optionalAuthenticateToken } from '../middleware/optionalAuthenticateToken.js';
import { isTokenBlacklisted } from '../services/tokenService.js';
import { verifyToken } from '../utils/jwt.js';

describe('optionalAuthenticateToken', () => {
  const next = vi.fn() as unknown as NextFunction;
  const res = {} as Response;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('continues without user when no token is present', async () => {
    const req = {
      headers: {},
      path: '/collections',
      id: 'req-1',
    } as unknown as Request;

    await optionalAuthenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).user).toBeUndefined();
  });

  it('attaches req.user when a valid token is provided', async () => {
    const req = {
      headers: { authorization: 'Bearer valid-token' },
      path: '/collections',
      id: 'req-2',
    } as unknown as Request;

    vi.mocked(isTokenBlacklisted).mockResolvedValue(false);
    vi.mocked(verifyToken).mockReturnValue({ userId: 'u1', role: 'user' } as any);

    await optionalAuthenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).user).toEqual({ userId: 'u1', role: 'user' });
  });

  it('continues as anonymous when token verification fails', async () => {
    const req = {
      headers: { authorization: 'Bearer bad-token' },
      path: '/collections',
      id: 'req-3',
    } as unknown as Request;

    vi.mocked(isTokenBlacklisted).mockResolvedValue(false);
    vi.mocked(verifyToken).mockImplementation(() => {
      throw new Error('bad token');
    });

    await optionalAuthenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).user).toBeUndefined();
  });
});
