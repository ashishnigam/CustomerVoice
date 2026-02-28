import { createApp } from './app.js';
import { closePool } from './db/client.js';
import { runBootstrapSeed } from './db/bootstrap-seed.js';
import { runMigrations } from './db/migrations.js';
const app = createApp();
const port = Number(process.env.PORT ?? 4000);

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
