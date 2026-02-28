import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMock = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  findWorkspaceMembership: vi.fn(),
  getPermissionOverride: vi.fn(),
  workspaceExists: vi.fn(),
  listBoards: vi.fn(),
  findBoard: vi.fn(),
  createBoard: vi.fn(),
  updateBoard: vi.fn(),
  listWorkspaceMemberships: vi.fn(),
  inviteWorkspaceMember: vi.fn(),
  updateWorkspaceMemberRole: vi.fn(),
  deactivateWorkspaceMember: vi.fn(),
  createAuditEvent: vi.fn(),
  listAuditEvents: vi.fn(),
}));

vi.mock('../../src/db/repositories.js', () => repositoryMock);

process.env.AUTH_MODE = 'mock';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/customervoice_test';

function authHeaders(params: {
  role: string;
  workspaceId?: string;
  userId?: string;
  userEmail?: string;
}) {
  return {
    'x-role': params.role,
    'x-workspace-id': params.workspaceId ?? 'ws-1',
    'x-user-id': params.userId ?? 'user-1',
    'x-user-email': params.userEmail ?? 'user-1@customervoice.test',
  };
}

describe('boards + membership auth flow (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    repositoryMock.getPermissionOverride.mockResolvedValue(null);
    repositoryMock.workspaceExists.mockResolvedValue(true);
    repositoryMock.createAuditEvent.mockResolvedValue({
      id: 'evt-1',
      workspaceId: 'ws-1',
      actorId: 'user-1',
      action: 'noop',
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    repositoryMock.listBoards.mockResolvedValue([]);
    repositoryMock.listWorkspaceMemberships.mockResolvedValue([]);
  });

  it('rejects requests without actor headers in mock mode', async () => {
    const { createApp } = await import('../../src/app.js');
    const app = createApp();

    const response = await request(app).get('/api/v1/workspaces/ws-1/boards');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('missing_mock_actor_headers');
  });

  it('enforces workspace scope between header and route', async () => {
    const { createApp } = await import('../../src/app.js');
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/workspaces/ws-1/members')
      .set(authHeaders({ role: 'workspace_admin', workspaceId: 'ws-2' }));

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('workspace_scope_violation');
  });

  it('lists boards for allowed roles', async () => {
    repositoryMock.listBoards.mockResolvedValue([
      {
        id: 'board-1',
        workspaceId: 'ws-1',
        slug: 'roadmap',
        name: 'Roadmap',
        description: 'Main product board',
        visibility: 'public',
        active: true,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const { createApp } = await import('../../src/app.js');
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/workspaces/ws-1/boards')
      .set(authHeaders({ role: 'viewer' }));

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(repositoryMock.listBoards).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      includeInactive: false,
    });
  });

  it('rejects board creation for non-writer role', async () => {
    const { createApp } = await import('../../src/app.js');
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/workspaces/ws-1/boards')
      .set(authHeaders({ role: 'contributor' }))
      .send({
        name: 'Billing',
        visibility: 'public',
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('forbidden');
    expect(repositoryMock.createBoard).not.toHaveBeenCalled();
  });

  it('creates board for workspace_admin and writes audit event', async () => {
    repositoryMock.createBoard.mockResolvedValue({
      id: 'board-2',
      workspaceId: 'ws-1',
      slug: 'billing-board-12345678',
      name: 'Billing Board',
      description: 'Payments and billing',
      visibility: 'private',
      active: true,
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const { createApp } = await import('../../src/app.js');
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/workspaces/ws-1/boards')
      .set(authHeaders({ role: 'workspace_admin' }))
      .send({
        name: 'Billing Board',
        description: 'Payments and billing',
        visibility: 'private',
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe('board-2');
    expect(repositoryMock.createBoard).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      name: 'Billing Board',
      description: 'Payments and billing',
      visibility: 'private',
      createdBy: 'user-1',
    });
    expect(repositoryMock.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        actorId: 'user-1',
        action: 'board.create',
      }),
    );
  });

  it('allows membership list for viewer but denies membership invite', async () => {
    repositoryMock.listWorkspaceMemberships.mockResolvedValue([
      {
        userId: 'user-1',
        email: 'user-1@customervoice.test',
        role: 'viewer',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const { createApp } = await import('../../src/app.js');
    const app = createApp();

    const listResponse = await request(app)
      .get('/api/v1/workspaces/ws-1/members')
      .set(authHeaders({ role: 'viewer' }));

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toHaveLength(1);

    const inviteResponse = await request(app)
      .post('/api/v1/workspaces/ws-1/members/invite')
      .set(authHeaders({ role: 'viewer' }))
      .send({
        userId: 'user-2',
        email: 'user-2@customervoice.test',
        role: 'contributor',
      });

    expect(inviteResponse.status).toBe(403);
    expect(inviteResponse.body.error).toBe('forbidden');
    expect(repositoryMock.inviteWorkspaceMember).not.toHaveBeenCalled();
  });

  it('invites member for workspace_admin and records audit', async () => {
    repositoryMock.inviteWorkspaceMember.mockResolvedValue({
      userId: 'user-2',
      email: 'user-2@customervoice.test',
      role: 'contributor',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const { createApp } = await import('../../src/app.js');
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/workspaces/ws-1/members/invite')
      .set(authHeaders({ role: 'workspace_admin' }))
      .send({
        userId: 'user-2',
        email: 'user-2@customervoice.test',
        role: 'contributor',
      });

    expect(response.status).toBe(201);
    expect(repositoryMock.inviteWorkspaceMember).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'user-2',
      email: 'user-2@customervoice.test',
      role: 'contributor',
      invitedBy: 'user-1',
    });
    expect(repositoryMock.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        actorId: 'user-1',
        action: 'membership.invite',
      }),
    );
  });
});
