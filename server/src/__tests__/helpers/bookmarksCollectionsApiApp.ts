import express from 'express';
import cookieParser from 'cookie-parser';
import bookmarksRouter from '../../routes/bookmarks.js';
import collectionsRouter from '../../routes/collections.js';

/**
 * Minimal Express app for Supertest — bookmarks + editorial collections only.
 * CSRF is skipped when `Authorization: Bearer` is present (see `csrfProtection`).
 */
export function createBookmarksCollectionsApiApp(): express.Express {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/bookmarks', bookmarksRouter);
  app.use('/api/collections', collectionsRouter);
  return app;
}
