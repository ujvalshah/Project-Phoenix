import { Request, Response } from 'express';
import { ContactMessage } from '../models/ContactMessage.js';
import { normalizeDoc, normalizeDocs } from '../utils/db.js';
import { z } from 'zod';
import { createSearchRegex } from '../utils/escapeRegExp.js';
import { createRequestLogger } from '../utils/logger.js';

// Validation schemas
const createContactMessageSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email format'),
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject too long'),
  message: z.string().min(1, 'Message is required').max(5000, 'Message too long')
});

const updateContactStatusSchema = z.object({
  status: z.enum(['new', 'read', 'replied', 'archived'])
});

/**
 * POST /api/contact
 * Create a new contact message (public)
 */
export const createContactMessage = async (req: Request, res: Response) => {
  try {
    const validationResult = createContactMessageSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationResult.error.errors
      });
    }

    const newMessage = await ContactMessage.create({
      ...validationResult.data,
      status: 'new'
    });

    res.status(201).json(normalizeDoc(newMessage));
  } catch (error: unknown) {
    const logger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    logger.error({ err: error }, '[Contact] Create contact message error');
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * GET /api/contact
 * Get all contact messages with filtering and pagination
 */
export const getContactMessages = async (req: Request, res: Response) => {
  try {
    const { status, q } = req.query;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (status) {
      query.status = status;
    }

    // SECURITY: createSearchRegex escapes user input to prevent ReDoS
    if (q && typeof q === 'string' && q.trim().length > 0) {
      const regex = createSearchRegex(q);
      query.$or = [
        { name: regex },
        { email: regex },
        { subject: regex },
        { message: regex }
      ];
    }

    const [messages, total] = await Promise.all([
      ContactMessage.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ContactMessage.countDocuments(query)
    ]);

    res.json({
      data: normalizeDocs(messages),
      total,
      page,
      limit,
      hasMore: page * limit < total
    });
  } catch (error: unknown) {
    const logger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    logger.error({ err: error }, '[Contact] Get contact messages error');
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * PATCH /api/contact/:id/status
 * Update contact message status
 */
export const updateContactStatus = async (req: Request, res: Response) => {
  try {
    const validationResult = updateContactStatusSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationResult.error.errors
      });
    }

    const { status } = validationResult.data;

    const message = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!message) {
      return res.status(404).json({ message: 'Contact message not found' });
    }

    res.json(normalizeDoc(message));
  } catch (error: unknown) {
    const logger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    logger.error({ err: error }, '[Contact] Update contact status error');
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * DELETE /api/contact/:id
 * Delete a contact message
 */
export const deleteContactMessage = async (req: Request, res: Response) => {
  try {
    const message = await ContactMessage.findByIdAndDelete(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Contact message not found' });
    }

    res.status(204).send();
  } catch (error: unknown) {
    const logger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    logger.error({ err: error }, '[Contact] Delete contact message error');
    res.status(500).json({ message: 'Internal server error' });
  }
};
