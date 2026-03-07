import { type APIRequestContext, expect, type Page, test } from '@playwright/test';

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
}

function getPortalBootstrapRequestKey(url: string, boardSlug: string): string | null {
  const parsed = new URL(url);
  const boardApiPrefix = `/api/v1/public/boards/${boardSlug}`;
  if (!parsed.pathname.startsWith(boardApiPrefix)) return null;

  const suffix = parsed.pathname.slice(boardApiPrefix.length) || '/';
  if (suffix === '/') return suffix;
  if (suffix === '/settings') return suffix;
  if (suffix === '/categories') return suffix;
  if (suffix === '/stream') return suffix;
  if (suffix === '/ideas') return `${suffix}${parsed.search}`;
  return null;
}

function serializeRequestCounts(counts: Map<string, number>): Record<string, number> {
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

async function createAccessControlledBoard(
  request: APIRequestContext,
  options: {
    accessMode: 'private' | 'domain_restricted';
    portalTitle: string;
    allowedDomains?: string[];
    allowedEmails?: string[];
  },
): Promise<BoardRecord> {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createResponse = await request.post(`${apiBase}/workspaces/${workspaceId}/boards`, {
    headers: adminHeaders,
    data: {
      name: `${options.portalTitle} ${uniqueSuffix}`,
      description: 'E2E access-gated board for portal bootstrap stability checks.',
      visibility: 'private',
    },
  });

  expect(createResponse.status()).toBe(201);
  const board = (await createResponse.json()) as BoardRecord;

  const settingsResponse = await request.patch(`${apiBase}/workspaces/${workspaceId}/boards/${board.id}/settings`, {
    headers: adminHeaders,
    data: {
      accessMode: options.accessMode,
      allowedDomains: options.allowedDomains,
      allowedEmails: options.allowedEmails,
      portalTitle: options.portalTitle,
    },
  });

  expect(settingsResponse.status()).toBe(200);
  return board;
}

async function deactivateBoard(request: APIRequestContext, boardId: string): Promise<void> {
  await request.patch(`${apiBase}/workspaces/${workspaceId}/boards/${boardId}`, {
    headers: adminHeaders,
    data: { active: false },
  });
}

async function expectAccessGateBootstrapToStayStable(
  page: Page,
  boardSlug: string,
  assertGateUi: (page: Page) => Promise<void>,
): Promise<void> {
  const bootstrapResponseCounts = new Map<string, number>();
  page.on('response', (response) => {
    const requestKey = getPortalBootstrapRequestKey(response.url(), boardSlug);
    if (!requestKey) return;
    bootstrapResponseCounts.set(requestKey, (bootstrapResponseCounts.get(requestKey) ?? 0) + 1);
  });

  await page.goto(`/portal/boards/${boardSlug}`);
  await expect(page).toHaveURL(new RegExp(`/portal/boards/${boardSlug}`));
  await assertGateUi(page);

  // React StrictMode remounts once in local dev, so two bootstrap fetches are acceptable.
  await page.waitForTimeout(300);
  const settledCounts = serializeRequestCounts(bootstrapResponseCounts);

  await page.waitForTimeout(1200);
  expect(serializeRequestCounts(bootstrapResponseCounts)).toEqual(settledCounts);

  expect(settledCounts['/'] ?? 0).toBeLessThanOrEqual(2);
  expect(settledCounts['/settings'] ?? 0).toBeLessThanOrEqual(2);
  expect(settledCounts['/categories'] ?? 0).toBe(0);
  expect(settledCounts['/ideas?sort=top_voted&limit=20&offset=0'] ?? 0).toBe(0);
  expect(settledCounts['/stream'] ?? 0).toBe(0);
}

test.describe('Portal access-gate stability', () => {
  test('private boards stay on the auth gate without content refetch loops', async ({ page, request }) => {
    let board: BoardRecord | null = null;

    try {
      board = await createAccessControlledBoard(request, {
        accessMode: 'private',
        portalTitle: 'E2E Private Access Gate',
      });

      await expectAccessGateBootstrapToStayStable(page, board.slug, async (currentPage) => {
        await expect(currentPage.getByRole('heading', { name: 'Private Feedback Portal' })).toBeVisible();
        await expect(currentPage.getByRole('button', { name: 'Sign In' })).toBeVisible();
        await expect(currentPage.getByText('This board requires authentication')).toBeVisible();
      });
    } finally {
      if (board) {
        await deactivateBoard(request, board.id).catch(() => {});
      }
    }
  });

  test('domain-restricted boards stay on the SSO gate without content refetch loops', async ({ page, request }) => {
    let board: BoardRecord | null = null;

    try {
      board = await createAccessControlledBoard(request, {
        accessMode: 'domain_restricted',
        portalTitle: 'E2E Domain Access Gate',
        allowedDomains: ['acme.corp'],
        allowedEmails: ['allowed.user@example.com'],
      });

      await expectAccessGateBootstrapToStayStable(page, board.slug, async (currentPage) => {
        await expect(currentPage.getByRole('heading', { name: 'Restricted Workspace Portal' })).toBeVisible();
        await expect(currentPage.getByRole('button', { name: 'Sign In' })).toBeVisible();
        await expect(currentPage.getByRole('button', { name: 'Start SSO' })).toBeVisible();
        await expect(currentPage.getByPlaceholder('you@company.com or company.com')).toBeVisible();
      });
    } finally {
      if (board) {
        await deactivateBoard(request, board.id).catch(() => {});
      }
    }
  });
});
