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
  await query('TRUNCATE TABLE workspace_role_permissions, audit_events, boards, workspace_memberships, users, workspaces, tenants RESTART IDENTITY CASCADE');

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

describe('db-backed integration: boards + membership auth flow', () => {
  beforeAll(async () => {
    process.env.AUTH_MODE = 'mock';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/customervoice_ci';

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

  it('creates a board and persists board + audit rows', async () => {
    const response = await request(app)
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/boards`)
      .set(headers({ userId: ADMIN_ID, role: 'workspace_admin' }))
      .send({
        name: 'Billing Board',
        description: 'Payments, invoices, and subscriptions',
        visibility: 'private',
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Billing Board');
    expect(response.body.visibility).toBe('private');

    const boardId = String(response.body.id);
    const boardRows = await query<{ id: string; name: string; visibility: string }>(
      'SELECT id, name, visibility FROM boards WHERE id = $1',
      [boardId],
    );
    expect(boardRows.rowCount).toBe(1);
    expect(boardRows.rows[0]?.name).toBe('Billing Board');

    const auditRows = await query<{ action: string; metadata: { boardId: string } }>(
      `
        SELECT action, metadata
        FROM audit_events
        WHERE workspace_id = $1
        ORDER BY created_at DESC
      `,
      [WORKSPACE_ID],
    );
    expect(auditRows.rowCount).toBeGreaterThan(0);
    expect(auditRows.rows[0]?.action).toBe('board.create');
    expect(auditRows.rows[0]?.metadata.boardId).toBe(boardId);
  });

  it('enforces workspace_role_permissions deny override for board writes', async () => {
    await query(
      `
        INSERT INTO workspace_role_permissions (workspace_id, role, permission, effect)
        VALUES ($1, 'workspace_admin', 'board:write', 'deny')
      `,
      [WORKSPACE_ID],
    );

    const response = await request(app)
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/boards`)
      .set(headers({ userId: ADMIN_ID, role: 'workspace_admin' }))
      .send({
        name: 'Roadmap Board',
        visibility: 'public',
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('forbidden');
    expect(response.body.permission).toBe('board:write');
  });

  it('denies board create for contributor but allows board list', async () => {
    const createResponse = await request(app)
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/boards`)
      .set(headers({ userId: CONTRIBUTOR_ID, role: 'contributor' }))
      .send({
        name: 'Contributor Board',
        visibility: 'public',
      });

    expect(createResponse.status).toBe(403);
    expect(createResponse.body.error).toBe('forbidden');

    const listResponse = await request(app)
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/boards`)
      .set(headers({ userId: CONTRIBUTOR_ID, role: 'contributor' }));

    expect(listResponse.status).toBe(200);
    expect(Array.isArray(listResponse.body.items)).toBe(true);
  });

  it('invites member and persists membership + audit row', async () => {
    const newUserId = '66666666-6666-6666-6666-666666666666';

    const response = await request(app)
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/members/invite`)
      .set(headers({ userId: ADMIN_ID, role: 'workspace_admin' }))
      .send({
        userId: newUserId,
        email: 'new-user@customervoice.test',
        role: 'contributor',
      });

    expect(response.status).toBe(201);
    expect(response.body.userId).toBe(newUserId);
    expect(response.body.role).toBe('contributor');

    const memberRows = await query<{ user_id: string; role: string; active: boolean }>(
      `
        SELECT user_id, role, active
        FROM workspace_memberships
        WHERE workspace_id = $1 AND user_id = $2
      `,
      [WORKSPACE_ID, newUserId],
    );
    expect(memberRows.rowCount).toBe(1);
    expect(memberRows.rows[0]?.role).toBe('contributor');
    expect(memberRows.rows[0]?.active).toBe(true);

    const auditRows = await query<{ action: string; metadata: { targetUserId: string } }>(
      `
        SELECT action, metadata
        FROM audit_events
        WHERE workspace_id = $1
        ORDER BY created_at DESC
      `,
      [WORKSPACE_ID],
    );
    expect(auditRows.rows[0]?.action).toBe('membership.invite');
    expect(auditRows.rows[0]?.metadata.targetUserId).toBe(newUserId);
  });

  it('rejects workspace scope mismatch between header and route', async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/members`)
      .set(headers({ userId: ADMIN_ID, role: 'workspace_admin', workspaceId: 'other-workspace' }));

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('workspace_scope_violation');
  });
});
