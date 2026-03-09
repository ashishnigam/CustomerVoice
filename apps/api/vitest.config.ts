import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.ts'],
    coverage: {
      enabled: false,
      provider: 'v8',
      reportsDirectory: './coverage',
      clean: false,
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      all: true,
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/db/migrate-cli.ts',
        'src/db/phase7-cutover-audit-cli.ts',
      ],
    },
  },
});
