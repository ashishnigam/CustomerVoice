import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from './client.js';

function boolFromEnv(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

export async function runBootstrapSeed(): Promise<void> {
  if (!boolFromEnv(process.env.ENABLE_BOOTSTRAP_SEED, false)) {
    return;
  }

  const tenantId = process.env.SEED_TENANT_ID ?? uuidv4();
  const workspaceId = process.env.SEED_WORKSPACE_ID ?? uuidv4();
  const userId = process.env.SEED_USER_ID ?? uuidv4();
  const userEmail = process.env.SEED_USER_EMAIL ?? 'admin@customervoice.local';
  const tenantSlug = process.env.SEED_TENANT_SLUG ?? 'customervoice-demo';
  const tenantKey = process.env.SEED_TENANT_KEY ?? 'tnt_customervoicedemo';
  const workspaceSlug = process.env.SEED_WORKSPACE_SLUG ?? 'default';

  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO tenants (id, name, slug, tenant_key, tenant_type, status, primary_domain, features)
        VALUES ($1, $2, $3, $4, 'enterprise', 'active', 'acme.corp', '{}'::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          tenant_key = EXCLUDED.tenant_key,
          primary_domain = EXCLUDED.primary_domain,
          updated_at = NOW()
      `,
      [tenantId, 'CustomerVoice Demo Tenant', tenantSlug, tenantKey],
    );

    await client.query(
      `
        INSERT INTO workspaces (id, tenant_id, name, slug, residency_zone, active)
        VALUES ($1, $2, $3, $4, 'US', TRUE)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, active = TRUE
      `,
      [workspaceId, tenantId, 'Default Workspace', workspaceSlug],
    );

    await client.query(
      `
        INSERT INTO users (id, email, display_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()
      `,
      [userId, userEmail, 'Bootstrap Admin'],
    );

    await client.query(
      `
        INSERT INTO workspace_memberships (workspace_id, tenant_id, user_id, role, active, invited_by)
        VALUES ($1, $2, $3, 'workspace_admin', TRUE, $3)
        ON CONFLICT (workspace_id, user_id)
        DO UPDATE SET tenant_id = EXCLUDED.tenant_id, role = EXCLUDED.role, active = TRUE, updated_at = NOW()
      `,
      [workspaceId, tenantId, userId],
    );

    await client.query(
      `
        INSERT INTO global_operator_assignments (user_id, global_role, active)
        VALUES ($1, 'support_admin', TRUE)
        ON CONFLICT (user_id, global_role)
        DO UPDATE SET active = TRUE
      `,
      [userId],
    );

    /* ───────────────────────────────────────────────
       DEMO DATA: Board, Categories, Ideas, Votes
       ─────────────────────────────────────────────── */

    const boardId = 'b0000000-0000-0000-0000-000000000001';
    const boardSlug = 'customervoice-features';
    const boardPublicKey = 'customervoice-features';

    // Create the demo board
    await client.query(
      `
        INSERT INTO boards (id, workspace_id, tenant_id, slug, public_board_key, name, description, visibility, active, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'public', TRUE, $8)
        ON CONFLICT (id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          name = EXCLUDED.name,
          slug = EXCLUDED.slug,
          public_board_key = EXCLUDED.public_board_key,
          description = EXCLUDED.description
      `,
      [
        boardId,
        workspaceId,
        tenantId,
        boardSlug,
        boardPublicKey,
        'CustomerVoice Features',
        'Vote on feature requests to help us prioritize what to build next. Your feedback shapes our roadmap.',
        userId,
      ],
    );

    await client.query(
      `
        INSERT INTO tenant_domains (
          id, tenant_id, domain, is_primary, domain_kind, verification_status, verification_method, verification_token, verified_at, active
        )
        VALUES ($1, $2, 'acme.corp', TRUE, 'enterprise', 'verified', 'system', 'seed-acme', NOW(), TRUE)
        ON CONFLICT ((LOWER(domain)))
        DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          is_primary = TRUE,
          verification_status = 'verified',
          verification_method = 'system',
          verified_at = NOW(),
          active = TRUE,
          updated_at = NOW()
      `,
      ['tdomain0-0000-0000-0000-000000000001', tenantId],
    );

    // Ensure board settings exist for seeded board.
    await client.query(
      `
        INSERT INTO board_settings (board_id)
        VALUES ($1)
        ON CONFLICT (board_id) DO NOTHING
      `,
      [boardId],
    );

    // Seed a deterministic SSO connection for local E2E and manual validation.
    await client.query(
      `
        INSERT INTO sso_connections (
          id, workspace_id, tenant_id, provider, domain, client_id, client_secret, metadata_url, active
        )
        VALUES ($1, $2, $3, 'custom_saml', 'acme.corp', 'demo-client', 'demo-secret', 'https://idp.acme.corp/metadata', TRUE)
        ON CONFLICT (workspace_id, domain)
        DO UPDATE SET tenant_id = EXCLUDED.tenant_id, provider = EXCLUDED.provider, active = TRUE, metadata_url = EXCLUDED.metadata_url
      `,
      ['sso00000-0000-0000-0000-000000000001', workspaceId, tenantId],
    );

    // Create 3 categories
    const catUxId = 'c0000000-0000-0000-0000-000000000001';
    const catIntegrationId = 'c0000000-0000-0000-0000-000000000002';
    const catPerfId = 'c0000000-0000-0000-0000-000000000003';

    const cats = [
      { id: catUxId, name: 'UX/Design', slug: 'ux-design', color: '#7c3aed' },
      { id: catIntegrationId, name: 'Integration', slug: 'integration', color: '#2a78b7' },
      { id: catPerfId, name: 'Performance', slug: 'performance', color: '#10b981' },
    ];

    for (const cat of cats) {
      await client.query(
        `
          INSERT INTO idea_categories (id, workspace_id, name, slug, color_hex, active, created_by)
          VALUES ($1, $2, $3, $4, $5, TRUE, $6)
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color_hex = EXCLUDED.color_hex
        `,
        [cat.id, workspaceId, cat.name, cat.slug, cat.color, userId],
      );
    }

    // Create 5 dummy voter users
    const voterIds = [
      'v0000000-0000-0000-0000-000000000001',
      'v0000000-0000-0000-0000-000000000002',
      'v0000000-0000-0000-0000-000000000003',
      'v0000000-0000-0000-0000-000000000004',
      'v0000000-0000-0000-0000-000000000005',
    ];

    for (let i = 0; i < voterIds.length; i++) {
      await client.query(
        `
          INSERT INTO users (id, email, display_name)
          VALUES ($1, $2, $3)
          ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
        `,
        [voterIds[i], `voter${i + 1}@customervoice.local`, `Customer ${i + 1}`],
      );
    }

    const actorSeeds = [
      {
        actorId: 'ta000000-0000-0000-0000-000000000001',
        userId,
        displayName: 'Bootstrap Admin',
        email: userEmail,
      },
      ...voterIds.map((voterId, index) => ({
        actorId: `ta000000-0000-0000-0000-00000000010${index + 1}`,
        userId: voterId,
        displayName: `Customer ${index + 1}`,
        email: `voter${index + 1}@customervoice.local`,
      })),
    ];

    for (const actor of actorSeeds) {
      await client.query(
        `
          INSERT INTO tenant_actors (id, tenant_id, actor_type, internal_user_id, display_name, email)
          VALUES ($1, $2, 'internal_user', $3, $4, $5)
          ON CONFLICT (tenant_id, internal_user_id)
          DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email
        `,
        [actor.actorId, tenantId, actor.userId, actor.displayName, actor.email],
      );
    }

    const actorRows = await client.query<{ id: string; internal_user_id: string }>(
      `
        SELECT id, internal_user_id
        FROM tenant_actors
        WHERE tenant_id = $1
          AND internal_user_id = ANY($2::text[])
      `,
      [tenantId, actorSeeds.map((actor) => actor.userId)],
    );

    const actorIdByUserId = new Map(actorRows.rows.map((row) => [row.internal_user_id, row.id]));

    // 10 feature requests with varied statuses
    const ideas: {
      id: string;
      title: string;
      description: string;
      status: string;
      categories: string[];
      voterCount: number;
    }[] = [
        {
          id: 'i0000000-0000-0000-0000-000000000001',
          title: 'Dark Mode Support',
          description:
            'Add a dark mode theme option to reduce eye strain during night usage. Should respect system preferences and allow manual toggle. This is a highly requested feature that would improve accessibility and user comfort across our entire platform.',
          status: 'planned',
          categories: [catUxId],
          voterCount: 5,
        },
        {
          id: 'i0000000-0000-0000-0000-000000000002',
          title: 'Slack Integration for Notifications',
          description:
            'Integrate with Slack so teams can receive real-time notifications when new feature requests are submitted, status changes occur, or ideas reach certain vote thresholds. Support both channel messages and DMs.',
          status: 'in_progress',
          categories: [catIntegrationId],
          voterCount: 4,
        },
        {
          id: 'i0000000-0000-0000-0000-000000000003',
          title: 'API Rate Limit Dashboard',
          description:
            'Provide a clear dashboard showing current API usage, remaining quota, and historical usage trends. Include alerts when approaching rate limits and suggestions for optimizing API calls.',
          status: 'new',
          categories: [catPerfId],
          voterCount: 3,
        },
        {
          id: 'i0000000-0000-0000-0000-000000000004',
          title: 'Custom Branding for Public Portal',
          description:
            'Allow organizations to customize the public feedback portal with their own logo, colors, and domain. This would make the portal feel native to each company\'s brand identity and improve trust with end users.',
          status: 'accepted',
          categories: [catUxId],
          voterCount: 4,
        },
        {
          id: 'i0000000-0000-0000-0000-000000000005',
          title: 'Jira Two-Way Sync',
          description:
            'Enable bidirectional synchronization between CustomerVoice ideas and Jira tickets. When an idea status changes in either system, the other should automatically update. Include field mapping configuration.',
          status: 'under_review',
          categories: [catIntegrationId],
          voterCount: 3,
        },
        {
          id: 'i0000000-0000-0000-0000-000000000006',
          title: 'Bulk Import Ideas via CSV',
          description:
            'Support importing feature requests from a CSV file to make it easy for teams migrating from other tools. Should handle title, description, status, and tags with validation and error reporting.',
          status: 'completed',
          categories: [catUxId, catIntegrationId],
          voterCount: 2,
        },
        {
          id: 'i0000000-0000-0000-0000-000000000007',
          title: 'Real-time WebSocket Updates',
          description:
            'Implement WebSocket connections so votes and new ideas appear in real-time without page refresh. This would make the collaborative experience feel more dynamic and engaging for active communities.',
          status: 'new',
          categories: [catPerfId],
          voterCount: 2,
        },
        {
          id: 'i0000000-0000-0000-0000-000000000008',
          title: 'Mobile-Responsive Admin Dashboard',
          description:
            'Optimize the admin dashboard for mobile and tablet devices. Product managers should be able to review and triage ideas, update statuses, and moderate content on the go from any device.',
          status: 'planned',
          categories: [catUxId],
          voterCount: 3,
        },
        {
          id: 'i0000000-0000-0000-0000-000000000009',
          title: 'Search Auto-Complete & Suggestions',
          description:
            'Add auto-complete and smart suggestions to the search bar. When a user starts typing a new feature request, show similar existing ideas to reduce duplicates and encourage voting on existing requests.',
          status: 'declined',
          categories: [catUxId, catPerfId],
          voterCount: 1,
        },
        {
          id: 'i0000000-0000-0000-0000-000000000010',
          title: 'GitHub Issue Sync',
          description:
            'Automatically create GitHub issues from approved feature requests and sync status back. Development teams working in GitHub would have a seamless workflow without switching tools.',
          status: 'new',
          categories: [catIntegrationId],
          voterCount: 4,
        },
      ];

    for (const idea of ideas) {
      await client.query(
        `
          INSERT INTO ideas (id, workspace_id, tenant_id, tenant_actor_id, board_id, title, description, status, moderation_state, active, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'normal', TRUE, $9)
          ON CONFLICT (id) DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            tenant_actor_id = EXCLUDED.tenant_actor_id,
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            status = EXCLUDED.status
        `,
        [idea.id, workspaceId, tenantId, actorIdByUserId.get(userId) ?? null, boardId, idea.title, idea.description, idea.status, userId],
      );

      // Link categories
      for (const catId of idea.categories) {
        await client.query(
          `
            INSERT INTO idea_category_links (workspace_id, idea_id, category_id)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
          `,
          [workspaceId, idea.id, catId],
        );
      }

      // Add votes from different users
      for (let v = 0; v < idea.voterCount && v < voterIds.length; v++) {
        await client.query(
          `
            INSERT INTO idea_votes (workspace_id, tenant_id, tenant_actor_id, idea_id, user_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (idea_id, user_id) DO UPDATE
            SET tenant_id = EXCLUDED.tenant_id,
                tenant_actor_id = EXCLUDED.tenant_actor_id
          `,
          [workspaceId, tenantId, actorIdByUserId.get(voterIds[v]) ?? null, idea.id, voterIds[v]],
        );
      }
    }

    // Add some demo comments
    const comments = [
      { id: 'cm000000-0000-0000-0000-000000000001', ideaId: ideas[0].id, body: 'This would be amazing! My eyes hurt after long sessions.', voter: 0 },
      { id: 'cm000000-0000-0000-0000-000000000002', ideaId: ideas[0].id, body: 'Yes please! Dark mode should be a priority.', voter: 1 },
      { id: 'cm000000-0000-0000-0000-000000000003', ideaId: ideas[1].id, body: 'We use Slack for everything, this would save us so much time context-switching.', voter: 2 },
      { id: 'cm000000-0000-0000-0000-000000000004', ideaId: ideas[2].id, body: 'We hit rate limits last week and had no visibility. This is critical for us.', voter: 0 },
      { id: 'cm000000-0000-0000-0000-000000000005', ideaId: ideas[3].id, body: 'Being able to match our brand would make the portal feel much more professional.', voter: 3 },
      { id: 'cm000000-0000-0000-0000-000000000006', ideaId: ideas[4].id, body: 'Two-way sync is a must. We currently copy-paste between tools.', voter: 1 },
      { id: 'cm000000-0000-0000-0000-000000000007', ideaId: ideas[9].id, body: 'Our engineering team lives in GitHub. This integration would close the loop perfectly.', voter: 4 },
      { id: 'cm000000-0000-0000-0000-000000000008', ideaId: ideas[9].id, body: '+1 for this! Would love automatic issue creation from approved ideas.', voter: 2 },
    ];

    for (const comment of comments) {
      await client.query(
        `
          INSERT INTO idea_comments (id, workspace_id, tenant_id, tenant_actor_id, idea_id, user_id, body, active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
          ON CONFLICT (id) DO UPDATE
          SET tenant_id = EXCLUDED.tenant_id,
              tenant_actor_id = EXCLUDED.tenant_actor_id,
              body = EXCLUDED.body,
              active = TRUE
        `,
        [
          comment.id,
          workspaceId,
          tenantId,
          actorIdByUserId.get(voterIds[comment.voter]) ?? null,
          comment.ideaId,
          voterIds[comment.voter],
          comment.body,
        ],
      );
    }

    await client.query(
      `
        UPDATE ideas i
        SET tenant_actor_id = ta.id
        FROM tenant_actors ta
        WHERE i.tenant_id = ta.tenant_id
          AND ta.internal_user_id = i.created_by
          AND i.tenant_actor_id IS NULL
      `,
    );

    await client.query(
      `
        UPDATE idea_votes v
        SET tenant_actor_id = ta.id
        FROM tenant_actors ta
        WHERE v.tenant_id = ta.tenant_id
          AND ta.internal_user_id = v.user_id
          AND v.tenant_actor_id IS NULL
      `,
    );

    await client.query(
      `
        UPDATE idea_comments c
        SET tenant_actor_id = ta.id
        FROM tenant_actors ta
        WHERE c.tenant_id = ta.tenant_id
          AND ta.internal_user_id = c.user_id
          AND c.tenant_actor_id IS NULL
      `,
    );
  });

  console.log(
    `[seed] bootstrap workspace ready workspace_id=${workspaceId} user_id=${userId} email=${userEmail}`,
  );
  console.log('[seed] seeded board=customervoice-features with 10 feature requests, 3 categories, votes, and comments');
}
