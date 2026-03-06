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
  {
    id: '005_portal_access_and_engagement',
    sql: `
      CREATE TABLE IF NOT EXISTS board_settings (
        board_id                TEXT PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
        access_mode             TEXT NOT NULL DEFAULT 'public' CHECK (access_mode IN ('public', 'link_only', 'private', 'domain_restricted')),
        allowed_domains         TEXT[] NOT NULL DEFAULT '{}',
        allowed_emails          TEXT[] NOT NULL DEFAULT '{}',
        require_auth_to_vote    BOOLEAN NOT NULL DEFAULT false,
        require_auth_to_comment BOOLEAN NOT NULL DEFAULT true,
        require_auth_to_submit  BOOLEAN NOT NULL DEFAULT true,
        allow_anonymous_ideas   BOOLEAN NOT NULL DEFAULT false,
        custom_logo_url         TEXT,
        custom_accent_color     TEXT,
        portal_title            TEXT,
        show_vote_count         BOOLEAN NOT NULL DEFAULT true,
        show_status_filter      BOOLEAN NOT NULL DEFAULT true,
        show_category_filter    BOOLEAN NOT NULL DEFAULT true,
        enable_idea_submission  BOOLEAN NOT NULL DEFAULT true,
        enable_commenting       BOOLEAN NOT NULL DEFAULT true,
        welcome_message         TEXT,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS portal_users (
        id              TEXT PRIMARY KEY,
        email           TEXT NOT NULL UNIQUE,
        display_name    TEXT,
        password_hash   TEXT,
        avatar_url      TEXT,
        auth_provider   TEXT NOT NULL DEFAULT 'email',
        provider_id     TEXT,
        email_verified  BOOLEAN NOT NULL DEFAULT false,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_portal_users_email
        ON portal_users (email);

      CREATE TABLE IF NOT EXISTS portal_sessions (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
        token       TEXT NOT NULL UNIQUE,
        expires_at  TIMESTAMPTZ NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_portal_sessions_token
        ON portal_sessions (token);

      CREATE INDEX IF NOT EXISTS idx_portal_sessions_user_id
        ON portal_sessions (user_id);

      CREATE TABLE IF NOT EXISTS idea_tags (
        id            TEXT PRIMARY KEY,
        workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name          TEXT NOT NULL,
        tag_type      TEXT NOT NULL DEFAULT 'general',
        color_hex     TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(workspace_id, name)
      );

      CREATE TABLE IF NOT EXISTS idea_tag_links (
        idea_id     TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
        tag_id      TEXT NOT NULL REFERENCES idea_tags(id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(idea_id, tag_id)
      );

      CREATE INDEX IF NOT EXISTS idx_idea_tag_links_tag_id
        ON idea_tag_links (tag_id);
    `,
  },
  {
    id: '006_engagement_features',
    sql: `
      CREATE TABLE IF NOT EXISTS idea_subscriptions (
        idea_id    TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
        user_id    TEXT NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
        notify_on  TEXT[] NOT NULL DEFAULT ARRAY['status_change','official_response','new_comment'],
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(idea_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_idea_subscriptions_user_id
        ON idea_subscriptions (user_id);

      CREATE TABLE IF NOT EXISTS idea_favorites (
        idea_id    TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
        user_id    TEXT NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(idea_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_idea_favorites_user_id
        ON idea_favorites (user_id);

      ALTER TABLE idea_comments ADD COLUMN IF NOT EXISTS is_official    BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE idea_comments ADD COLUMN IF NOT EXISTS is_team_member BOOLEAN NOT NULL DEFAULT false;
    `,
  },
  {
    id: '007_platform_excellence',
    sql: `
      -- Extend board_settings for custom branding
      ALTER TABLE board_settings ADD COLUMN IF NOT EXISTS custom_css TEXT;
      ALTER TABLE board_settings ADD COLUMN IF NOT EXISTS favicon_url TEXT;
      ALTER TABLE board_settings ADD COLUMN IF NOT EXISTS header_bg_color TEXT;
      ALTER TABLE board_settings ADD COLUMN IF NOT EXISTS font_family TEXT;
      ALTER TABLE board_settings ADD COLUMN IF NOT EXISTS hide_powered_by BOOLEAN NOT NULL DEFAULT false;

      -- Changelog entries
      CREATE TABLE IF NOT EXISTS changelog_entries (
        id              TEXT PRIMARY KEY,
        workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        board_id        TEXT REFERENCES boards(id) ON DELETE CASCADE,
        title           TEXT NOT NULL,
        body            TEXT NOT NULL,
        entry_type      TEXT NOT NULL CHECK (entry_type IN ('feature','improvement','bugfix','announcement')),
        related_idea_ids TEXT[] NOT NULL DEFAULT '{}',
        published_at    TIMESTAMPTZ,
        created_by      TEXT REFERENCES users(id),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_changelog_entries_workspace_board
        ON changelog_entries (workspace_id, board_id, published_at DESC);

      -- Comment threading + upvotes
      ALTER TABLE idea_comments ADD COLUMN IF NOT EXISTS parent_comment_id TEXT REFERENCES idea_comments(id);
      ALTER TABLE idea_comments ADD COLUMN IF NOT EXISTS upvote_count INT NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS comment_upvotes (
        comment_id  TEXT NOT NULL REFERENCES idea_comments(id) ON DELETE CASCADE,
        user_id     TEXT NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(comment_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_comment_upvotes_comment_id
        ON comment_upvotes (comment_id);

      -- Webhooks
      CREATE TABLE IF NOT EXISTS webhooks (
        id              TEXT PRIMARY KEY,
        workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        url             TEXT NOT NULL,
        events          TEXT[] NOT NULL,
        secret          TEXT NOT NULL,
        active          BOOLEAN NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_webhooks_workspace_active
        ON webhooks (workspace_id, active);

      -- Password reset tokens
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
        token       TEXT NOT NULL UNIQUE,
        expires_at  TIMESTAMPTZ NOT NULL,
        used        BOOLEAN NOT NULL DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token
        ON password_reset_tokens (token);
    `,
  },
  {
    id: '008_auth_notifications',
    sql: `
      ALTER TABLE notification_jobs ALTER COLUMN board_id DROP NOT NULL;
      ALTER TABLE notification_jobs ALTER COLUMN idea_id DROP NOT NULL;
      ALTER TABLE notification_jobs ALTER COLUMN workspace_id DROP NOT NULL;
      ALTER TABLE notification_job_recipients ALTER COLUMN workspace_id DROP NOT NULL;
    `,
  },
  {
    id: '009_idea_attachments',
    sql: `
      CREATE TABLE IF NOT EXISTS idea_attachments (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        content_type TEXT NOT NULL,
        size_bytes INT NOT NULL,
        created_by TEXT REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_idea_attachments_idea
        ON idea_attachments (idea_id);

      CREATE TABLE IF NOT EXISTS comment_attachments (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
        comment_id TEXT NOT NULL REFERENCES idea_comments(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        content_type TEXT NOT NULL,
        size_bytes INT NOT NULL,
        created_by TEXT REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_comment_attachments_comment
        ON comment_attachments (comment_id);
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
