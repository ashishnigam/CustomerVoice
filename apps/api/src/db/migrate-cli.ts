import { loadLocalEnv } from '../lib/load-env.js';

loadLocalEnv();

const [{ closePool }, { runMigrations }] = await Promise.all([
  import('./client.js'),
  import('./migrations.js'),
]);

async function main(): Promise<void> {
  await runMigrations();
  await closePool();
  console.log('[migrate] completed');
}

main().catch(async (error: Error) => {
  console.error('[migrate] failed', error);
  await closePool();
  process.exit(1);
});
