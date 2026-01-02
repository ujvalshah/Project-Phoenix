import { Request, Response } from 'express';
import { LegalPage } from '../models/LegalPage.js';
import { normalizeDoc, normalizeDocs } from '../utils/db.js';

export const getLegalPages = async (req: Request, res: Response) => {
  try {
    const pages = await LegalPage.find({ isEnabled: true }).sort({ title: 1 });
    res.json(normalizeDocs(pages));
  } catch (error: any) {
    console.error('[Legal] Get legal pages error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getLegalPageBySlug = async (req: Request, res: Response) => {
  try {
    const page = await LegalPage.findOne({ slug: req.params.slug, isEnabled: true });
    if (!page) return res.status(404).json({ message: 'Page not found' });
    res.json(normalizeDoc(page));
  } catch (error: any) {
    console.error('[Legal] Get legal page by slug error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
