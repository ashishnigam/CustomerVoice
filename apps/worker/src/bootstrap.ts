import { loadLocalEnv } from './load-env.js';

loadLocalEnv();

const { startObservability } = await import('./observability.js');
await startObservability();

await import('./index.js');
