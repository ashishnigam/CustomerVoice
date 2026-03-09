import { closePool, query } from './client.js';

type Row = Record<string, unknown>;

interface AuditCheck {
  name: string;
  sql: string;
  hasFailures: (rows: Row[]) => boolean;
  summarize: (rows: Row[]) => string[];
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => formatValue(item)).join(', ')}]`;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function summarizeRows(rows: Row[]): string[] {
  return rows.slice(0, 10).map((row) =>
    Object.entries(row)
      .map(([key, value]) => `${key}=${formatValue(value)}`)
      .join(', '),
  );
}

const checks: AuditCheck[] = [
  {
    name: 'Active boards missing tenant-aware routing keys',
    sql: `
      SELECT id, slug, tenant_id, public_board_key
      FROM boards
      WHERE active = TRUE
        AND (tenant_id IS NULL OR public_board_key IS NULL)
      ORDER BY slug ASC
    `,
    hasFailures: (rows) => rows.length > 0,
    summarize: summarizeRows,
  },
  {
    name: 'Legacy board slugs that still collide across tenants',
    sql: `
      SELECT
        slug,
        COUNT(DISTINCT tenant_id)::int AS tenant_count,
        ARRAY_AGG(id ORDER BY id) AS board_ids
      FROM boards
      WHERE active = TRUE
      GROUP BY slug
      HAVING COUNT(DISTINCT tenant_id) > 1
      ORDER BY slug ASC
    `,
    hasFailures: (rows) => rows.length > 0,
    summarize: summarizeRows,
  },
  {
    name: 'Active portal sessions missing tenant context',
    sql: `
      SELECT id, user_id, expires_at
      FROM portal_sessions
      WHERE expires_at > NOW()
        AND tenant_id IS NULL
      ORDER BY expires_at DESC
    `,
    hasFailures: (rows) => rows.length > 0,
    summarize: summarizeRows,
  },
  {
    name: 'Active SSO connections missing tenant ownership',
    sql: `
      SELECT id, domain, workspace_id
      FROM sso_connections
      WHERE active = TRUE
        AND tenant_id IS NULL
      ORDER BY domain ASC
    `,
    hasFailures: (rows) => rows.length > 0,
    summarize: summarizeRows,
  },
  {
    name: 'Tenant-owned tables with missing tenant_id backfill',
    sql: `
      SELECT table_name, missing_count
      FROM (
        SELECT 'boards' AS table_name, COUNT(*)::int AS missing_count FROM boards WHERE tenant_id IS NULL
        UNION ALL
        SELECT 'ideas', COUNT(*)::int FROM ideas WHERE tenant_id IS NULL
        UNION ALL
        SELECT 'idea_comments', COUNT(*)::int FROM idea_comments WHERE tenant_id IS NULL
        UNION ALL
        SELECT 'idea_votes', COUNT(*)::int FROM idea_votes WHERE tenant_id IS NULL
        UNION ALL
        SELECT 'idea_subscriptions', COUNT(*)::int FROM idea_subscriptions WHERE tenant_id IS NULL
        UNION ALL
        SELECT 'idea_favorites', COUNT(*)::int FROM idea_favorites WHERE tenant_id IS NULL
        UNION ALL
        SELECT 'comment_upvotes', COUNT(*)::int FROM comment_upvotes WHERE tenant_id IS NULL
        UNION ALL
        SELECT 'portal_sessions', COUNT(*)::int FROM portal_sessions WHERE tenant_id IS NULL
        UNION ALL
        SELECT 'workspace_memberships', COUNT(*)::int FROM workspace_memberships WHERE tenant_id IS NULL
        UNION ALL
        SELECT 'workspace_role_permissions', COUNT(*)::int FROM workspace_role_permissions WHERE tenant_id IS NULL
        UNION ALL
        SELECT 'audit_events', COUNT(*)::int FROM audit_events WHERE tenant_id IS NULL
        UNION ALL
        SELECT 'webhooks', COUNT(*)::int FROM webhooks WHERE tenant_id IS NULL
        UNION ALL
        SELECT 'notification_jobs', COUNT(*)::int FROM notification_jobs WHERE tenant_id IS NULL
        UNION ALL
        SELECT 'notification_job_recipients', COUNT(*)::int FROM notification_job_recipients WHERE tenant_id IS NULL
      ) AS coverage
      WHERE missing_count > 0
      ORDER BY table_name ASC
    `,
    hasFailures: (rows) => rows.length > 0,
    summarize: summarizeRows,
  },
  {
    name: 'Persisted public activity missing tenant_actor_id',
    sql: `
      SELECT table_name, missing_count
      FROM (
        SELECT 'ideas' AS table_name, COUNT(*)::int AS missing_count
        FROM ideas
        WHERE active = TRUE
          AND tenant_actor_id IS NULL
        UNION ALL
        SELECT 'idea_comments', COUNT(*)::int
        FROM idea_comments
        WHERE active = TRUE
          AND tenant_actor_id IS NULL
        UNION ALL
        SELECT 'idea_votes', COUNT(*)::int
        FROM idea_votes
        WHERE tenant_actor_id IS NULL
        UNION ALL
        SELECT 'idea_subscriptions', COUNT(*)::int
        FROM idea_subscriptions
        WHERE tenant_actor_id IS NULL
        UNION ALL
        SELECT 'idea_favorites', COUNT(*)::int
        FROM idea_favorites
        WHERE tenant_actor_id IS NULL
        UNION ALL
        SELECT 'comment_upvotes', COUNT(*)::int
        FROM comment_upvotes
        WHERE tenant_actor_id IS NULL
      ) AS coverage
      WHERE missing_count > 0
      ORDER BY table_name ASC
    `,
    hasFailures: (rows) => rows.length > 0,
    summarize: summarizeRows,
  },
];

async function main(): Promise<void> {
  let hasFailures = false;

  try {
    console.log('Phase 7 cutover audit');
    console.log('');

    for (const check of checks) {
      const result = await query<Row>(check.sql);
      const failed = check.hasFailures(result.rows);
      const marker = failed ? 'FAIL' : 'PASS';

      console.log(`[${marker}] ${check.name}`);
      for (const line of check.summarize(result.rows)) {
        console.log(`  - ${line}`);
      }

      if (!failed && result.rows.length === 0) {
        console.log('  - clean');
      }

      console.log('');
      hasFailures = hasFailures || failed;
    }
  } finally {
    await closePool();
  }

  if (hasFailures) {
    process.exitCode = 1;
    return;
  }

  console.log('Phase 7 cutover audit passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
