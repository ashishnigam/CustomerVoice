import { expect, test } from '@playwright/test';

const apiBase = 'http://localhost:4000/api/v1';
const tenantKey = 'tnt_customervoicedemo';
const boardPublicKey = 'customervoice-features';
const portalPath = `/portal/t/${tenantKey}/boards/${boardPublicKey}`;
const boardApiPrefix = `/api/v1/public/t/${tenantKey}/boards/${boardPublicKey}`;

function getPortalBootstrapRequestKey(url: string): string | null {
  const parsed = new URL(url);
  if (!parsed.pathname.startsWith(boardApiPrefix)) return null;

  const suffix = parsed.pathname.slice(boardApiPrefix.length) || '/';
  if (suffix === '/') return suffix;
  if (suffix === '/settings') return suffix;
  if (suffix === '/categories') return suffix;
  if (suffix === '/ideas') return `${suffix}${parsed.search}`;
  return null;
}

function serializeRequestCounts(counts: Map<string, number>): Record<string, number> {
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

test.describe('Portal Phase 6 Core Flows', () => {
  test('renders seeded portal ideas in the browser', async ({ page }) => {
    await page.goto(portalPath);
    await expect(page).toHaveURL(new RegExp(portalPath));

    await expect(page.locator('.cp-loading')).toHaveCount(0);
    await expect(page.locator('.cp-idea-card').first()).toBeVisible();
    await expect(page.getByText('Dark Mode Support')).toBeVisible();
  });

  test('bootstraps portal data without repeated refetch loops', async ({ page }) => {
    const bootstrapResponseCounts = new Map<string, number>();
    page.on('response', (response) => {
      const requestKey = getPortalBootstrapRequestKey(response.url());
      if (!requestKey) return;
      bootstrapResponseCounts.set(requestKey, (bootstrapResponseCounts.get(requestKey) ?? 0) + 1);
    });

    await page.goto(portalPath);
    await expect(page).toHaveURL(new RegExp(portalPath));
    await expect(page.locator('.cp-loading')).toHaveCount(0);
    await expect(page.locator('.cp-idea-card').first()).toBeVisible();

    // React StrictMode remounts once in local dev, so two bootstrap fetches are acceptable.
    await page.waitForTimeout(300);
    const settledCounts = serializeRequestCounts(bootstrapResponseCounts);

    await page.waitForTimeout(1200);
    expect(serializeRequestCounts(bootstrapResponseCounts)).toEqual(settledCounts);

    expect(settledCounts['/'] ?? 0).toBeLessThanOrEqual(2);
    expect(settledCounts['/settings'] ?? 0).toBeLessThanOrEqual(2);
    expect(settledCounts['/categories'] ?? 0).toBeLessThanOrEqual(2);
    expect(settledCounts['/ideas?sort=top_voted&limit=20&offset=0'] ?? 0).toBeLessThanOrEqual(2);
  });

  test('register, submit idea, vote, and comment via public APIs', async ({ request, page }) => {
    await page.goto(portalPath);
    await expect(page).toHaveURL(new RegExp(portalPath));
    await expect(page.getByRole('button', { name: 'Submit Idea' })).toBeVisible();

    const email = `phase6-${Date.now()}@example.com`;
    const password = 'phase6-pass-123';

    const registerResponse = await request.post(`${apiBase}/public/auth/register`, {
      data: { email, password, displayName: 'Phase 6 Tester' },
    });
    expect(registerResponse.ok()).toBeTruthy();
    const registerData = (await registerResponse.json()) as { token: string };
    const token = registerData.token;
    expect(token).toBeTruthy();

    const ideaTitle = `Phase 6 E2E Idea ${Date.now()}`;
    const ideaDescription = 'Verifying the end-to-end submit, vote, and comment flow.';

    const createIdeaResponse = await request.post(`${apiBase}/public/t/${tenantKey}/boards/${boardPublicKey}/ideas`, {
      headers: { authorization: `Bearer ${token}`, 'x-visitor-id': `e2e-${Date.now()}` },
      data: {
        title: ideaTitle,
        description: ideaDescription,
      },
    });
    expect(createIdeaResponse.status()).toBe(201);
    const createdIdea = (await createIdeaResponse.json()) as { id: string };
    expect(createdIdea.id).toBeTruthy();

    const voteResponse = await request.post(`${apiBase}/public/t/${tenantKey}/boards/${boardPublicKey}/ideas/${createdIdea.id}/votes`, {
      headers: { authorization: `Bearer ${token}`, 'x-visitor-id': `e2e-${Date.now()}-vote` },
    });
    expect(voteResponse.ok()).toBeTruthy();
    const voteData = (await voteResponse.json()) as { hasVoted: boolean };
    expect(voteData.hasVoted).toBeTruthy();

    const commentResponse = await request.post(`${apiBase}/public/t/${tenantKey}/boards/${boardPublicKey}/ideas/${createdIdea.id}/comments`, {
      headers: {
        authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        body: 'Phase 6 API e2e comment',
      },
    });
    expect(commentResponse.status()).toBe(201);

    const detailResponse = await request.get(
      `${apiBase}/public/t/${tenantKey}/boards/${boardPublicKey}/ideas/${createdIdea.id}?threaded=true`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
    );
    expect(detailResponse.ok()).toBeTruthy();
    const detailData = (await detailResponse.json()) as {
      idea: { title: string; voteCount: number };
      comments: Array<{ body: string }>;
    };
    expect(detailData.idea.title).toBe(ideaTitle);
    expect(detailData.idea.voteCount).toBeGreaterThan(0);
    expect(detailData.comments.some((comment) => comment.body.includes('Phase 6 API e2e comment'))).toBeTruthy();
  });
});
