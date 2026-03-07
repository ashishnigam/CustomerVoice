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
  const workspaceSlug = process.env.SEED_WORKSPACE_SLUG ?? 'default';

  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO tenants (id, name, slug)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
      `,
      [tenantId, 'CustomerVoice Demo Tenant', tenantSlug],
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
        INSERT INTO workspace_memberships (workspace_id, user_id, role, active, invited_by)
        VALUES ($1, $2, 'workspace_admin', TRUE, $2)
        ON CONFLICT (workspace_id, user_id)
        DO UPDATE SET role = EXCLUDED.role, active = TRUE, updated_at = NOW()
      `,
      [workspaceId, userId],
    );

    /* ───────────────────────────────────────────────
       DEMO DATA: Board, Categories, Ideas, Votes
       ─────────────────────────────────────────────── */

    const boardId = 'b0000000-0000-0000-0000-000000000001';
    const boardSlug = 'customervoice-features';

    // Create the demo board
    await client.query(
      `
        INSERT INTO boards (id, workspace_id, slug, name, description, visibility, active, created_by)
        VALUES ($1, $2, $3, $4, $5, 'public', TRUE, $6)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, description = EXCLUDED.description
      `,
      [
        boardId,
        workspaceId,
        boardSlug,
        'CustomerVoice Features',
        'Vote on feature requests to help us prioritize what to build next. Your feedback shapes our roadmap.',
        userId,
      ],
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
          id, workspace_id, provider, domain, client_id, client_secret, metadata_url, active
        )
        VALUES ($1, $2, 'custom_saml', 'acme.corp', 'demo-client', 'demo-secret', 'https://idp.acme.corp/metadata', TRUE)
        ON CONFLICT (workspace_id, domain)
        DO UPDATE SET provider = EXCLUDED.provider, active = TRUE, metadata_url = EXCLUDED.metadata_url
      `,
      ['sso00000-0000-0000-0000-000000000001', workspaceId],
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
          INSERT INTO ideas (id, workspace_id, board_id, title, description, status, moderation_state, active, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, 'normal', TRUE, $7)
          ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status
        `,
        [idea.id, workspaceId, boardId, idea.title, idea.description, idea.status, userId],
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
            INSERT INTO idea_votes (workspace_id, idea_id, user_id)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
          `,
          [workspaceId, idea.id, voterIds[v]],
        );
      }
    }

    // Add some demo comments
    const comments = [
      { ideaId: ideas[0].id, body: 'This would be amazing! My eyes hurt after long sessions.', voter: 0 },
      { ideaId: ideas[0].id, body: 'Yes please! Dark mode should be a priority.', voter: 1 },
      { ideaId: ideas[1].id, body: 'We use Slack for everything, this would save us so much time context-switching.', voter: 2 },
      { ideaId: ideas[2].id, body: 'We hit rate limits last week and had no visibility. This is critical for us.', voter: 0 },
      { ideaId: ideas[3].id, body: 'Being able to match our brand would make the portal feel much more professional.', voter: 3 },
      { ideaId: ideas[4].id, body: 'Two-way sync is a must. We currently copy-paste between tools.', voter: 1 },
      { ideaId: ideas[9].id, body: 'Our engineering team lives in GitHub. This integration would close the loop perfectly.', voter: 4 },
      { ideaId: ideas[9].id, body: '+1 for this! Would love automatic issue creation from approved ideas.', voter: 2 },
    ];

    for (const comment of comments) {
      const commentId = uuidv4();
      await client.query(
        `
          INSERT INTO idea_comments (id, workspace_id, idea_id, user_id, body, active)
          VALUES ($1, $2, $3, $4, $5, TRUE)
          ON CONFLICT DO NOTHING
        `,
        [commentId, workspaceId, comment.ideaId, voterIds[comment.voter], comment.body],
      );
    }
  });

  console.log(
    `[seed] bootstrap workspace ready workspace_id=${workspaceId} user_id=${userId} email=${userEmail}`,
  );
  console.log('[seed] seeded board=customervoice-features with 10 feature requests, 3 categories, votes, and comments');
}
