import express from 'express';
import cookieParser from 'cookie-parser';
import articlesRouter from '../../routes/articles.js';

export function createArticlesApiApp(): express.Express {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/articles', articlesRouter);
  return app;
}
