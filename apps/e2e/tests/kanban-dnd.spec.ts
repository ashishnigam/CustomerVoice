import { type APIRequestContext, expect, test } from '@playwright/test';

const apiBase = 'http://localhost:4000/api/v1';
const workspaceId = '22222222-2222-2222-2222-222222222222';
const adminHeaders = {
  'x-user-id': '33333333-3333-3333-3333-333333333333',
  'x-user-email': 'admin@customervoice.local',
  'x-role': 'workspace_admin',
  'x-workspace-id': workspaceId,
};

interface BoardRecord {
  id: string;
  slug: string;
  name: string;
}

interface IdeaRecord {
  id: string;
  title: string;
}

async function createTemporaryBoard(request: APIRequestContext, name: string): Promise<BoardRecord> {
  const response = await request.post(`${apiBase}/workspaces/${workspaceId}/boards`, {
    headers: adminHeaders,
    data: {
      name,
      description: 'Temporary board for kanban drag-and-drop regression coverage.',
      visibility: 'public',
    },
  });

  expect(response.status()).toBe(201);
  return (await response.json()) as BoardRecord;
}

async function createIdea(
  request: APIRequestContext,
  boardId: string,
  title: string,
  description: string,
): Promise<IdeaRecord> {
  const response = await request.post(`${apiBase}/workspaces/${workspaceId}/boards/${boardId}/ideas`, {
    headers: adminHeaders,
    data: {
      title,
      description,
    },
  });

  expect(response.status()).toBe(201);
  return (await response.json()) as IdeaRecord;
}

async function updateIdeaStatus(
  request: APIRequestContext,
  boardId: string,
  ideaId: string,
  status: 'new' | 'under_review' | 'accepted' | 'planned' | 'in_progress' | 'completed' | 'declined',
): Promise<void> {
  const response = await request.patch(`${apiBase}/workspaces/${workspaceId}/boards/${boardId}/ideas/${ideaId}/status`, {
    headers: adminHeaders,
    data: { status },
  });

  expect(response.status()).toBe(200);
}

async function deactivateBoard(request: APIRequestContext, boardId: string): Promise<void> {
  await request.patch(`${apiBase}/workspaces/${workspaceId}/boards/${boardId}`, {
    headers: adminHeaders,
    data: { active: false },
  });
}

test.describe('Operator kanban drag-and-drop', () => {
  test('shows an insertion placeholder inside a populated column and preserves the dropped order', async ({ page, request }) => {
    const board = await createTemporaryBoard(
      request,
      `E2E Kanban Drag ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );

    try {
      const plannedBottom = await createIdea(request, board.id, 'Planned Bottom', 'Planned item that should stay last.');
      await updateIdeaStatus(request, board.id, plannedBottom.id, 'planned');

      const plannedTop = await createIdea(request, board.id, 'Planned Top', 'Planned item that should stay first.');
      await updateIdeaStatus(request, board.id, plannedTop.id, 'planned');

      const dragSource = await createIdea(request, board.id, 'Drag Source', 'This item should move into the planned column.');

      await page.goto(`/app/boards/${board.slug}`);
      await expect(page.getByRole('heading', { name: 'Sign in to the operator view' })).toBeVisible();
      await page.getByRole('button', { name: 'Enter workspace' }).click();
      await expect(page.getByRole('heading', { name: board.name })).toBeVisible();

      const sourceCard = page.locator('[data-kanban-status="new"] .kanban-card').filter({ hasText: dragSource.title });
      const plannedTopCard = page.locator('[data-kanban-status="planned"] .kanban-card').filter({ hasText: plannedTop.title });
      const plannedBottomCard = page.locator('[data-kanban-status="planned"] .kanban-card').filter({ hasText: plannedBottom.title });

      await expect(sourceCard).toHaveCount(1);
      await expect(plannedTopCard).toHaveCount(1);
      await expect(plannedBottomCard).toHaveCount(1);

      const sourceBox = await sourceCard.boundingBox();
      const plannedTopBox = await plannedTopCard.boundingBox();
      const plannedBottomBox = await plannedBottomCard.boundingBox();

      expect(sourceBox).toBeTruthy();
      expect(plannedTopBox).toBeTruthy();
      expect(plannedBottomBox).toBeTruthy();

      const targetX = (plannedBottomBox?.x ?? 0) + (plannedBottomBox?.width ?? 0) / 2;
      const targetY = ((plannedTopBox?.y ?? 0) + (plannedTopBox?.height ?? 0) + (plannedBottomBox?.y ?? 0)) / 2;

      await page.mouse.move(
        (sourceBox?.x ?? 0) + (sourceBox?.width ?? 0) / 2,
        (sourceBox?.y ?? 0) + (sourceBox?.height ?? 0) / 2,
      );
      await page.mouse.down();
      await page.mouse.move(targetX, targetY, { steps: 18 });

      const placeholder = page.locator('[data-kanban-status="planned"] .kanban-card-placeholder');
      const preview = page.locator('.kanban-drag-preview .kanban-card');
      await expect(preview).toBeVisible();
      await expect(placeholder).toBeVisible();

      const placeholderBox = await placeholder.boundingBox();
      expect(placeholderBox).toBeTruthy();
      expect(Math.abs((placeholderBox?.height ?? 0) - (sourceBox?.height ?? 0))).toBeLessThan(20);
      expect(placeholderBox?.y ?? 0).toBeGreaterThan((plannedTopBox?.y ?? 0) + ((plannedTopBox?.height ?? 0) * 0.45));
      expect(placeholderBox?.y ?? 0).toBeLessThan((plannedBottomBox?.y ?? 0) + ((plannedBottomBox?.height ?? 0) * 0.45));

      const statusUpdateResponse = page.waitForResponse((response) =>
        response.request().method() === 'PATCH'
        && response.url().includes(`/boards/${board.id}/ideas/${dragSource.id}/status`)
        && response.status() === 200,
      );

      await page.mouse.up();
      await statusUpdateResponse;

      const plannedTitles = await page.locator('[data-kanban-status="planned"] .kanban-card .kanban-card-title').allTextContents();
      expect(plannedTitles).toEqual([plannedTop.title, dragSource.title, plannedBottom.title]);
      await expect(page.locator('[data-kanban-status="new"] .kanban-card').filter({ hasText: dragSource.title })).toHaveCount(0);
    } finally {
      await deactivateBoard(request, board.id).catch(() => {});
    }
  });
});
