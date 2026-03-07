import { expect, test } from '@playwright/test';

const apiBase = 'http://localhost:4000/api/v1';
const boardSlug = 'customervoice-features';

test.describe('Portal Phase 6 Core Flows', () => {
  test('register, submit idea, vote, and comment via public APIs', async ({ request, page }) => {
    await page.goto(`/portal/boards/${boardSlug}`);
    await expect(page).toHaveURL(new RegExp(`/portal/boards/${boardSlug}`));
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

    const createIdeaResponse = await request.post(`${apiBase}/public/boards/${boardSlug}/ideas`, {
      headers: { authorization: `Bearer ${token}`, 'x-visitor-id': `e2e-${Date.now()}` },
      data: {
        title: ideaTitle,
        description: ideaDescription,
      },
    });
    expect(createIdeaResponse.status()).toBe(201);
    const createdIdea = (await createIdeaResponse.json()) as { id: string };
    expect(createdIdea.id).toBeTruthy();

    const voteResponse = await request.post(`${apiBase}/public/boards/${boardSlug}/ideas/${createdIdea.id}/votes`, {
      headers: { authorization: `Bearer ${token}`, 'x-visitor-id': `e2e-${Date.now()}-vote` },
    });
    expect(voteResponse.ok()).toBeTruthy();
    const voteData = (await voteResponse.json()) as { hasVoted: boolean };
    expect(voteData.hasVoted).toBeTruthy();

    const commentResponse = await request.post(`${apiBase}/public/boards/${boardSlug}/ideas/${createdIdea.id}/comments`, {
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
      `${apiBase}/public/boards/${boardSlug}/ideas/${createdIdea.id}?threaded=true`,
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
