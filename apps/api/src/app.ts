import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { recordActiveSpanException, setActiveSpanAttributes } from './lib/observability.js';
import { requireActor, requireGlobalOperator } from './middleware/auth.js';
import { logRequestError, runRequestContext } from './lib/request-context.js';
import { auditRouter } from './routes/audit.js';
import { boardsRouter } from './routes/boards.js';
import { healthRouter } from './routes/health.js';
import { ideasRouter } from './routes/ideas.js';
import { membersRouter } from './routes/members.js';
import { operatorRouter } from './routes/operator.js';
import { publicRouter } from './routes/public.js';
import { tenantsRouter } from './routes/tenants.js';
import { webhooksRouter } from './routes/webhooks.js';
import { ssoRouter } from './routes/sso.js';
import { ssoConnectionsRouter } from './routes/sso-connections.js';

export function createApp(): express.Express {
  const app = express();

  app.use(cors({
    exposedHeaders: ['x-request-id', 'x-tenant-visitor-token', 'x-tenant-visitor-expires-at', 'x-tenant-visitor-tenant'],
  }));
  app.use((req, res, next) => {
    const requestIdHeader = req.header('x-request-id');
    const requestId = requestIdHeader && requestIdHeader.trim().length > 0 ? requestIdHeader.trim() : randomUUID();
    res.setHeader('x-request-id', requestId);

    runRequestContext(
      {
        requestId,
        source: 'api',
        method: req.method,
        path: req.path,
      },
      () => {
        setActiveSpanAttributes({
          'cv.request_id': requestId,
          'cv.source': 'api',
          'cv.http_method': req.method,
          'cv.path': req.path,
        });
        next();
      },
    );
  });
  app.use(express.json());
  app.use(healthRouter);

  // Public routes (no auth required)
  app.use('/api/v1', publicRouter);
  app.use('/api/v1', ssoRouter);
  app.use('/api/v1/operator', requireGlobalOperator, operatorRouter);

  // Authenticated routes
  app.use('/api/v1', requireActor, boardsRouter);
  app.use('/api/v1', requireActor, ideasRouter);
  app.use('/api/v1', requireActor, membersRouter);
  app.use('/api/v1', requireActor, auditRouter);
  app.use('/api/v1', requireActor, webhooksRouter);
  app.use('/api/v1', requireActor, ssoConnectionsRouter);
  app.use('/api/v1', requireActor, tenantsRouter);

  app.use(
    (err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      void next;
      recordActiveSpanException(err, {
        'cv.error': 'request_failed',
      });
      logRequestError('request_failed', { error: err.message });
      res.status(500).json({ error: 'internal_error', message: err.message });
    },
  );

  return app;
}
