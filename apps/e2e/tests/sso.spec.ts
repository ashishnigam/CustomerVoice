import { test, expect } from '@playwright/test';

const tenantKey = 'tnt_customervoicedemo';

test.describe('Authentication and SSO Flow', () => {
    test('User can initiate mock SSO login', async ({ page, request }) => {
        await page.goto(`/portal/t/${tenantKey}/boards/customervoice-features`);

        const loginResponse = await request.get(`http://localhost:4000/api/v1/auth/sso/login?tenant=${tenantKey}`, {
            maxRedirects: 0,
        });
        expect(loginResponse.status()).toBe(302);
        const loginLocation = loginResponse.headers()['location'] ?? '';
        expect(loginLocation).toContain('/api/v1/auth/sso/callback');
        expect(loginLocation).toContain(`tenant=${tenantKey}`);

        const callbackResponse = await request.get(`http://localhost:4000${loginLocation}`, {
            maxRedirects: 0,
        });
        expect(callbackResponse.status()).toBe(302);
        const callbackLocation = callbackResponse.headers()['location'] ?? '';
        expect(callbackLocation).toContain('/portal/callback?token=');
    });
});
