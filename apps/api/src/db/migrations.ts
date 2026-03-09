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
  {
    id: '010_idea_merging',
    sql: `
      ALTER TABLE ideas ADD COLUMN IF NOT EXISTS merged_into_id TEXT REFERENCES ideas(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_ideas_merged_into_id ON ideas (merged_into_id);
    `,
  },
  {
    id: '011_internal_staff_comments',
    sql: `
      ALTER TABLE idea_comments ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;
    `,
  },
  {
    id: '012_mrr_tracking',
    sql: `
      ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS mrr NUMERIC(14, 2) NOT NULL DEFAULT 0;
    `,
  },
  {
    id: '013_enterprise_sso',
    sql: `
      CREATE TABLE IF NOT EXISTS sso_connections (
        id              TEXT PRIMARY KEY,
        workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        provider        TEXT NOT NULL CHECK (provider IN ('okta', 'azure', 'custom_saml', 'oidc')),
        domain          TEXT NOT NULL,
        client_id       TEXT,
        client_secret   TEXT,
        metadata_url    TEXT,
        active          BOOLEAN NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (workspace_id, domain)
      );

      CREATE INDEX IF NOT EXISTS idx_sso_connections_domain ON sso_connections (domain);
    `,
  },
  {
    id: '014_tenant_domain_foundation',
    sql: `
      ALTER TABLE tenants
        ADD COLUMN IF NOT EXISTS tenant_key TEXT DEFAULT CONCAT('tnt_', SUBSTRING(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 24)),
        ADD COLUMN IF NOT EXISTS tenant_type TEXT NOT NULL DEFAULT 'enterprise' CHECK (tenant_type IN ('enterprise', 'personal')),
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_setup', 'suspended')),
        ADD COLUMN IF NOT EXISTS primary_domain TEXT,
        ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

      UPDATE tenants
      SET
        tenant_key = COALESCE(tenant_key, CONCAT('tnt_', SUBSTRING(md5(id) FROM 1 FOR 24))),
        tenant_type = COALESCE(tenant_type, 'enterprise'),
        status = COALESCE(status, 'active'),
        features = COALESCE(features, '{}'::jsonb),
        updated_at = COALESCE(updated_at, NOW())
      WHERE tenant_key IS NULL
         OR tenant_type IS NULL
         OR status IS NULL
         OR features IS NULL
         OR updated_at IS NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_tenant_key
        ON tenants (tenant_key);

      CREATE TABLE IF NOT EXISTS tenant_domains (
        id                  TEXT PRIMARY KEY,
        tenant_id           TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        domain              TEXT NOT NULL,
        is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
        domain_kind         TEXT NOT NULL CHECK (domain_kind IN ('enterprise', 'public_email_provider', 'alias')),
        verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed', 'blocked')),
        verification_method TEXT NOT NULL DEFAULT 'system' CHECK (verification_method IN ('dns_txt', 'email', 'manual', 'system')),
        verification_token  TEXT,
        verified_at         TIMESTAMPTZ,
        active              BOOLEAN NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_domains_domain
        ON tenant_domains (LOWER(domain));

      CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant_id
        ON tenant_domains (tenant_id, active, verification_status);
    `,
  },
  {
    id: '015_tenant_scope_backfill_columns',
    sql: `
      ALTER TABLE boards
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS public_board_key TEXT DEFAULT CONCAT('brd_', SUBSTRING(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 18));

      UPDATE boards b
      SET tenant_id = w.tenant_id
      FROM workspaces w
      WHERE b.workspace_id = w.id
        AND b.tenant_id IS NULL;

      UPDATE boards
      SET public_board_key = COALESCE(NULLIF(public_board_key, ''), slug)
      WHERE public_board_key IS NULL OR public_board_key = '';

      CREATE UNIQUE INDEX IF NOT EXISTS idx_boards_tenant_public_board_key
        ON boards (tenant_id, public_board_key);

      CREATE INDEX IF NOT EXISTS idx_boards_tenant_slug
        ON boards (tenant_id, slug);

      ALTER TABLE sso_connections
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;

      UPDATE sso_connections sc
      SET tenant_id = w.tenant_id
      FROM workspaces w
      WHERE sc.workspace_id = w.id
        AND sc.tenant_id IS NULL;

      CREATE INDEX IF NOT EXISTS idx_sso_connections_tenant_domain
        ON sso_connections (tenant_id, domain);
    `,
  },
  {
    id: '016_public_identity_multitenant',
    sql: `
      CREATE TABLE IF NOT EXISTS portal_tenant_profiles (
        id            TEXT PRIMARY KEY,
        tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        portal_user_id TEXT NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
        account_type  TEXT NOT NULL CHECK (account_type IN ('personal_owner', 'enterprise_member', 'guest')),
        home_domain   TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, portal_user_id)
      );

      CREATE TABLE IF NOT EXISTS tenant_visitors (
        id            TEXT PRIMARY KEY,
        tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        visitor_key   TEXT NOT NULL,
        session_token TEXT NOT NULL,
        expires_at    TIMESTAMPTZ NOT NULL,
        revoked_at    TIMESTAMPTZ,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, visitor_key)
      );

      CREATE TABLE IF NOT EXISTS tenant_actors (
        id                 TEXT PRIMARY KEY,
        tenant_id          TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        actor_type         TEXT NOT NULL CHECK (actor_type IN ('internal_user', 'portal_user', 'visitor', 'system')),
        internal_user_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
        portal_user_id     TEXT REFERENCES portal_users(id) ON DELETE CASCADE,
        tenant_visitor_id  TEXT REFERENCES tenant_visitors(id) ON DELETE CASCADE,
        display_name       TEXT,
        email              TEXT,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_actors_internal_user
        ON tenant_actors (tenant_id, internal_user_id)
        WHERE internal_user_id IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_actors_portal_user
        ON tenant_actors (tenant_id, portal_user_id)
        WHERE portal_user_id IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_actors_visitor
        ON tenant_actors (tenant_id, tenant_visitor_id)
        WHERE tenant_visitor_id IS NOT NULL;

      ALTER TABLE portal_sessions
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE;

      CREATE INDEX IF NOT EXISTS idx_portal_sessions_tenant_token
        ON portal_sessions (tenant_id, token);

      ALTER TABLE ideas
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS tenant_actor_id TEXT REFERENCES tenant_actors(id) ON DELETE SET NULL;

      UPDATE ideas i
      SET tenant_id = b.tenant_id
      FROM boards b
      WHERE i.board_id = b.id
        AND i.tenant_id IS NULL;

      ALTER TABLE idea_comments
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS tenant_actor_id TEXT REFERENCES tenant_actors(id) ON DELETE SET NULL;

      UPDATE idea_comments c
      SET tenant_id = i.tenant_id
      FROM ideas i
      WHERE c.idea_id = i.id
        AND c.tenant_id IS NULL;

      ALTER TABLE idea_votes
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS tenant_actor_id TEXT REFERENCES tenant_actors(id) ON DELETE SET NULL;

      UPDATE idea_votes v
      SET tenant_id = i.tenant_id
      FROM ideas i
      WHERE v.idea_id = i.id
        AND v.tenant_id IS NULL;

      ALTER TABLE idea_subscriptions
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS tenant_actor_id TEXT REFERENCES tenant_actors(id) ON DELETE SET NULL;

      UPDATE idea_subscriptions s
      SET tenant_id = i.tenant_id
      FROM ideas i
      WHERE s.idea_id = i.id
        AND s.tenant_id IS NULL;

      ALTER TABLE idea_favorites
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS tenant_actor_id TEXT REFERENCES tenant_actors(id) ON DELETE SET NULL;

      UPDATE idea_favorites f
      SET tenant_id = i.tenant_id
      FROM ideas i
      WHERE f.idea_id = i.id
        AND f.tenant_id IS NULL;

      ALTER TABLE comment_upvotes
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS tenant_actor_id TEXT REFERENCES tenant_actors(id) ON DELETE SET NULL;

      UPDATE comment_upvotes cu
      SET tenant_id = ic.tenant_id
      FROM idea_comments ic
      WHERE cu.comment_id = ic.id
        AND cu.tenant_id IS NULL;

      CREATE INDEX IF NOT EXISTS idx_ideas_tenant_id ON ideas (tenant_id, board_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_idea_comments_tenant_id ON idea_comments (tenant_id, idea_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_idea_votes_tenant_id ON idea_votes (tenant_id, idea_id);
      CREATE INDEX IF NOT EXISTS idx_idea_subscriptions_tenant_id ON idea_subscriptions (tenant_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_idea_favorites_tenant_id ON idea_favorites (tenant_id, user_id);
    `,
  },
  {
    id: '017_internal_tenant_membership_hardening',
    sql: `
      CREATE TABLE IF NOT EXISTS tenant_memberships (
        tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role        TEXT NOT NULL CHECK (role IN ('tenant_admin', 'tenant_member', 'tenant_guest')),
        status      TEXT NOT NULL DEFAULT 'active',
        invited_by  TEXT REFERENCES users(id),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (tenant_id, user_id)
      );

      INSERT INTO tenant_memberships (tenant_id, user_id, role, status, invited_by)
      SELECT DISTINCT
        w.tenant_id,
        wm.user_id,
        CASE
          WHEN wm.role IN ('tenant_admin', 'workspace_admin') THEN 'tenant_admin'
          ELSE 'tenant_member'
        END,
        CASE WHEN wm.active THEN 'active' ELSE 'inactive' END,
        wm.invited_by
      FROM workspace_memberships wm
      JOIN workspaces w ON w.id = wm.workspace_id
      ON CONFLICT (tenant_id, user_id) DO NOTHING;
    `,
  },
  {
    id: '018_tenant_public_routing_support',
    sql: `
      ALTER TABLE boards
        ALTER COLUMN tenant_id SET NOT NULL,
        ALTER COLUMN public_board_key SET NOT NULL;

      ALTER TABLE sso_connections
        ALTER COLUMN tenant_id SET NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_tenants_primary_domain
        ON tenants (LOWER(primary_domain));
    `,
  },
  {
    id: '019_tenant_actor_upsert_constraints',
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'uq_tenant_actors_internal_user'
        ) THEN
          ALTER TABLE tenant_actors
            ADD CONSTRAINT uq_tenant_actors_internal_user UNIQUE (tenant_id, internal_user_id);
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'uq_tenant_actors_portal_user'
        ) THEN
          ALTER TABLE tenant_actors
            ADD CONSTRAINT uq_tenant_actors_portal_user UNIQUE (tenant_id, portal_user_id);
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'uq_tenant_actors_visitor'
        ) THEN
          ALTER TABLE tenant_actors
            ADD CONSTRAINT uq_tenant_actors_visitor UNIQUE (tenant_id, tenant_visitor_id);
        END IF;
      END $$;
    `,
  },
  {
    id: '020_auth_notification_nullable_context',
    sql: `
      ALTER TABLE notification_jobs
        ALTER COLUMN workspace_id DROP NOT NULL,
        ALTER COLUMN board_id DROP NOT NULL,
        ALTER COLUMN idea_id DROP NOT NULL;

      ALTER TABLE notification_job_recipients
        ALTER COLUMN workspace_id DROP NOT NULL;
    `,
  },
  {
    id: '021_tenant_scope_operability_hardening',
    sql: `
      ALTER TABLE workspace_memberships
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;

      UPDATE workspace_memberships wm
      SET tenant_id = w.tenant_id
      FROM workspaces w
      WHERE wm.workspace_id = w.id
        AND wm.tenant_id IS NULL;

      CREATE INDEX IF NOT EXISTS idx_workspace_memberships_tenant_id
        ON workspace_memberships (tenant_id, workspace_id, active);

      ALTER TABLE workspace_role_permissions
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;

      UPDATE workspace_role_permissions wrp
      SET tenant_id = w.tenant_id
      FROM workspaces w
      WHERE wrp.workspace_id = w.id
        AND wrp.tenant_id IS NULL;

      CREATE INDEX IF NOT EXISTS idx_workspace_role_permissions_tenant_id
        ON workspace_role_permissions (tenant_id, workspace_id, role);

      ALTER TABLE audit_events
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;

      UPDATE audit_events ae
      SET tenant_id = w.tenant_id
      FROM workspaces w
      WHERE ae.workspace_id = w.id
        AND ae.tenant_id IS NULL;

      CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_created_at
        ON audit_events (tenant_id, created_at DESC);

      ALTER TABLE webhooks
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;

      UPDATE webhooks wh
      SET tenant_id = w.tenant_id
      FROM workspaces w
      WHERE wh.workspace_id = w.id
        AND wh.tenant_id IS NULL;

      CREATE INDEX IF NOT EXISTS idx_webhooks_tenant_active
        ON webhooks (tenant_id, active, created_at DESC);

      ALTER TABLE notification_jobs
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;

      UPDATE notification_jobs nj
      SET tenant_id = b.tenant_id
      FROM boards b
      WHERE nj.board_id = b.id
        AND nj.tenant_id IS NULL;

      UPDATE notification_jobs nj
      SET tenant_id = w.tenant_id
      FROM workspaces w
      WHERE nj.workspace_id = w.id
        AND nj.tenant_id IS NULL;

      CREATE INDEX IF NOT EXISTS idx_notification_jobs_tenant_status
        ON notification_jobs (tenant_id, status, created_at ASC);

      ALTER TABLE notification_job_recipients
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;

      UPDATE notification_job_recipients nr
      SET tenant_id = nj.tenant_id
      FROM notification_jobs nj
      WHERE nr.job_id = nj.id
        AND nr.tenant_id IS NULL;

      CREATE INDEX IF NOT EXISTS idx_notification_recipients_tenant_status
        ON notification_job_recipients (tenant_id, status, created_at ASC);

      CREATE TABLE IF NOT EXISTS global_operator_assignments (
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        global_role TEXT NOT NULL CHECK (global_role IN ('support_admin', 'global_admin')),
        active      BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, global_role)
      );

      CREATE TABLE IF NOT EXISTS tenant_impersonation_sessions (
        id               TEXT PRIMARY KEY,
        operator_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        operator_email   TEXT NOT NULL,
        tenant_id        TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        assumed_role     TEXT NOT NULL CHECK (assumed_role IN (${roles})),
        session_token    TEXT NOT NULL UNIQUE,
        expires_at       TIMESTAMPTZ NOT NULL,
        revoked_at       TIMESTAMPTZ,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_tenant_impersonation_active
        ON tenant_impersonation_sessions (tenant_id, revoked_at, expires_at);
    `,
  },
  {
    id: '022_tenant_backfill_repair',
    sql: `
      UPDATE workspace_memberships wm
      SET tenant_id = w.tenant_id
      FROM workspaces w
      WHERE wm.workspace_id = w.id
        AND wm.tenant_id IS NULL;

      UPDATE ideas i
      SET tenant_id = b.tenant_id
      FROM boards b
      WHERE i.board_id = b.id
        AND i.tenant_id IS NULL;

      UPDATE idea_comments c
      SET tenant_id = i.tenant_id
      FROM ideas i
      WHERE c.idea_id = i.id
        AND c.tenant_id IS NULL;

      UPDATE idea_votes v
      SET tenant_id = i.tenant_id
      FROM ideas i
      WHERE v.idea_id = i.id
        AND v.tenant_id IS NULL;

      UPDATE idea_subscriptions s
      SET tenant_id = i.tenant_id
      FROM ideas i
      WHERE s.idea_id = i.id
        AND s.tenant_id IS NULL;

      UPDATE idea_favorites f
      SET tenant_id = i.tenant_id
      FROM ideas i
      WHERE f.idea_id = i.id
        AND f.tenant_id IS NULL;

      UPDATE comment_upvotes cu
      SET tenant_id = ic.tenant_id
      FROM idea_comments ic
      WHERE cu.comment_id = ic.id
        AND cu.tenant_id IS NULL;

      INSERT INTO tenant_actors (id, tenant_id, actor_type, internal_user_id, display_name, email)
      SELECT DISTINCT
        CONCAT('actor_backfill_', scope.tenant_id, '_', scope.user_id) AS id,
        scope.tenant_id,
        'internal_user',
        scope.user_id,
        u.display_name,
        u.email
      FROM (
        SELECT tenant_id, created_by AS user_id
        FROM ideas
        WHERE tenant_id IS NOT NULL
          AND created_by IS NOT NULL
        UNION
        SELECT tenant_id, user_id
        FROM idea_comments
        WHERE tenant_id IS NOT NULL
          AND user_id IS NOT NULL
        UNION
        SELECT tenant_id, user_id
        FROM idea_votes
        WHERE tenant_id IS NOT NULL
          AND user_id IS NOT NULL
        UNION
        SELECT tenant_id, user_id
        FROM idea_subscriptions
        WHERE tenant_id IS NOT NULL
          AND user_id IS NOT NULL
        UNION
        SELECT tenant_id, user_id
        FROM idea_favorites
        WHERE tenant_id IS NOT NULL
          AND user_id IS NOT NULL
        UNION
        SELECT tenant_id, user_id
        FROM comment_upvotes
        WHERE tenant_id IS NOT NULL
          AND user_id IS NOT NULL
      ) AS scope
      JOIN users u ON u.id = scope.user_id
      ON CONFLICT (tenant_id, internal_user_id) DO UPDATE
      SET display_name = COALESCE(EXCLUDED.display_name, tenant_actors.display_name),
          email = COALESCE(EXCLUDED.email, tenant_actors.email);

      UPDATE ideas i
      SET tenant_actor_id = ta.id
      FROM tenant_actors ta
      WHERE i.tenant_id = ta.tenant_id
        AND ta.internal_user_id = i.created_by
        AND i.tenant_actor_id IS NULL;

      UPDATE idea_comments c
      SET tenant_actor_id = ta.id
      FROM tenant_actors ta
      WHERE c.tenant_id = ta.tenant_id
        AND ta.internal_user_id = c.user_id
        AND c.tenant_actor_id IS NULL;

      UPDATE idea_votes v
      SET tenant_actor_id = ta.id
      FROM tenant_actors ta
      WHERE v.tenant_id = ta.tenant_id
        AND ta.internal_user_id = v.user_id
        AND v.tenant_actor_id IS NULL;

      UPDATE idea_subscriptions s
      SET tenant_actor_id = ta.id
      FROM tenant_actors ta
      WHERE s.tenant_id = ta.tenant_id
        AND ta.internal_user_id = s.user_id
        AND s.tenant_actor_id IS NULL;

      UPDATE idea_favorites f
      SET tenant_actor_id = ta.id
      FROM tenant_actors ta
      WHERE f.tenant_id = ta.tenant_id
        AND ta.internal_user_id = f.user_id
        AND f.tenant_actor_id IS NULL;

      UPDATE comment_upvotes cu
      SET tenant_actor_id = ta.id
      FROM tenant_actors ta
      WHERE cu.tenant_id = ta.tenant_id
        AND ta.internal_user_id = cu.user_id
        AND cu.tenant_actor_id IS NULL;
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
