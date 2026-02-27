import cors from 'cors';
import express from 'express';
import { closePool } from './db/client.js';
import { runBootstrapSeed } from './db/bootstrap-seed.js';
import { runMigrations } from './db/migrations.js';
import { auditRouter } from './routes/audit.js';
import { healthRouter } from './routes/health.js';
import { membersRouter } from './routes/members.js';
import { requireActor } from './middleware/auth.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());
app.use(healthRouter);

app.use('/api/v1', requireActor, membersRouter);
app.use('/api/v1', requireActor, auditRouter);

app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  void next;
  res.status(500).json({ error: 'internal_error', message: err.message });
});

async function bootstrap(): Promise<void> {
  await runMigrations();
  await runBootstrapSeed();

  const server = app.listen(port, () => {
    console.log(`customerVoice api listening on http://localhost:${port}`);
  });

  const shutdown = async () => {
    server.close();
    await closePool();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error: Error) => {
  console.error('[bootstrap] failed to start api', error);
  process.exit(1);
});
