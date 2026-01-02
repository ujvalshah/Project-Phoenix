/**
 * Privacy System Tests
 * 
 * Tests for privacy enforcement across all endpoints
 * 
 * Run: npm test -- privacy.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connectDB } from '../utils/db.js';
import { Article } from '../models/Article.js';
import { User } from '../models/User.js';
import { generateToken } from '../utils/jwt.js';

// Mock request/response objects
const createMockRequest = (userId?: string) => ({
  user: userId ? { userId, role: 'user' } : undefined,
  query: {},
  params: {},
  body: {}
} as any);

const createMockResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis()
  };
  return res;
};

describe('Privacy System', () => {
  let ownerUser: any;
  let otherUser: any;
  let publicArticle: any;
  let privateArticle: any;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await Article.deleteMany({ title: /^Test Article/ });
    await User.deleteMany({ email: /^test.*@test\.com$/ });

    // Create test users
    ownerUser = await User.create({
      name: 'Test Owner',
      email: 'testowner@test.com',
      auth: {
        email: 'testowner@test.com',
        password: 'hashedpassword'
      },
      role: 'user',
      status: 'active',
      joinedAt: new Date().toISOString()
    });

    otherUser = await User.create({
      name: 'Test Other',
      email: 'testother@test.com',
      auth: {
        email: 'testother@test.com',
        password: 'hashedpassword'
      },
      role: 'user',
      status: 'active',
      joinedAt: new Date().toISOString()
    });

    // Create test articles
    publicArticle = await Article.create({
      title: 'Test Article Public',
      content: 'Test content',
      authorId: ownerUser._id.toString(),
      authorName: 'Test Owner',
      category: 'Test',
      categories: ['Test'],
      publishedAt: new Date().toISOString(),
      tags: ['test'],
      visibility: 'public'
    });

    privateArticle = await Article.create({
      title: 'Test Article Private',
      content: 'Test content',
      authorId: ownerUser._id.toString(),
      authorName: 'Test Owner',
      category: 'Test',
      categories: ['Test'],
      publishedAt: new Date().toISOString(),
      tags: ['test'],
      visibility: 'private'
    });
  });

  describe('getArticles - Privacy Filtering', () => {
    it('should exclude private articles from public feed (unauthenticated)', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      // Import controller dynamically to avoid circular dependencies
      const { getArticles } = await import('../controllers/articlesController.js');
      
      // Mock the response methods
      req.query = {};
      
      await getArticles(req, res);

      // Check that response contains public article but not private
      const articles = res.json.mock.calls[0]?.[0]?.data || [];
      const articleIds = articles.map((a: any) => a.id);

      expect(articleIds).toContain(publicArticle._id.toString());
      expect(articleIds).not.toContain(privateArticle._id.toString());
    });

    it('should exclude private articles from public feed (authenticated as other user)', async () => {
      const req = createMockRequest(otherUser._id.toString());
      const res = createMockResponse();
      req.query = {};

      const { getArticles } = await import('../controllers/articlesController.js');
      await getArticles(req, res);

      const articles = res.json.mock.calls[0]?.[0]?.data || [];
      const articleIds = articles.map((a: any) => a.id);

      expect(articleIds).toContain(publicArticle._id.toString());
      expect(articleIds).not.toContain(privateArticle._id.toString());
    });

    it('should include private articles when owner views their own articles', async () => {
      const req = createMockRequest(ownerUser._id.toString());
      const res = createMockResponse();
      req.query = { authorId: ownerUser._id.toString() };

      const { getArticles } = await import('../controllers/articlesController.js');
      await getArticles(req, res);

      const articles = res.json.mock.calls[0]?.[0]?.data || [];
      const articleIds = articles.map((a: any) => a.id);

      expect(articleIds).toContain(publicArticle._id.toString());
      expect(articleIds).toContain(privateArticle._id.toString());
    });

    it('should exclude private articles when viewing another user\'s articles', async () => {
      const req = createMockRequest(otherUser._id.toString());
      const res = createMockResponse();
      req.query = { authorId: ownerUser._id.toString() };

      const { getArticles } = await import('../controllers/articlesController.js');
      await getArticles(req, res);

      const articles = res.json.mock.calls[0]?.[0]?.data || [];
      const articleIds = articles.map((a: any) => a.id);

      expect(articleIds).toContain(publicArticle._id.toString());
      expect(articleIds).not.toContain(privateArticle._id.toString());
    });
  });

  describe('getArticleById - Privacy Check', () => {
    it('should allow access to public article (unauthenticated)', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      req.params = { id: publicArticle._id.toString() };

      const { getArticleById } = await import('../controllers/articlesController.js');
      await getArticleById(req, res);

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(res.status).not.toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalled();
    });

    it('should deny access to private article (unauthenticated)', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      req.params = { id: privateArticle._id.toString() };

      const { getArticleById } = await import('../controllers/articlesController.js');
      await getArticleById(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should deny access to private article (authenticated as other user)', async () => {
      const req = createMockRequest(otherUser._id.toString());
      const res = createMockResponse();
      req.params = { id: privateArticle._id.toString() };

      const { getArticleById } = await import('../controllers/articlesController.js');
      await getArticleById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should allow access to private article (authenticated as owner)', async () => {
      const req = createMockRequest(ownerUser._id.toString());
      const res = createMockResponse();
      req.params = { id: privateArticle._id.toString() };

      const { getArticleById } = await import('../controllers/articlesController.js');
      await getArticleById(req, res);

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(res.status).not.toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('Search - Privacy Filtering', () => {
    it('should exclude private articles from search results', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      req.query = { q: 'Test Article' };

      const { getArticles } = await import('../controllers/articlesController.js');
      await getArticles(req, res);

      const articles = res.json.mock.calls[0]?.[0]?.data || [];
      const articleIds = articles.map((a: any) => a.id);

      expect(articleIds).toContain(publicArticle._id.toString());
      expect(articleIds).not.toContain(privateArticle._id.toString());
    });
  });
});



