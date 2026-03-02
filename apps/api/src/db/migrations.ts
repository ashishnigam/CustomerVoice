import { query, withTransaction } from './client.js';

interface Migration {
  id: string;
  sql: string;
}

const roles = [
  "'tenant_admin'",
  "'workspace_admin'",
  "'product_manager'",
  "'engineering_manager'",
  "'contributor'",
  "'viewer'",
].join(',');

const ideaStatuses = [
  "'new'",
  "'under_review'",
  "'accepted'",
  "'planned'",
  "'in_progress'",
  "'completed'",
  "'declined'",
].join(',');

const moderationStates = ["'normal'", "'spam'", "'merged'"].join(',');

const migrations: Migration[] = [
  {
    id: '001_initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        residency_zone TEXT NOT NULL DEFAULT 'US',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, slug)
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        display_name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS workspace_memberships (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN (${roles})),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        invited_by TEXT REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (workspace_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS workspace_role_permissions (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN (${roles})),
        permission TEXT NOT NULL,
        effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (workspace_id, role, permission)
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        actor_id TEXT NOT NULL REFERENCES users(id),
        action TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_workspace_memberships_workspace_active
        ON workspace_memberships (workspace_id, active);

      CREATE INDEX IF NOT EXISTS idx_audit_events_workspace_created_at
        ON audit_events (workspace_id, created_at DESC);
    `,
  },
  {
    id: '002_boards_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (workspace_id, slug)
      );

      CREATE INDEX IF NOT EXISTS idx_boards_workspace_active
        ON boards (workspace_id, active);
    `,
  },
  {
    id: '003_ideas_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS ideas (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN (${ideaStatuses})),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by TEXT NOT NULL REFERENCES users(id),
        updated_by TEXT REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS idea_votes (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (idea_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS idea_comments (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ideas_workspace_board_status
        ON ideas (workspace_id, board_id, status, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_idea_votes_workspace_idea
        ON idea_votes (workspace_id, idea_id);

      CREATE INDEX IF NOT EXISTS idx_idea_comments_workspace_idea
        ON idea_comments (workspace_id, idea_id, created_at DESC);
    `,
  },
  {
    id: '004_v1_portal_polish_schema',
    sql: `
      ALTER TABLE ideas
      ADD COLUMN IF NOT EXISTS moderation_state TEXT NOT NULL DEFAULT 'normal' CHECK (moderation_state IN (${moderationStates}));

      ALTER TABLE ideas
      ADD COLUMN IF NOT EXISTS comments_locked BOOLEAN NOT NULL DEFAULT FALSE;

      ALTER TABLE ideas
      ADD COLUMN IF NOT EXISTS merged_into_idea_id TEXT REFERENCES ideas(id);

      CREATE INDEX IF NOT EXISTS idx_ideas_workspace_moderation_state
        ON ideas (workspace_id, moderation_state, created_at DESC);

      CREATE TABLE IF NOT EXISTS idea_categories (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        color_hex TEXT,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (workspace_id, slug)
      );

      CREATE TABLE IF NOT EXISTS idea_category_links (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
        category_id TEXT NOT NULL REFERENCES idea_categories(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (idea_id, category_id)
      );

      CREATE INDEX IF NOT EXISTS idx_idea_category_links_workspace_idea
        ON idea_category_links (workspace_id, idea_id);

      CREATE INDEX IF NOT EXISTS idx_idea_category_links_workspace_category
        ON idea_category_links (workspace_id, category_id);

      CREATE TABLE IF NOT EXISTS idea_scoring_inputs (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
        reach NUMERIC(12, 2) NOT NULL DEFAULT 0,
        impact NUMERIC(12, 2) NOT NULL DEFAULT 0,
        confidence NUMERIC(12, 2) NOT NULL DEFAULT 0,
        effort NUMERIC(12, 2) NOT NULL DEFAULT 1,
        revenue_potential_usd NUMERIC(14, 2) NOT NULL DEFAULT 0,
        customer_segment TEXT,
        customer_count INT NOT NULL DEFAULT 0,
        updated_by TEXT REFERENCES users(id),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (workspace_id, idea_id)
      );

      CREATE INDEX IF NOT EXISTS idx_idea_scoring_inputs_workspace_segment
        ON idea_scoring_inputs (workspace_id, customer_segment);

      CREATE TABLE IF NOT EXISTS notification_jobs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        template_id TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead')),
        attempt_count INT NOT NULL DEFAULT 0,
        max_attempts INT NOT NULL DEFAULT 3,
        recipient_count INT NOT NULL DEFAULT 0,
        last_error TEXT,
        created_by TEXT REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS notification_job_recipients (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES notification_jobs(id) ON DELETE CASCADE,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id),
        email TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
        attempts INT NOT NULL DEFAULT 0,
        last_error TEXT,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (job_id, email)
      );

      CREATE INDEX IF NOT EXISTS idx_notification_jobs_workspace_status
        ON notification_jobs (workspace_id, status, created_at ASC);

      CREATE INDEX IF NOT EXISTS idx_notification_recipients_job_status
        ON notification_job_recipients (job_id, status, created_at ASC);
    `,
  },
];

export async function runMigrations(): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const result = await client.query<{ id: string }>('SELECT id FROM schema_migrations');
    const applied = new Set(result.rows.map((row) => row.id));

    for (const migration of migrations) {
      if (applied.has(migration.id)) {
        continue;
      }

      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
    }
  });
}

export async function pingDatabase(): Promise<void> {
  await query('SELECT 1');
}
