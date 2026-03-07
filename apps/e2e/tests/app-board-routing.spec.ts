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

async function createTemporaryBoard(request: APIRequestContext, name: string): Promise<BoardRecord> {
  const createResponse = await request.post(`${apiBase}/workspaces/${workspaceId}/boards`, {
    headers: adminHeaders,
    data: {
      name,
      description: 'Temporary board for app route recovery coverage.',
      visibility: 'public',
    },
  });

  expect(createResponse.status()).toBe(201);
  return (await createResponse.json()) as BoardRecord;
}

async function deactivateBoard(request: APIRequestContext, boardId: string): Promise<void> {
  await request.patch(`${apiBase}/workspaces/${workspaceId}/boards/${boardId}`, {
    headers: adminHeaders,
    data: { active: false },
  });
}

test.describe('Operator app board routing', () => {
  test('recovers from a stale board selection when navigating to a different board slug', async ({ page, request }) => {
    const tempBoard = await createTemporaryBoard(
      request,
      `E2E App Route Recovery ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );

    let staleIdeas404Count = 0;
    let trackStaleIdeas = false;

    page.on('response', (response) => {
      if (!trackStaleIdeas) return;
      if (response.status() !== 404) return;
      if (!response.url().includes(`/workspaces/${workspaceId}/boards/${tempBoard.id}/ideas`)) return;
      staleIdeas404Count += 1;
    });

    try {
      await page.goto(`/app/boards/${tempBoard.slug}`);
      await expect(page.getByRole('heading', { name: 'Sign in to the operator view' })).toBeVisible();
      await page.getByRole('button', { name: 'Enter workspace' }).click();

      await expect(page.getByRole('heading', { name: tempBoard.name })).toBeVisible();

      await deactivateBoard(request, tempBoard.id);

      trackStaleIdeas = true;
      await page.evaluate(() => {
        window.history.pushState({}, '', '/app/boards/customervoice-features');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      await expect(page.getByRole('heading', { name: 'CustomerVoice Features' })).toBeVisible();
      await expect(page.locator('.notice.error')).toHaveCount(0);
      await page.waitForTimeout(1200);
      expect(staleIdeas404Count).toBeLessThanOrEqual(1);
    } finally {
      await deactivateBoard(request, tempBoard.id).catch(() => {});
    }
  });

  test('refreshes stale sidebar boards after board_not_found on click', async ({ page, request }) => {
    const tempBoard = await createTemporaryBoard(
      request,
      `E2E Sidebar Recovery ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );

    const staleBoardButton = page.locator('.dash-sidebar-item').filter({ hasText: tempBoard.name });
    let staleIdeas404Count = 0;

    page.on('response', (response) => {
      if (response.status() !== 404) return;
      if (!response.url().includes(`/workspaces/${workspaceId}/boards/${tempBoard.id}/ideas`)) return;
      staleIdeas404Count += 1;
    });

    try {
      await page.goto('/app/boards/customervoice-features');
      await expect(page.getByRole('heading', { name: 'Sign in to the operator view' })).toBeVisible();
      await page.getByRole('button', { name: 'Enter workspace' }).click();

      await expect(page.getByRole('heading', { name: 'CustomerVoice Features' })).toBeVisible();
      await expect(staleBoardButton).toHaveCount(1);

      await deactivateBoard(request, tempBoard.id);
      await staleBoardButton.click();

      await expect(page.locator('.notice.error')).toContainText(
        `Board slug "${tempBoard.slug}" was not found in this workspace.`,
      );
      await expect(staleBoardButton).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Select a board' })).toBeVisible();
      await page.waitForTimeout(1200);
      expect(staleIdeas404Count).toBeLessThanOrEqual(2);
    } finally {
      await deactivateBoard(request, tempBoard.id).catch(() => {});
    }
  });
});
