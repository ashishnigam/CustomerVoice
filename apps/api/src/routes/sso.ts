import { Router } from 'express';
import passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import { z } from 'zod';
import { createPortalSession, createPortalUser, findSsoConnectionByDomain } from '../db/repositories.js';
import { asyncHandler } from '../lib/async-handler.js';

export const ssoRouter = Router();

// Configure SAML locally per request instead of globally if needed, 
// but for simplicity we'll configure a dynamic Strategy mapping or just a simple callback endpoint.
ssoRouter.get(
    '/auth/sso/login',
    asyncHandler(async (req, res, next) => {
        const domain = typeof req.query.domain === 'string' ? req.query.domain : null;
        if (!domain) {
            res.status(400).json({ error: 'domain_required' });
            return;
        }

        const connection = await findSsoConnectionByDomain(domain);
        if (!connection || !connection.active) {
            res.status(404).json({ error: 'sso_not_configured_for_domain' });
            return;
        }

        // In a real app, instantiate SamlStrategy dynamically based on connection.metadataUrl 
        // and passport.authenticate('saml')(req, res, next).
        // For this prototype/Phase 6 implementation, we simulate the redirect.
        if (process.env.NODE_ENV === 'test' || process.env.AUTH_MODE === 'mock') {
            const mockCallbackUrl = `/api/v1/auth/sso/callback?domain=${encodeURIComponent(domain)}&mock_email=user@${encodeURIComponent(domain)}`;
            res.redirect(302, mockCallbackUrl);
            return;
        }

        // Redirect to actual SAML IDP
        res.redirect(302, connection.metadataUrl ?? `https://idp.${domain}/saml/login`);
    })
);

ssoRouter.all(
    '/auth/sso/callback',
    asyncHandler(async (req, res) => {
        const domain = typeof req.query.domain === 'string' ? req.query.domain : null;
        let email = typeof req.body.email === 'string' ? req.body.email : null;

        // Support mock callback
        if (!email && typeof req.query.mock_email === 'string') {
            email = req.query.mock_email;
        }

        if (!domain || !email) {
            res.status(400).json({ error: 'invalid_saml_response' });
            return;
        }

        const connection = await findSsoConnectionByDomain(domain);
        if (!connection || !connection.active) {
            res.status(404).json({ error: 'sso_not_configured_for_domain' });
            return;
        }

        // Validate email domain matches connection domain to prevent spoofing
        if (!email.endsWith(`@${domain}`)) {
            res.status(403).json({ error: 'email_domain_mismatch' });
            return;
        }

        let user = await createPortalUser({
            email,
            authProvider: 'sso',
            providerId: connection.id,
        }).catch(async (e) => {
            // If user already exists, it might throw unique constraint error, just ignore and let session creation happen if needed.
            // We'd ideally do an upsert or find-by-email here:
            const { findPortalUserByEmail } = await import('../db/repositories.js');
            const existing = await findPortalUserByEmail(email as string);
            if (existing) return existing.user;
            throw e;
        });

        const session = await createPortalSession({ userId: user.id });

        // Redirect back to frontend
        res.redirect(302, `/portal/callback?token=${session.token}`);
    })
);
