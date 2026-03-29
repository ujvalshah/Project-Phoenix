import { Request, Response } from 'express';
import { LegalPage } from '../models/LegalPage.js';
import { updateLegalPageSchema } from '../utils/validation.js';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';

/** Normalize a LegalPage document to a clean JSON shape (without content) */
function normalizePage(page: Record<string, unknown>) {
  return {
    slug: page.slug,
    title: page.title,
    enabled: page.enabled,
    noindex: page.noindex,
    lastUpdated: page.lastUpdated,
    effectiveDate: page.effectiveDate,
    showInFooter: page.showInFooter,
    description: page.description,
    order: page.order,
  };
}

/**
 * GET /api/legal
 * Returns all legal pages sorted by order (metadata only, no content).
 * Includes disabled pages so the admin panel can display them.
 */
export const getLegalPages = async (req: Request, res: Response) => {
  try {
    const pages = await LegalPage.find()
      .select('-content')
      .sort({ order: 1 })
      .lean();

    res.json(pages.map(normalizePage));
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const requestLogger = createRequestLogger(req.id || 'unknown', undefined, req.path);
    requestLogger.error({
      msg: '[Legal] Get legal pages error',
      error: { message: err.message, stack: err.stack },
    });
    captureException(err, { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * GET /api/legal/:slug
 * Returns a single legal page including content.
 * Returns 404 if not found.
 */
export const getLegalPageBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const page = await LegalPage.findOne({ slug }).lean();

    if (!page) {
      return res.status(404).json({ message: 'Legal page not found' });
    }

    res.json({
      ...normalizePage(page),
      content: page.content,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const requestLogger = createRequestLogger(req.id || 'unknown', undefined, req.path);
    requestLogger.error({
      msg: '[Legal] Get legal page by slug error',
      error: { message: err.message, stack: err.stack },
    });
    captureException(err, { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * PATCH /api/admin/legal/:slug
 * Updates a legal page's metadata and/or content (admin only).
 */
export const updateLegalPage = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const validationResult = updateLegalPageSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationResult.error.errors,
      });
    }

    const page = await LegalPage.findOneAndUpdate(
      { slug },
      { $set: validationResult.data },
      { new: true, lean: true }
    );

    if (!page) {
      return res.status(404).json({ message: 'Legal page not found' });
    }

    res.json({
      ...normalizePage(page),
      content: page.content,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const requestLogger = createRequestLogger(
      req.id || 'unknown',
      (req as Record<string, unknown>).userId as string | undefined,
      req.path
    );
    requestLogger.error({
      msg: '[Legal] Update legal page error',
      error: { message: err.message, stack: err.stack },
    });
    captureException(err, { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};
