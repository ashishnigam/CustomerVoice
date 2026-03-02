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
  listIdeaCategories: vi.fn(),
  createIdeaCategory: vi.fn(),
  updateIdeaCategory: vi.fn(),
  listIdeas: vi.fn(),
  findIdea: vi.fn(),
  findIdeaById: vi.fn(),
  createIdea: vi.fn(),
  setIdeaCategories: vi.fn(),
  updateIdeaStatus: vi.fn(),
  voteIdea: vi.fn(),
  unvoteIdea: vi.fn(),
  listIdeaComments: vi.fn(),
  createIdeaComment: vi.fn(),
  listModerationIdeas: vi.fn(),
  mergeIdeas: vi.fn(),
  setIdeaModerationState: vi.fn(),
  setIdeaCommentsLocked: vi.fn(),
  resolveIdeaAudience: vi.fn(),
  createNotificationJob: vi.fn(),
  listIdeaAnalytics: vi.fn(),
  upsertIdeaScoringInput: vi.fn(),
  listWorkspaceMemberships: vi.fn(),
  inviteWorkspaceMember: vi.fn(),
  updateWorkspaceMemberRole: vi.fn(),
  deactivateWorkspaceMember: vi.fn(),
  createAuditEvent: vi.fn(),
  listAuditEvents: vi.fn(),
}));

vi.mock('../../src/db/repositories.js', () => repositoryMock);

process.env.AUTH_MODE = 'mock';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/customervoice_test';

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

function ideaRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'idea-1',
    workspaceId: 'ws-1',
    boardId: 'board-1',
    title: 'Improve dashboard filters',
    description: 'Add advanced filtering options in dashboard',
    status: 'new',
    moderationState: 'normal',
    commentsLocked: false,
    mergedIntoIdeaId: null,
    active: true,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    voteCount: 0,
    commentCount: 0,
    viewerHasVoted: false,
    categoryIds: [],
    categoryNames: [],
    categorySlugs: [],
    ...overrides,
  };
}

describe('boards + membership + portal parity auth flow (integration)', () => {
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
    repositoryMock.findBoard.mockResolvedValue({
      id: 'board-1',
      workspaceId: 'ws-1',
      slug: 'roadmap',
      name: 'Roadmap',
      description: null,
      visibility: 'public',
      active: true,
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    repositoryMock.listIdeaCategories.mockResolvedValue([]);
    repositoryMock.listIdeas.mockResolvedValue([]);
    repositoryMock.findIdea.mockResolvedValue(ideaRecord());
    repositoryMock.findIdeaById.mockResolvedValue(ideaRecord());
    repositoryMock.voteIdea.mockResolvedValue({
      ideaId: 'idea-1',
      voteCount: 1,
      hasVoted: true,
    });
    repositoryMock.unvoteIdea.mockResolvedValue({
      ideaId: 'idea-1',
      voteCount: 0,
      hasVoted: false,
    });
    repositoryMock.listIdeaComments.mockResolvedValue([]);
    repositoryMock.listModerationIdeas.mockResolvedValue([]);
    repositoryMock.resolveIdeaAudience.mockResolvedValue([
      { userId: 'user-1', email: 'user-1@customervoice.test' },
    ]);
    repositoryMock.createNotificationJob.mockResolvedValue({
      id: 'job-1',
      workspaceId: 'ws-1',
      boardId: 'board-1',
      ideaId: 'idea-1',
      eventType: 'idea.completed',
      templateId: 'idea_completed_v1',
      payload: {},
      status: 'pending',
      attemptCount: 0,
      maxAttempts: 3,
      recipientCount: 1,
      lastError: null,
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processedAt: null,
    });
    repositoryMock.listIdeaAnalytics.mockResolvedValue([]);
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

    const inviteResponse = await request(app)
      .post('/api/v1/workspaces/ws-1/members/invite')
      .set(authHeaders({ role: 'viewer' }))
      .send({
        userId: 'user-2',
        email: 'user-2@customervoice.test',
        role: 'contributor',
      });

    expect(inviteResponse.status).toBe(403);
  });

  it('creates idea for contributor and allows vote/comment workflow', async () => {
    repositoryMock.createIdea.mockResolvedValue(
      ideaRecord({
        id: 'idea-2',
        title: 'Export roadmap as CSV',
        description: 'Allow product teams to export roadmap items as CSV.',
      }),
    );
    repositoryMock.createIdeaComment.mockResolvedValue({
      id: 'comment-1',
      workspaceId: 'ws-1',
      ideaId: 'idea-2',
      userId: 'user-1',
      userEmail: 'user-1@customervoice.test',
      body: 'Happy to test this in beta.',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    repositoryMock.findIdea.mockResolvedValue(
      ideaRecord({
        id: 'idea-2',
        title: 'Export roadmap as CSV',
        description: 'Allow product teams to export roadmap items as CSV.',
      }),
    );

    const { createApp } = await import('../../src/app.js');
    const app = createApp();

    const createResponse = await request(app)
      .post('/api/v1/workspaces/ws-1/boards/board-1/ideas')
      .set(authHeaders({ role: 'contributor' }))
      .send({
        title: 'Export roadmap as CSV',
        description: 'Allow product teams to export roadmap items as CSV.',
      });

    expect(createResponse.status).toBe(201);
    expect(repositoryMock.createIdea).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'board-1',
      title: 'Export roadmap as CSV',
      description: 'Allow product teams to export roadmap items as CSV.',
      categoryIds: undefined,
      createdBy: 'user-1',
    });

    const voteResponse = await request(app)
      .post('/api/v1/workspaces/ws-1/boards/board-1/ideas/idea-2/votes')
      .set(authHeaders({ role: 'contributor' }));

    expect(voteResponse.status).toBe(200);

    const commentResponse = await request(app)
      .post('/api/v1/workspaces/ws-1/boards/board-1/ideas/idea-2/comments')
      .set(authHeaders({ role: 'contributor' }))
      .send({ body: 'Happy to test this in beta.' });

    expect(commentResponse.status).toBe(201);
  });

  it('lists categories and filtered ideas with sort/category query contract', async () => {
    repositoryMock.listIdeaCategories.mockResolvedValue([
      {
        id: 'cat-1',
        workspaceId: 'ws-1',
        name: 'UX',
        slug: 'ux-cat-1',
        colorHex: '#4E84C4',
        active: true,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    repositoryMock.listIdeas.mockResolvedValue([
      ideaRecord({
        id: 'idea-10',
        categoryIds: ['cat-1'],
        categoryNames: ['UX'],
        categorySlugs: ['ux-cat-1'],
      }),
    ]);

    const { createApp } = await import('../../src/app.js');
    const app = createApp();

    const categoriesResponse = await request(app)
      .get('/api/v1/workspaces/ws-1/categories')
      .set(authHeaders({ role: 'viewer' }));

    expect(categoriesResponse.status).toBe(200);

    const ideasResponse = await request(app)
      .get('/api/v1/workspaces/ws-1/boards/board-1/ideas')
      .query({
        search: 'dashboard',
        status: 'new',
        categoryIds: 'cat-1',
        sort: 'most_commented',
      })
      .set(authHeaders({ role: 'viewer' }));

    expect(ideasResponse.status).toBe(200);
    expect(repositoryMock.listIdeas).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'board-1',
      status: 'new',
      moderationState: undefined,
      search: 'dashboard',
      includeInactive: undefined,
      includeModerated: undefined,
      categoryIds: ['cat-1'],
      sort: 'most_commented',
      limit: undefined,
      viewerId: 'user-1',
    });
  });

  it('creates category and enqueues notification job when idea is completed', async () => {
    repositoryMock.createIdeaCategory.mockResolvedValue({
      id: 'cat-2',
      workspaceId: 'ws-1',
      name: 'Billing',
      slug: 'billing-cat-2',
      colorHex: '#1D6996',
      active: true,
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    repositoryMock.findIdea.mockResolvedValueOnce(ideaRecord({ id: 'idea-20', status: 'planned' }));
    repositoryMock.updateIdeaStatus.mockResolvedValue(ideaRecord({ id: 'idea-20', status: 'completed' }));

    const { createApp } = await import('../../src/app.js');
    const app = createApp();

    const categoryResponse = await request(app)
      .post('/api/v1/workspaces/ws-1/categories')
      .set(authHeaders({ role: 'workspace_admin' }))
      .send({
        name: 'Billing',
        colorHex: '#1D6996',
      });

    expect(categoryResponse.status).toBe(201);

    const statusResponse = await request(app)
      .patch('/api/v1/workspaces/ws-1/boards/board-1/ideas/idea-20/status')
      .set(authHeaders({ role: 'workspace_admin' }))
      .send({ status: 'completed' });

    expect(statusResponse.status).toBe(200);
    expect(repositoryMock.resolveIdeaAudience).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      ideaId: 'idea-20',
    });
    expect(repositoryMock.createNotificationJob).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'board-1',
      ideaId: 'idea-20',
      eventType: 'idea.completed',
      templateId: 'idea_completed_v1',
      createdBy: 'user-1',
      recipients: [{ userId: 'user-1', email: 'user-1@customervoice.test' }],
      payload: expect.objectContaining({
        ideaTitle: expect.any(String),
        boardId: 'board-1',
        status: 'completed',
        triggeredBy: 'user-1',
      }),
    });
  });

  it('supports moderation and analytics endpoints for internal roles', async () => {
    repositoryMock.listModerationIdeas.mockResolvedValue([
      ideaRecord({
        id: 'idea-mod-1',
        title: 'Duplicate feedback item',
      }),
    ]);
    repositoryMock.mergeIdeas.mockResolvedValue({
      source: ideaRecord({
        id: 'idea-source',
        moderationState: 'merged',
        mergedIntoIdeaId: 'idea-target',
        active: false,
      }),
      target: ideaRecord({ id: 'idea-target' }),
    });
    repositoryMock.listIdeaAnalytics.mockResolvedValue([
      {
        ideaId: 'idea-ana-1',
        boardId: 'board-1',
        title: 'Revenue analytics item',
        status: 'planned',
        moderationState: 'normal',
        voteCount: 10,
        commentCount: 4,
        reach: 200,
        impact: 3,
        confidence: 0.8,
        effort: 4,
        riceScore: 120,
        revenuePotentialUsd: 50000,
        customerSegment: 'enterprise',
        customerCount: 12,
        contactEmails: ['buyer@customervoice.test'],
      },
    ]);

    const { createApp } = await import('../../src/app.js');
    const app = createApp();

    const moderationResponse = await request(app)
      .get('/api/v1/workspaces/ws-1/moderation/ideas')
      .query({ moderationState: 'normal', search: 'duplicate' })
      .set(authHeaders({ role: 'product_manager' }));

    expect(moderationResponse.status).toBe(200);

    const mergeResponse = await request(app)
      .post('/api/v1/workspaces/ws-1/moderation/ideas/merge')
      .set(authHeaders({ role: 'product_manager' }))
      .send({
        sourceIdeaId: 'idea-source',
        targetIdeaId: 'idea-target',
      });

    expect(mergeResponse.status).toBe(200);

    const analyticsResponse = await request(app)
      .get('/api/v1/workspaces/ws-1/analytics/ideas')
      .query({ customerSegment: 'enterprise' })
      .set(authHeaders({ role: 'product_manager' }));

    expect(analyticsResponse.status).toBe(200);
    expect(analyticsResponse.body.items).toHaveLength(1);
  });
});
