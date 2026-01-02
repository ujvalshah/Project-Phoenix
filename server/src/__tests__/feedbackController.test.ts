import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import { Feedback } from '../models/Feedback.js';
import { getFeedback, updateFeedbackStatus } from '../controllers/feedbackController.js';
import { Request, Response } from 'express';

// Mock request/response objects
const createMockRequest = (overrides: any = {}): Partial<Request> => ({
  query: {},
  params: {},
  body: {},
  ...overrides
});

const createMockResponse = (): Partial<Response> => {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res;
};

describe('Feedback Controller Integration Tests', () => {
  let testDb: typeof mongoose;

  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
    testDb = await mongoose.connect(mongoUri);
  });

  beforeEach(async () => {
    // Clear feedback collection before each test
    await Feedback.deleteMany({});
  });

  afterEach(async () => {
    // Clean up after each test
    await Feedback.deleteMany({});
  });

  afterAll(async () => {
    // Close database connection
    await mongoose.connection.close();
  });

  describe('Feedback Status Updates', () => {
    it('should update feedback status from new to read without deleting it', async () => {
      // Create a feedback entry
      const feedback = await Feedback.create({
        content: 'Test feedback',
        type: 'bug',
        status: 'new'
      });

      const req = createMockRequest({
        params: { id: feedback._id.toString() },
        body: { status: 'read' }
      }) as Request;

      const res = createMockResponse() as Response;

      await updateFeedbackStatus(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();

      // Verify feedback still exists in database
      const updatedFeedback = await Feedback.findById(feedback._id);
      expect(updatedFeedback).not.toBeNull();
      expect(updatedFeedback?.status).toBe('read');
      expect(updatedFeedback?.content).toBe('Test feedback');
      
      // Verify the response contains the updated feedback
      const responseData = (res.json as any).mock.calls[0][0];
      expect(responseData.status).toBe('read');
    });

    it('should update feedback status from read to archived without deleting it', async () => {
      // Create a feedback entry with 'read' status
      const feedback = await Feedback.create({
        content: 'Test feedback',
        type: 'feature',
        status: 'read'
      });

      const req = createMockRequest({
        params: { id: feedback._id.toString() },
        body: { status: 'archived' }
      }) as Request;

      const res = createMockResponse() as Response;

      await updateFeedbackStatus(req, res);

      // Verify feedback still exists
      const updatedFeedback = await Feedback.findById(feedback._id);
      expect(updatedFeedback).not.toBeNull();
      expect(updatedFeedback?.status).toBe('archived');
    });

    it('should allow reverting feedback from read back to new', async () => {
      // Create a feedback entry with 'read' status
      const feedback = await Feedback.create({
        content: 'Test feedback',
        type: 'general',
        status: 'read'
      });

      const req = createMockRequest({
        params: { id: feedback._id.toString() },
        body: { status: 'new' }
      }) as Request;

      const res = createMockResponse() as Response;

      await updateFeedbackStatus(req, res);

      // Verify feedback reverted to new
      const updatedFeedback = await Feedback.findById(feedback._id);
      expect(updatedFeedback).not.toBeNull();
      expect(updatedFeedback?.status).toBe('new');
    });
  });

  describe('Feedback Filtering', () => {
    beforeEach(async () => {
      // Create feedback entries with different statuses
      await Feedback.create([
        { content: 'New feedback 1', type: 'bug', status: 'new' },
        { content: 'New feedback 2', type: 'feature', status: 'new' },
        { content: 'Read feedback 1', type: 'general', status: 'read' },
        { content: 'Read feedback 2', type: 'bug', status: 'read' },
        { content: 'Archived feedback 1', type: 'feature', status: 'archived' },
        { content: 'Archived feedback 2', type: 'general', status: 'archived' },
      ]);
    });

    it('should filter feedback by new status', async () => {
      const req = createMockRequest({
        query: { status: 'new' }
      }) as Request;

      const res = createMockResponse() as Response;

      await getFeedback(req, res);

      expect(res.json).toHaveBeenCalled();
      const responseData = (res.json as any).mock.calls[0][0];
      expect(responseData.data).toHaveLength(2);
      expect(responseData.data.every((f: any) => f.status === 'new')).toBe(true);
    });

    it('should filter feedback by read status', async () => {
      const req = createMockRequest({
        query: { status: 'read' }
      }) as Request;

      const res = createMockResponse() as Response;

      await getFeedback(req, res);

      expect(res.json).toHaveBeenCalled();
      const responseData = (res.json as any).mock.calls[0][0];
      expect(responseData.data).toHaveLength(2);
      expect(responseData.data.every((f: any) => f.status === 'read')).toBe(true);
    });

    it('should filter feedback by archived status', async () => {
      const req = createMockRequest({
        query: { status: 'archived' }
      }) as Request;

      const res = createMockResponse() as Response;

      await getFeedback(req, res);

      expect(res.json).toHaveBeenCalled();
      const responseData = (res.json as any).mock.calls[0][0];
      expect(responseData.data).toHaveLength(2);
      expect(responseData.data.every((f: any) => f.status === 'archived')).toBe(true);
    });

    it('should return all feedback when no status filter is provided', async () => {
      const req = createMockRequest({
        query: {}
      }) as Request;

      const res = createMockResponse() as Response;

      await getFeedback(req, res);

      expect(res.json).toHaveBeenCalled();
      const responseData = (res.json as any).mock.calls[0][0];
      expect(responseData.data).toHaveLength(6);
      expect(responseData.total).toBe(6);
    });

    it('should show resolved feedback in read filter after status update', async () => {
      // Create a new feedback
      const feedback = await Feedback.create({
        content: 'Test feedback',
        type: 'bug',
        status: 'new'
      });

      // Update it to read
      const updateReq = createMockRequest({
        params: { id: feedback._id.toString() },
        body: { status: 'read' }
      }) as Request;

      const updateRes = createMockResponse() as Response;
      await updateFeedbackStatus(updateReq, updateRes);

      // Query for read feedback
      const getReq = createMockRequest({
        query: { status: 'read' }
      }) as Request;

      const getRes = createMockResponse() as Response;
      await getFeedback(getReq, getRes);

      const responseData = (getRes.json as jest.Mock).mock.calls[0][0];
      const foundFeedback = responseData.data.find((f: any) => f.id === feedback._id.toString());
      expect(foundFeedback).toBeDefined();
      expect(foundFeedback.status).toBe('read');
    });
  });

  describe('Feedback Persistence', () => {
    it('should not delete feedback when updating status', async () => {
      const feedback = await Feedback.create({
        content: 'Test feedback',
        type: 'bug',
        status: 'new'
      });

      const feedbackId = feedback._id.toString();

      // Update status multiple times
      const statuses: Array<'new' | 'read' | 'archived'> = ['read', 'archived', 'read', 'new'];
      
      for (const status of statuses) {
        const req = createMockRequest({
          params: { id: feedbackId },
          body: { status }
        }) as Request;

        const res = createMockResponse() as Response;
        await updateFeedbackStatus(req, res);

        // Verify feedback still exists
        const exists = await Feedback.findById(feedbackId);
        expect(exists).not.toBeNull();
        expect(exists?.status).toBe(status);
      }

      // Final verification
      const finalFeedback = await Feedback.findById(feedbackId);
      expect(finalFeedback).not.toBeNull();
      expect(finalFeedback?.content).toBe('Test feedback');
    });

    it('should maintain all feedback fields after status update', async () => {
      const feedback = await Feedback.create({
        content: 'Detailed feedback',
        type: 'feature',
        status: 'new',
        user: {
          id: 'user123',
          name: 'Test User',
          username: 'testuser'
        },
        email: 'test@example.com'
      });

      const req = createMockRequest({
        params: { id: feedback._id.toString() },
        body: { status: 'read' }
      }) as Request;

      const res = createMockResponse() as Response;
      await updateFeedbackStatus(req, res);

      const updatedFeedback = await Feedback.findById(feedback._id);
      expect(updatedFeedback?.content).toBe('Detailed feedback');
      expect(updatedFeedback?.type).toBe('feature');
      expect(updatedFeedback?.status).toBe('read');
      expect(updatedFeedback?.user?.id).toBe('user123');
      expect(updatedFeedback?.user?.name).toBe('Test User');
      expect(updatedFeedback?.email).toBe('test@example.com');
    });
  });

  describe('Feedback Query Behavior', () => {
    it('should not have implicit filters excluding resolved feedback', async () => {
      // Create feedback with different statuses
      await Feedback.create([
        { content: 'New 1', type: 'bug', status: 'new' },
        { content: 'Read 1', type: 'bug', status: 'read' },
        { content: 'Archived 1', type: 'bug', status: 'archived' },
      ]);

      // Query without status filter should return all
      const req = createMockRequest({
        query: {}
      }) as Request;

      const res = createMockResponse() as Response;
      await getFeedback(req, res);

      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData.data).toHaveLength(3);
      expect(responseData.total).toBe(3);
    });

    it('should not filter out feedback based on status unless explicitly requested', async () => {
      // Create mixed status feedback
      const newFeedback = await Feedback.create({
        content: 'New feedback',
        type: 'bug',
        status: 'new'
      });

      const readFeedback = await Feedback.create({
        content: 'Read feedback',
        type: 'feature',
        status: 'read'
      });

      // Query all feedback
      const req = createMockRequest({
        query: {}
      }) as Request;

      const res = createMockResponse() as Response;
      await getFeedback(req, res);

      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      const ids = responseData.data.map((f: any) => f.id);
      
      expect(ids).toContain(newFeedback._id.toString());
      expect(ids).toContain(readFeedback._id.toString());
    });
  });
});

