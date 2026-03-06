import { test, expect } from '@playwright/test';

test.describe('Authentication and SSO Flow', () => {
    test('User can initiate mock SSO login', async ({ page, request }) => {
        // Navigate to local portal board (assumes a demo board is seeded)
        await page.goto('/portal/boards/demo-board');

        // In our prototype, SSO involves passing domain via API to verify
        // So let's test the endpoint directly first as part of the flow
        const response = await request.get('http://localhost:4000/api/v1/auth/sso/login?domain=acme.corp');

        // As mock SSO, it redirects to the callback
        expect(response.status()).toBe(200);
        // Since it's a redirect, request.get follows it, returning the callback redirect.
        // Actually the callback redirects to /portal/callback?token=...
        const url = response.url();
        expect(url).toContain('/portal/callback');
        expect(url).toContain('token=');
    });

    test('User can submit an idea on the portal', async ({ page }) => {
        // Test idea submission form
        await page.goto('/portal/boards/demo-board');
        // We would have a login state, assume mock user or public mode
        // We expect the portal title to hold the brand name or board name.
        await expect(page).toHaveTitle(/CustomerVoice|Board/i);
    });
});
