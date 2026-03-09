import { expect, test } from '@playwright/test';

const apiBase = 'http://localhost:4000/api/v1';
const tenantKey = 'tnt_customervoicedemo';
const boardPublicKey = 'customervoice-features';
const tenantVisitorHeader = 'x-tenant-visitor-token';

test.describe('Portal Phase 7 Tenancy', () => {
  test('redirects legacy portal board paths to canonical tenant-aware paths', async ({ page }) => {
    await page.goto('/portal/boards/customervoice-features');
    await expect(page).toHaveURL(new RegExp(`/portal/t/${tenantKey}/boards/${boardPublicKey}`));
    await expect(page.getByText('Dark Mode Support')).toBeVisible();
  });

  test('resolves enterprise domains and personal fallback correctly', async ({ request }) => {
    const enterpriseResponse = await request.post(`${apiBase}/public/tenant/resolve`, {
      data: { domain: 'acme.corp' },
    });
    expect(enterpriseResponse.status()).toBe(200);
    const enterpriseData = await enterpriseResponse.json();
    expect(enterpriseData.resolution).toBe('enterprise');
    expect(enterpriseData.tenant.tenantKey).toBe(tenantKey);
    expect(enterpriseData.loginOptions.ssoAvailable).toBeTruthy();

    const personalResponse = await request.post(`${apiBase}/public/tenant/resolve`, {
      data: { email: `phase7-${Date.now()}@gmail.com` },
    });
    expect(personalResponse.status()).toBe(200);
    const personalData = await personalResponse.json();
    expect(personalData.resolution).toBe('personal');
    expect(personalData.personalTenantFallback).toBeTruthy();
  });

  test('registers a public-email user into a personal tenant session', async ({ request }) => {
    const email = `phase7-personal-${Date.now()}@gmail.com`;
    const registerResponse = await request.post(`${apiBase}/public/auth/register`, {
      data: {
        email,
        password: 'phase7-pass-123',
        displayName: 'Phase 7 Personal',
      },
    });

    expect(registerResponse.status()).toBe(201);
    const registerData = await registerResponse.json();
    expect(registerData.tenant.tenantType).toBe('personal');
    expect(registerData.tenant.accountType).toBe('personal_owner');

    const meResponse = await request.get(`${apiBase}/public/auth/me`, {
      headers: { authorization: `Bearer ${registerData.token}` },
    });
    expect(meResponse.status()).toBe(200);
    const meData = await meResponse.json();
    expect(meData.tenant.tenantType).toBe('personal');
    expect(meData.tenant.accountType).toBe('personal_owner');
  });

  test('returns public tenant metadata by tenant key', async ({ request }) => {
    const response = await request.get(`${apiBase}/public/tenant/${tenantKey}`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.tenant.tenantKey).toBe(tenantKey);
    expect(data.tenant.primaryDomain).toBe('acme.corp');
    expect(data.domains.some((domain: { domain: string; verificationStatus: string }) => domain.domain === 'acme.corp' && domain.verificationStatus === 'verified')).toBeTruthy();
    expect(data.loginOptions.ssoAvailable).toBeTruthy();
  });

  test('logs out a tenant-scoped public session', async ({ request }) => {
    const email = `phase7-logout-${Date.now()}@gmail.com`;
    const registerResponse = await request.post(`${apiBase}/public/auth/register`, {
      data: {
        email,
        password: 'phase7-pass-123',
        displayName: 'Phase 7 Logout',
      },
    });

    expect(registerResponse.status()).toBe(201);
    const registerData = await registerResponse.json();

    const logoutResponse = await request.post(`${apiBase}/public/auth/logout`, {
      headers: { authorization: `Bearer ${registerData.token}` },
    });
    expect(logoutResponse.status()).toBe(200);

    const meResponse = await request.get(`${apiBase}/public/auth/me`, {
      headers: { authorization: `Bearer ${registerData.token}` },
    });
    expect(meResponse.status()).toBe(401);
  });

  test('renews and revokes anonymous tenant visitor sessions', async ({ request }) => {
    const boardResponse = await request.get(`${apiBase}/public/t/${tenantKey}/boards/${boardPublicKey}`);
    expect(boardResponse.status()).toBe(200);
    const visitorToken = boardResponse.headers()[tenantVisitorHeader];
    expect(visitorToken).toBeTruthy();

    const ideasResponse = await request.get(`${apiBase}/public/t/${tenantKey}/boards/${boardPublicKey}/ideas`, {
      headers: { [tenantVisitorHeader]: visitorToken ?? '' },
    });
    expect(ideasResponse.status()).toBe(200);
    expect(ideasResponse.headers()[tenantVisitorHeader]).toBe(visitorToken);

    const logoutResponse = await request.post(`${apiBase}/public/auth/logout`, {
      headers: { [tenantVisitorHeader]: visitorToken ?? '' },
    });
    expect(logoutResponse.status()).toBe(200);

    const renewedResponse = await request.get(`${apiBase}/public/t/${tenantKey}/boards/${boardPublicKey}`, {
      headers: { [tenantVisitorHeader]: visitorToken ?? '' },
    });
    expect(renewedResponse.status()).toBe(200);
    expect(renewedResponse.headers()[tenantVisitorHeader]).toBeTruthy();
    expect(renewedResponse.headers()[tenantVisitorHeader]).not.toBe(visitorToken);
  });

  test('supports personal-tenant guests on enterprise boards and requires tenant selection on generic login', async ({ request }) => {
    const email = `phase7-guest-${Date.now()}@gmail.com`;
    const password = 'phase7-pass-123';

    const registerResponse = await request.post(`${apiBase}/public/auth/register`, {
      data: {
        email,
        password,
        displayName: 'Phase 7 Guest',
      },
    });
    expect(registerResponse.status()).toBe(201);
    const registerData = await registerResponse.json();
    const personalTenantKey = registerData.tenant.tenantKey as string;

    const createIdeaResponse = await request.post(`${apiBase}/public/t/${tenantKey}/boards/${boardPublicKey}/ideas`, {
      headers: { authorization: `Bearer ${registerData.token}` },
      data: {
        title: `Guest Tenant Idea ${Date.now()}`,
        description: 'Personal-tenant users should still be able to participate in enterprise boards as guests.',
      },
    });
    expect(createIdeaResponse.status()).toBe(201);

    const createdIdea = await createIdeaResponse.json();
    const enterpriseIdeaId = createdIdea.id as string;

    const commentResponse = await request.post(`${apiBase}/public/t/${tenantKey}/boards/${boardPublicKey}/ideas/${enterpriseIdeaId}/comments`, {
      headers: { authorization: `Bearer ${registerData.token}` },
      data: { body: 'Guest tenant comment for enterprise board coverage.' },
    });
    expect(commentResponse.status()).toBe(201);

    const ambiguousLoginResponse = await request.post(`${apiBase}/public/auth/login`, {
      data: { email, password },
    });
    expect(ambiguousLoginResponse.status()).toBe(409);
    const ambiguousLoginData = await ambiguousLoginResponse.json();
    expect(ambiguousLoginData.error).toBe('tenant_selection_required');
    expect((ambiguousLoginData.tenants as Array<{ tenantKey: string }>).some((tenant) => tenant.tenantKey === tenantKey)).toBeTruthy();
    expect((ambiguousLoginData.tenants as Array<{ tenantKey: string }>).some((tenant) => tenant.tenantKey === personalTenantKey)).toBeTruthy();

    const enterpriseLoginResponse = await request.post(`${apiBase}/public/auth/login`, {
      data: {
        email,
        password,
        tenantKey,
      },
    });
    expect(enterpriseLoginResponse.status()).toBe(200);
    const enterpriseLoginData = await enterpriseLoginResponse.json();
    expect(enterpriseLoginData.tenant.tenantKey).toBe(tenantKey);
    expect(enterpriseLoginData.tenant.accountType).toBe('guest');
  });
});
