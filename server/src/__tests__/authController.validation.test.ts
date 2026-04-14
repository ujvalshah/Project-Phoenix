import { describe, it, expect } from 'vitest';
import type { Request, Response } from 'express';
import { signup } from '../controllers/authController.js';

function createMockResponse(): Response {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};

  res.status = function status(code: number) {
    res.statusCode = code;
    return res as Response;
  };

  res.json = function json(payload: unknown) {
    res.body = payload;
    return res as Response;
  };

  return res as Response;
}

describe('authController validation safety', () => {
  it('returns 400 for invalid signup payload without crashing', async () => {
    const req = {
      body: {},
      path: '/api/auth/signup',
    } as Request;
    const res = createMockResponse();

    await expect(signup(req, res)).resolves.toBeUndefined();

    expect((res as any).statusCode).toBe(400);
    expect((res as any).body).toMatchObject({
      error: true,
      code: 'VALIDATION_ERROR',
    });
  });

  it('does not require username in signup validation', async () => {
    const req = {
      body: {
        fullName: 'Launch User',
        email: 'not-an-email',
        password: 'Invalid',
      },
      path: '/api/auth/signup',
    } as Request;
    const res = createMockResponse();

    await expect(signup(req, res)).resolves.toBeUndefined();

    expect((res as any).statusCode).toBe(400);
    const errors = ((res as any).body as { errors?: Array<{ path?: string[] }> }).errors || [];
    const hasUsernameValidationError = errors.some((err) => (err.path || []).join('.') === 'username');
    expect(hasUsernameValidationError).toBe(false);
  });
});
