import { closePool } from './client.js';
import { runMigrations } from './migrations.js';

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
