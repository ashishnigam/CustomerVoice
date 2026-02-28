import cors from 'cors';
import express from 'express';
import { requireActor } from './middleware/auth.js';
import { auditRouter } from './routes/audit.js';
import { boardsRouter } from './routes/boards.js';
import { healthRouter } from './routes/health.js';
import { ideasRouter } from './routes/ideas.js';
import { membersRouter } from './routes/members.js';

export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(healthRouter);

  app.use('/api/v1', requireActor, boardsRouter);
  app.use('/api/v1', requireActor, ideasRouter);
  app.use('/api/v1', requireActor, membersRouter);
  app.use('/api/v1', requireActor, auditRouter);

  app.use(
    (err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      void next;
      res.status(500).json({ error: 'internal_error', message: err.message });
    },
  );

  return app;
}
