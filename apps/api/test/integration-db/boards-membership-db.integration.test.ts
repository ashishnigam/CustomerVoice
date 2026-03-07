import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const WORKSPACE_ID = '22222222-2222-2222-2222-222222222222';
const ADMIN_ID = '33333333-3333-3333-3333-333333333333';
const CONTRIBUTOR_ID = '44444444-4444-4444-4444-444444444444';
const VIEWER_ID = '55555555-5555-5555-5555-555555555555';

type QueryFn = <T = unknown>(text: string, params?: unknown[]) => Promise<{
  rows: T[];
  rowCount: number | null;
}>;

let app: ReturnType<(typeof import('../../src/app.js'))['createApp']>;
let query: QueryFn;
let closePool: () => Promise<void>;
let runMigrations: () => Promise<void>;

function headers(params: {
  userId: string;
  role: string;
  workspaceId?: string;
  userEmail?: string;
}) {
  return {
    'x-user-id': params.userId,
    'x-role': params.role,
    'x-workspace-id': params.workspaceId ?? WORKSPACE_ID,
    'x-user-email': params.userEmail ?? `${params.userId}@customervoice.test`,
  };
}

async function seedBaseData(): Promise<void> {
  await query(
    'TRUNCATE TABLE workspace_role_permissions, audit_events, notification_job_recipients, notification_jobs, idea_scoring_inputs, idea_category_links, idea_categories, idea_votes, idea_comments, ideas, boards, workspace_memberships, users, workspaces, tenants RESTART IDENTITY CASCADE',
  );

  await query(
    `
      INSERT INTO tenants (id, name, slug)
      VALUES ($1, 'CustomerVoice Test Tenant', 'customer-voice-test')
    `,
    [TENANT_ID],
  );

  await query(
    `
      INSERT INTO workspaces (id, tenant_id, name, slug, residency_zone, active)
      VALUES ($1, $2, 'Test Workspace', 'test-workspace', 'US', TRUE)
    `,
    [WORKSPACE_ID, TENANT_ID],
  );

  await query(
    `
      INSERT INTO users (id, email, display_name)
      VALUES
        ($1, 'admin@customervoice.test', 'Admin'),
        ($2, 'contributor@customervoice.test', 'Contributor'),
        ($3, 'viewer@customervoice.test', 'Viewer')
    `,
    [ADMIN_ID, CONTRIBUTOR_ID, VIEWER_ID],
  );

  await query(
    `
      INSERT INTO workspace_memberships (workspace_id, user_id, role, active, invited_by)
      VALUES
        ($1, $2, 'workspace_admin', TRUE, $2),
        ($1, $3, 'contributor', TRUE, $2),
        ($1, $4, 'viewer', TRUE, $2)
    `,
    [WORKSPACE_ID, ADMIN_ID, CONTRIBUTOR_ID, VIEWER_ID],
  );
}

async function createBoard(name: string): Promise<string> {
  const response = await request(app)
    .post(`/api/v1/workspaces/${WORKSPACE_ID}/boards`)
    .set(headers({ userId: ADMIN_ID, role: 'workspace_admin' }))
    .send({
      name,
      description: `${name} description`,
      visibility: 'public',
    });

  expect(response.status).toBe(201);
  return String(response.body.id);
}

async function createCategory(name: string, colorHex = '#4E84C4'): Promise<string> {
  const response = await request(app)
    .post(`/api/v1/workspaces/${WORKSPACE_ID}/categories`)
    .set(headers({ userId: ADMIN_ID, role: 'workspace_admin' }))
    .send({ name, colorHex });

  expect(response.status).toBe(201);
  return String(response.body.id);
}

async function createIdea(boardId: string, title: string, categoryIds?: string[]): Promise<string> {
  const response = await request(app)
    .post(`/api/v1/workspaces/${WORKSPACE_ID}/boards/${boardId}/ideas`)
    .set(headers({ userId: CONTRIBUTOR_ID, role: 'contributor' }))
    .send({
      title,
      description: `${title} detailed description for workflow coverage.`,
      categoryIds,
    });

  expect(response.status).toBe(201);
  return String(response.body.id);
}

describe('db-backed integration: portal parity v1 flows', () => {
  beforeAll(async () => {
    process.env.AUTH_MODE = 'mock';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:55432/customervoice_ci';

    const appModule = await import('../../src/app.js');
    const dbModule = await import('../../src/db/client.js');
    const migrationModule = await import('../../src/db/migrations.js');

    app = appModule.createApp();
    query = dbModule.query as QueryFn;
    closePool = dbModule.closePool;
    runMigrations = migrationModule.runMigrations;

    await runMigrations();
  });

  beforeEach(async () => {
    await seedBaseData();
  });

  afterAll(async () => {
    await closePool();
  });

  it('creates categories and supports filtered/sorted idea listing', async () => {
    const boardId = await createBoard('Portal Board');
    const categoryId = await createCategory('UX');
    const ideaId = await createIdea(boardId, 'Add dark mode in feedback portal', [categoryId]);

    const listResponse = await request(app)
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/boards/${boardId}/ideas`)
      .query({ categoryIds: categoryId, status: 'new', sort: 'most_commented' })
      .set(headers({ userId: VIEWER_ID, role: 'viewer' }));

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toHaveLength(1);
    expect(listResponse.body.items[0].id).toBe(ideaId);
    expect(listResponse.body.items[0].categoryIds).toContain(categoryId);

    const categoryRows = await query<{ name: string }>(
      `SELECT name FROM idea_categories WHERE workspace_id = $1 AND id = $2`,
      [WORKSPACE_ID, categoryId],
    );
    expect(categoryRows.rowCount).toBe(1);
    expect(categoryRows.rows[0]?.name).toBe('UX');
  });

  it('creates notification job and recipients when idea moves to completed', async () => {
    const boardId = await createBoard('Release Board');
    const ideaId = await createIdea(boardId, 'Notify voters when feature ships');

    const voteResponse = await request(app)
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/boards/${boardId}/ideas/${ideaId}/votes`)
      .set(headers({ userId: CONTRIBUTOR_ID, role: 'contributor' }));
    expect(voteResponse.status).toBe(200);

    const commentResponse = await request(app)
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/boards/${boardId}/ideas/${ideaId}/comments`)
      .set(headers({ userId: VIEWER_ID, role: 'viewer' }))
      .send({ body: 'Please let me know when this ships.' });
    expect(commentResponse.status).toBe(403);

    const viewerVote = await request(app)
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/boards/${boardId}/ideas`)
      .set(headers({ userId: VIEWER_ID, role: 'viewer' }));
    expect(viewerVote.status).toBe(200);

    const statusResponse = await request(app)
      .patch(`/api/v1/workspaces/${WORKSPACE_ID}/boards/${boardId}/ideas/${ideaId}/status`)
      .set(headers({ userId: ADMIN_ID, role: 'workspace_admin' }))
      .send({ status: 'completed' });

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.status).toBe('completed');

    const jobRows = await query<{ id: string; event_type: string; recipient_count: number }>(
      `
        SELECT id, event_type, recipient_count
        FROM notification_jobs
        WHERE workspace_id = $1 AND idea_id = $2
      `,
      [WORKSPACE_ID, ideaId],
    );
    expect(jobRows.rowCount).toBe(1);
    expect(jobRows.rows[0]?.event_type).toBe('idea.completed');
    expect(jobRows.rows[0]?.recipient_count).toBe(1);

    const recipientRows = await query<{ email: string }>(
      `
        SELECT email
        FROM notification_job_recipients
        WHERE job_id = $1
      `,
      [jobRows.rows[0]?.id],
    );
    expect(recipientRows.rowCount).toBe(1);
    expect(recipientRows.rows[0]?.email).toBe('contributor@customervoice.test');
  });

  it('locks comments via moderation and blocks new comments', async () => {
    const boardId = await createBoard('Moderation Board');
    const ideaId = await createIdea(boardId, 'Need moderator lock');

    const lockResponse = await request(app)
      .patch(`/api/v1/workspaces/${WORKSPACE_ID}/moderation/ideas/${ideaId}/comments-lock`)
      .set(headers({ userId: ADMIN_ID, role: 'workspace_admin' }))
      .send({ locked: true });

    expect(lockResponse.status).toBe(200);
    expect(lockResponse.body.commentsLocked).toBe(true);

    const commentResponse = await request(app)
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/boards/${boardId}/ideas/${ideaId}/comments`)
      .set(headers({ userId: CONTRIBUTOR_ID, role: 'contributor' }))
      .send({ body: 'This should now be blocked.' });

    expect(commentResponse.status).toBe(409);
    expect(commentResponse.body.error).toBe('idea_comments_locked');
  });

  it('merges duplicate ideas and preserves vote/comment lineage on target', async () => {
    const boardId = await createBoard('Merge Board');
    const sourceIdeaId = await createIdea(boardId, 'Duplicate idea A');
    const targetIdeaId = await createIdea(boardId, 'Canonical idea B');

    const voteResponse = await request(app)
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/boards/${boardId}/ideas/${sourceIdeaId}/votes`)
      .set(headers({ userId: CONTRIBUTOR_ID, role: 'contributor' }));
    expect(voteResponse.status).toBe(200);

    const commentResponse = await request(app)
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/boards/${boardId}/ideas/${sourceIdeaId}/comments`)
      .set(headers({ userId: CONTRIBUTOR_ID, role: 'contributor' }))
      .send({ body: 'Migrate this comment to target.' });
    expect(commentResponse.status).toBe(201);

    const mergeResponse = await request(app)
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/moderation/ideas/merge`)
      .set(headers({ userId: ADMIN_ID, role: 'workspace_admin' }))
      .send({
        sourceIdeaId,
        targetIdeaId,
      });

    expect(mergeResponse.status, JSON.stringify(mergeResponse.body)).toBe(200);
    expect(mergeResponse.body.source.moderationState).toBe('merged');
    expect(mergeResponse.body.target.id).toBe(targetIdeaId);

    const mergedIdeaRows = await query<{ moderation_state: string; merged_into_idea_id: string | null; active: boolean }>(
      `
        SELECT moderation_state, merged_into_idea_id, active
        FROM ideas
        WHERE workspace_id = $1 AND id = $2
      `,
      [WORKSPACE_ID, sourceIdeaId],
    );
    expect(mergedIdeaRows.rows[0]?.moderation_state).toBe('merged');
    expect(mergedIdeaRows.rows[0]?.merged_into_idea_id).toBe(targetIdeaId);
    expect(mergedIdeaRows.rows[0]?.active).toBe(false);

    const targetVoteRows = await query<{ vote_count: number }>(
      `
        SELECT COUNT(*)::int AS vote_count
        FROM idea_votes
        WHERE workspace_id = $1 AND idea_id = $2
      `,
      [WORKSPACE_ID, targetIdeaId],
    );
    expect(targetVoteRows.rows[0]?.vote_count).toBe(1);

    const targetCommentRows = await query<{ comment_count: number }>(
      `
        SELECT COUNT(*)::int AS comment_count
        FROM idea_comments
        WHERE workspace_id = $1 AND idea_id = $2
      `,
      [WORKSPACE_ID, targetIdeaId],
    );
    expect(targetCommentRows.rows[0]?.comment_count).toBe(1);
  });

  it('stores analytics inputs, returns ranked analytics, exports csv, and enqueues outreach job', async () => {
    const boardId = await createBoard('Analytics Board');
    const ideaId = await createIdea(boardId, 'Revenue analytics idea');

    const voteResponse = await request(app)
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/boards/${boardId}/ideas/${ideaId}/votes`)
      .set(headers({ userId: CONTRIBUTOR_ID, role: 'contributor' }));
    expect(voteResponse.status).toBe(200);

    const analyticsInputResponse = await request(app)
      .put(`/api/v1/workspaces/${WORKSPACE_ID}/analytics/ideas/${ideaId}/input`)
      .set(headers({ userId: ADMIN_ID, role: 'workspace_admin' }))
      .send({
        reach: 500,
        impact: 3,
        confidence: 0.8,
        effort: 5,
        revenuePotentialUsd: 75000,
        customerSegment: 'enterprise',
        customerCount: 20,
      });
    expect(analyticsInputResponse.status).toBe(204);

    const analyticsResponse = await request(app)
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/analytics/ideas`)
      .query({ customerSegment: 'enterprise' })
      .set(headers({ userId: ADMIN_ID, role: 'workspace_admin' }));

    expect(analyticsResponse.status).toBe(200);
    expect(analyticsResponse.body.items).toHaveLength(1);
    expect(analyticsResponse.body.items[0].ideaId).toBe(ideaId);
    expect(analyticsResponse.body.items[0].riceScore).toBeGreaterThan(0);

    const csvResponse = await request(app)
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/analytics/ideas`)
      .query({ customerSegment: 'enterprise', format: 'csv' })
      .set(headers({ userId: ADMIN_ID, role: 'workspace_admin' }));

    expect(csvResponse.status).toBe(200);
    expect(String(csvResponse.text)).toContain('ideaId');
    expect(String(csvResponse.text)).toContain(ideaId);

    const outreachResponse = await request(app)
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/analytics/ideas/${ideaId}/outreach`)
      .set(headers({ userId: ADMIN_ID, role: 'workspace_admin' }))
      .send({
        subject: 'Customer outreach for roadmap prioritization',
        message: 'We would like to discuss this feedback item in more detail.',
      });

    expect(outreachResponse.status).toBe(201);
    expect(outreachResponse.body.recipientCount).toBe(1);

    const outreachJobs = await query<{ event_type: string; template_id: string }>(
      `
        SELECT event_type, template_id
        FROM notification_jobs
        WHERE workspace_id = $1 AND idea_id = $2 AND event_type = 'analytics.outreach'
      `,
      [WORKSPACE_ID, ideaId],
    );
    expect(outreachJobs.rowCount).toBe(1);
    expect(outreachJobs.rows[0]?.template_id).toBe('analytics_outreach_v1');
  });

  it('rejects workspace scope mismatch between header and route', async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/members`)
      .set(headers({ userId: ADMIN_ID, role: 'workspace_admin', workspaceId: 'other-workspace' }));

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('workspace_scope_violation');
  });
});
