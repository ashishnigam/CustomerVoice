import { expect, test } from '@playwright/test';

test.describe('Admin Phase 7 Tenant Controls', () => {
  test('manages tenant domains and SSO readiness from the admin dashboard', async ({ page }) => {
    const uniqueDomain = `phase7-${Date.now()}.example.com`;
    const metadataUrl = `https://idp.${uniqueDomain}/metadata`;

    await page.goto('/admin/boards/customervoice-features');
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    await page.getByRole('button', { name: 'Authenticate' }).click();

    await expect(page.getByRole('button', { name: 'Tenant Identity' })).toBeVisible();
    await page.getByRole('button', { name: 'Tenant Identity' }).click();

    await expect(page.getByText('tnt_customervoicedemo')).toBeVisible();
    await expect(page.getByText('acme.corp').first()).toBeVisible();
    await expect(page.getByText('https://idp.acme.corp/metadata')).toBeVisible();

    const domainInput = page.locator('input[placeholder="identity.example.com"]').first();
    await domainInput.fill(uniqueDomain);
    const createDomainResponse = page.waitForResponse((response) =>
      response.url().includes('/tenants/') &&
      response.url().endsWith('/domains') &&
      response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Add Domain' }).click();
    expect((await createDomainResponse).status()).toBe(201);

    const domainCard = page.locator('div').filter({ hasText: uniqueDomain }).first();
    await expect(domainCard).toBeVisible({ timeout: 10000 });
    await expect(domainCard).toContainText('pending');
    await page.getByRole('button', { name: `Verify domain ${uniqueDomain}` }).click();
    await expect(domainCard).toContainText('verified');

    const ssoDomainInput = page.locator('input[placeholder="identity.example.com"]').nth(1);
    await ssoDomainInput.fill(uniqueDomain);
    await page.locator('input[placeholder="https://idp.example.com/metadata"]').fill(metadataUrl);
    const createSsoResponse = page.waitForResponse((response) =>
      response.url().includes('/tenants/') &&
      response.url().includes('/sso-connections') &&
      response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Add Tenant SSO' }).click();
    expect((await createSsoResponse).status()).toBe(201);

    await expect(page.getByText(metadataUrl)).toBeVisible();
  });

  test('supports audited support-admin switch-tenant flow', async ({ page }) => {
    await page.goto('/admin/boards/customervoice-features');
    await page.getByLabel('Session Type').selectOption('support_admin');
    await page.getByRole('button', { name: 'Authenticate' }).click();

    await expect(page.getByText('Support Admin Session')).toBeVisible();

    const switchResponse = page.waitForResponse((response) =>
      response.url().includes('/operator/tenants/') &&
      response.url().includes('/impersonate') &&
      response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Switch To Board Tenant' }).click();
    expect((await switchResponse).status()).toBe(201);

    await expect(page.getByText('Tenant impersonation active')).toBeVisible();
    await page.getByRole('button', { name: 'Tenant Identity' }).click();
    await expect(page.getByText('acme.corp').first()).toBeVisible();

    const revokeResponse = page.waitForResponse((response) =>
      response.url().includes('/operator/impersonations/revoke') &&
      response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'End Tenant Session' }).click();
    expect((await revokeResponse).status()).toBe(200);
    await expect(page.getByText('Tenant impersonation ended')).toBeVisible();
  });
});
