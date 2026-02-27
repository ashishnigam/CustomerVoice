import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { pingDatabase } from '../db/migrations.js';

export const healthRouter = Router();

healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    await pingDatabase();
    res.status(200).json({
      status: 'ok',
      service: 'api',
      dependencies: {
        postgres: 'ok',
      },
      timestamp: new Date().toISOString(),
    });
  }),
);
