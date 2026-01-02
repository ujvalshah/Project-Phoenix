import { Request, Response } from 'express';
import { Feedback } from '../models/Feedback.js';
import { normalizeDoc, normalizeDocs } from '../utils/db.js';
import { z } from 'zod';
import { createSearchRegex } from '../utils/escapeRegExp.js';

// Validation schemas
const createFeedbackSchema = z.object({
  content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
  type: z.enum(['bug', 'feature', 'general']).optional(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    fullName: z.string().optional(),
    username: z.string().optional(),
    avatar: z.string().optional()
  }).optional(),
  email: z.union([
    z.string().email('Invalid email format'),
    z.literal(''),
    z.undefined()
  ]).optional()
});

const updateFeedbackStatusSchema = z.object({
  status: z.enum(['new', 'read', 'archived'])
});

/**
 * GET /api/feedback
 * Get all feedback entries
 */
export const getFeedback = async (req: Request, res: Response) => {
  try {
    const { status, type, q } = req.query;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100);
    const skip = (page - 1) * limit;
    
    // Build query
    const query: any = {};
    if (status) {
      query.status = status;
    }
    if (type) {
      query.type = type;
    }
    // SECURITY: createSearchRegex escapes user input to prevent ReDoS
    if (q && typeof q === 'string' && q.trim().length > 0) {
      const regex = createSearchRegex(q);
      query.$or = [
        { content: regex },
        { email: regex },
        { 'user.name': regex },
        { 'user.username': regex }
      ];
    }
    
    const [feedback, total] = await Promise.all([
      Feedback.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Feedback.countDocuments(query)
    ]);
    
    res.json({
      data: normalizeDocs(feedback),
      total,
      page,
      limit,
      hasMore: page * limit < total
    });
  } catch (error: any) {
    console.error('[Feedback] Get feedback error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * POST /api/feedback
 * Create a new feedback entry
 */
export const createFeedback = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = createFeedbackSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }

    const { id, ...feedbackData } = validationResult.data; // Remove id if present (let MongoDB generate _id)
    
    // Create new feedback
    const newFeedback = await Feedback.create({
      ...feedbackData,
      type: feedbackData.type || 'general',
      status: 'new'
    });
    
    res.status(201).json(normalizeDoc(newFeedback));
  } catch (error: any) {
    console.error('[Feedback] Create feedback error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * PATCH /api/feedback/:id/status
 * Update feedback status
 */
export const updateFeedbackStatus = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = updateFeedbackStatusSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }

    const { status } = validationResult.data;
    
    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }
    
    res.json(normalizeDoc(feedback));
  } catch (error: any) {
    console.error('[Feedback] Update feedback status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * DELETE /api/feedback/:id
 * Delete a feedback entry
 */
export const deleteFeedback = async (req: Request, res: Response) => {
  try {
    const feedback = await Feedback.findByIdAndDelete(req.params.id);
    
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }
    
    res.status(204).send();
  } catch (error: any) {
    console.error('[Feedback] Delete feedback error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};









