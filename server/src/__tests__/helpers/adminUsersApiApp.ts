import express from 'express';
import cookieParser from 'cookie-parser';
import adminRouter from '../../routes/admin.js';
import usersRouter from '../../routes/users.js';

export function createAdminUsersApiApp(): express.Express {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  app.use('/api/users', usersRouter);
  return app;
}
