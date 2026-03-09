import { Router } from 'express';
import {
    createPortalSession,
    createPortalUser,
    ensurePortalTenantProfile,
    findDefaultWorkspaceForTenant,
    findPortalUserByEmail,
    findTenantById,
    findTenantByKey,
    findTenantSsoConnection,
    findVerifiedTenantDomain,
} from '../db/repositories.js';
import { asyncHandler } from '../lib/async-handler.js';
import { assignRequestContext } from '../lib/request-context.js';
import { consumeFixedWindowRateLimit } from '../lib/rate-limit.js';

export const ssoRouter = Router();

function enforceTenantRateLimit(tenantId: string, res: { status: (code: number) => { json: (body: unknown) => void } }): boolean {
    const result = consumeFixedWindowRateLimit({
        bucket: `sso:${tenantId}`,
        limit: 30,
        windowMs: 60_000,
    });

    if (!result.allowed) {
        res.status(429).json({ error: 'rate_limit_exceeded', retryAfterMs: result.retryAfterMs });
        return false;
    }

    return true;
}

async function resolveSsoContext(params: {
    tenantKey?: string | null;
    domain?: string | null;
}) {
    if (params.tenantKey) {
        const tenant = await findTenantByKey(params.tenantKey);
        if (!tenant) {
            return null;
        }

        const connection = await findTenantSsoConnection({
            tenantId: tenant.id,
            domain: params.domain ?? tenant.primaryDomain ?? undefined,
        });

        return connection ? { tenant, connection } : null;
    }

    if (!params.domain) {
        return null;
    }

    const verifiedDomain = await findVerifiedTenantDomain(params.domain);
    if (!verifiedDomain) {
        return null;
    }

    const tenant = await findTenantById(verifiedDomain.tenantId);
    if (!tenant) {
        return null;
    }

    const connection = await findTenantSsoConnection({
        tenantId: tenant.id,
        domain: params.domain,
    });

    return connection ? { tenant, connection } : null;
}

// Configure SAML locally per request instead of globally if needed, 
// but for simplicity we'll configure a dynamic Strategy mapping or just a simple callback endpoint.
ssoRouter.get(
    '/auth/sso/login',
    asyncHandler(async (req, res) => {
        const tenantKey = typeof req.query.tenant === 'string' ? req.query.tenant : null;
        const domain = typeof req.query.domain === 'string' ? req.query.domain : null;
        if (!tenantKey && !domain) {
            res.status(400).json({ error: 'tenant_or_domain_required' });
            return;
        }

        const context = await resolveSsoContext({ tenantKey, domain });
        if (!context || !context.connection.active) {
            res.status(404).json({ error: 'sso_not_configured_for_tenant' });
            return;
        }

        assignRequestContext({
            tenantId: context.tenant.id,
            tenantKey: context.tenant.tenantKey,
            domain: context.connection.domain,
        });

        if (!enforceTenantRateLimit(context.tenant.id, res)) {
            return;
        }

        // In a real app, instantiate SamlStrategy dynamically based on connection.metadataUrl 
        // and passport.authenticate('saml')(req, res, next).
        // For this prototype/Phase 6 implementation, we simulate the redirect.
        if (process.env.NODE_ENV === 'test' || process.env.AUTH_MODE === 'mock') {
            const effectiveDomain = context.connection.domain;
            const mockCallbackUrl = `/api/v1/auth/sso/callback?tenant=${encodeURIComponent(context.tenant.tenantKey)}&domain=${encodeURIComponent(effectiveDomain)}&mock_email=user@${encodeURIComponent(effectiveDomain)}`;
            res.redirect(302, mockCallbackUrl);
            return;
        }

        // Redirect to actual SAML IDP
        res.redirect(302, context.connection.metadataUrl ?? `https://idp.${context.connection.domain}/saml/login`);
    })
);

ssoRouter.all(
    '/auth/sso/callback',
    asyncHandler(async (req, res) => {
        const tenantKey = typeof req.query.tenant === 'string' ? req.query.tenant : null;
        const domain = typeof req.query.domain === 'string' ? req.query.domain : null;
        let email = typeof req.body.email === 'string' ? req.body.email : null;

        // Support mock callback
        if (!email && typeof req.query.mock_email === 'string') {
            email = req.query.mock_email;
        }

        if ((!tenantKey && !domain) || !email) {
            res.status(400).json({ error: 'invalid_saml_response' });
            return;
        }

        const context = await resolveSsoContext({ tenantKey, domain });
        if (!context || !context.connection.active) {
            res.status(404).json({ error: 'sso_not_configured_for_tenant' });
            return;
        }

        assignRequestContext({
            tenantId: context.tenant.id,
            tenantKey: context.tenant.tenantKey,
            domain: context.connection.domain,
        });

        if (!enforceTenantRateLimit(context.tenant.id, res)) {
            return;
        }

        // Validate email domain matches connection domain to prevent spoofing
        const emailDomain = email.split('@')[1]?.trim().toLowerCase() ?? '';
        const verifiedDomain = await findVerifiedTenantDomain(emailDomain);
        if (!verifiedDomain || verifiedDomain.tenantId !== context.tenant.id) {
            res.status(403).json({ error: 'email_domain_mismatch' });
            return;
        }

        const existing = await findPortalUserByEmail(email);
        const user = existing?.user ?? await createPortalUser({
            email,
            authProvider: 'sso',
            providerId: context.connection.id,
        });

        await ensurePortalTenantProfile({
            tenantId: context.tenant.id,
            portalUserId: user.id,
            accountType: 'enterprise_member',
            homeDomain: emailDomain,
        });

        const workspace = await findDefaultWorkspaceForTenant(context.tenant.id);
        const session = await createPortalSession({
            userId: user.id,
            tenantId: context.tenant.id,
            workspaceId: workspace?.id ?? null,
        });

        // Redirect back to frontend
        res.redirect(302, `/portal/callback?token=${session.token}`);
    })
);
