import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const WORKSPACE_ID = '22222222-2222-2222-2222-222222222222';
const ADMIN_ID = '33333333-3333-3333-3333-333333333333';

type QueryFn = <T = unknown>(text: string, params?: unknown[]) => Promise<{
    rows: T[];
    rowCount: number | null;
}>;

let app: ReturnType<(typeof import('../../src/app.js'))['createApp']>;
let query: QueryFn;
let closePool: () => Promise<void>;
let runMigrations: () => Promise<void>;

function headers(params: { userId: string; role: string; workspaceId?: string }) {
    return {
        'x-user-id': params.userId,
        'x-role': params.role,
        'x-workspace-id': params.workspaceId ?? WORKSPACE_ID,
        'x-user-email': 'admin@customervoice.test',
    };
}

function operatorHeaders(params: { userId: string; globalRole?: 'support_admin' | 'global_admin' }) {
    return {
        'x-user-id': params.userId,
        'x-user-email': 'admin@customervoice.test',
        'x-global-role': params.globalRole ?? 'support_admin',
    };
}

async function seedBaseData(): Promise<void> {
    await query(
        'TRUNCATE TABLE idea_categories, password_reset_tokens, comment_upvotes, idea_comments, idea_votes, ideas, boards, workspace_memberships, users, workspaces, tenants, portal_users RESTART IDENTITY CASCADE',
    );

    await query(
        `
      INSERT INTO tenants (id, name, slug, tenant_key, tenant_type, status, primary_domain)
      VALUES ($1, 'CustomerVoice Test Tenant', 'customer-voice-test', 'tnt_testtenant001', 'enterprise', 'active', 'acme.corp')
    `,
        [TENANT_ID],
    );

    await query(
        `
      INSERT INTO tenant_domains (
        id, tenant_id, domain, is_primary, domain_kind, verification_status, verification_method, verification_token, verified_at, active
      )
      VALUES ('tenant-domain-1', $1, 'acme.corp', TRUE, 'enterprise', 'verified', 'system', 'test-verify', NOW(), TRUE)
    `,
        [TENANT_ID],
    );

    await query(
        `
      INSERT INTO workspaces (id, tenant_id, name, slug, residency_zone, active)
      VALUES ($1, $2, 'Test Workspace', 'test-workspace', 'US', TRUE)
    `,
        [WORKSPACE_ID, TENANT_ID],
    );

    await query(
        `
      INSERT INTO users (id, email, display_name)
      VALUES ($1, 'admin@customervoice.test', 'Admin')
    `,
        [ADMIN_ID],
    );

    await query(
        `
      INSERT INTO workspace_memberships (workspace_id, tenant_id, user_id, role, active, invited_by)
      VALUES ($1, $2, $3, 'workspace_admin', TRUE, $3)
    `,
        [WORKSPACE_ID, TENANT_ID, ADMIN_ID],
    );

    await query(
        `
      INSERT INTO global_operator_assignments (user_id, global_role, active)
      VALUES ($1, 'support_admin', TRUE)
      ON CONFLICT (user_id, global_role) DO UPDATE SET active = TRUE
    `,
        [ADMIN_ID],
    );
}

describe('db-backed integration: public portal flows (Phases 1-3)', () => {
    beforeAll(async () => {
        process.env.AUTH_MODE = 'mock'; // Keep mock for admin routes, but public routes use local JWT
        process.env.DATABASE_URL =
            process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:55432/customervoice_ci';
        process.env.JWT_SECRET = 'test-secret-key';

        const appModule = await import('../../src/app.js');
        const dbModule = await import('../../src/db/client.js');
        const migrationModule = await import('../../src/db/migrations.js');

        app = appModule.createApp();
        query = dbModule.query as QueryFn;
        closePool = dbModule.closePool;
        runMigrations = migrationModule.runMigrations;

        await runMigrations();
    });

    beforeEach(async () => {
        await seedBaseData();
    });

    afterAll(async () => {
        await closePool();
    });

    let boardId: string;
    let boardSlug = 'public-test-board';

    beforeEach(async () => {
        // Create a public board as an admin
        const response = await request(app)
            .post(`/api/v1/workspaces/${WORKSPACE_ID}/boards`)
            .set(headers({ userId: ADMIN_ID, role: 'workspace_admin' }))
            .send({
                name: 'Public Test Board',
                description: 'Board for portal testing',
                visibility: 'public',
            });
        expect(response.status).toBe(201);
        boardId = response.body.id;
        boardSlug = response.body.slug || 'public-test-board';
    });

    it('performs end-to-end public portal flow including auth, ideas, comments, and upvotes', async () => {
        // 1. Register a new portal user
        const registerResponse = await request(app)
            .post('/api/v1/public/auth/register')
            .send({
                email: 'customer@test.com',
                password: 'Password123!',
                displayName: 'Test Customer'
            });

        expect(registerResponse.status).toBe(201);
        expect(registerResponse.body.token).toBeDefined();
        expect(registerResponse.body.user.email).toBe('customer@test.com');
        expect(registerResponse.body.tenant?.tenantKey).toBeTruthy();
        const token = registerResponse.body.token;
        const personalTenantKey = registerResponse.body.tenant.tenantKey as string;

        // 2. Fetch Board Settings
        const settingsResponse = await request(app).get(`/api/v1/public/boards/${boardSlug}/settings`);
        expect(settingsResponse.status).toBe(200);
        expect(settingsResponse.body.boardId).toBe(boardId);

        // 3. Submit an Idea
        const submitResponse = await request(app)
            .post(`/api/v1/public/boards/${boardSlug}/ideas`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'New Portal Idea',
                description: 'Testing the public submission flow with **markdown**'
            });

        expect(submitResponse.status).toBe(201);
        const ideaId = submitResponse.body.id;

        // 4. Vote on the idea
        const voteResponse = await request(app)
            .post(`/api/v1/public/boards/${boardSlug}/ideas/${ideaId}/votes`)
            .set('Authorization', `Bearer ${token}`);

        expect(voteResponse.status).toBe(200);
        expect(voteResponse.body.voteCount).toBe(1);

        // 5. Post a comment
        const commentResponse = await request(app)
            .post(`/api/v1/public/boards/${boardSlug}/ideas/${ideaId}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ body: 'First comment!' });

        expect(commentResponse.status).toBe(201);
        const commentId = commentResponse.body.id;

        // 6. Post a threaded reply
        const replyResponse = await request(app)
            .post(`/api/v1/public/boards/${boardSlug}/ideas/${ideaId}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ body: 'Replying to the first comment', parentCommentId: commentId });

        expect(replyResponse.status).toBe(201);
        const replyId = replyResponse.body.id;
        expect(replyResponse.body.parentCommentId).toBe(commentId);

        // 7. Upvote the reply
        const upvoteResponse = await request(app)
            .post(`/api/v1/public/boards/${boardSlug}/ideas/${ideaId}/comments/${replyId}/upvote`)
            .set('Authorization', `Bearer ${token}`);

        expect(upvoteResponse.status).toBe(200);

        // 8. Fetch threaded comments and verify nesting
        const fetchCommentsRes = await request(app)
            .get(`/api/v1/public/boards/${boardSlug}/ideas/${ideaId}?threaded=true`)
            .set('Authorization', `Bearer ${token}`);

        expect(fetchCommentsRes.status).toBe(200);
        const comments = fetchCommentsRes.body.comments;

        expect(comments).toHaveLength(2);
        const rootComment = comments.find((item: { id: string }) => item.id === commentId);
        const replyComment = comments.find((item: { id: string }) => item.id === replyId);
        expect(rootComment).toBeDefined();
        expect(replyComment).toBeDefined();
        expect(replyComment?.parentCommentId).toBe(commentId);
        expect(replyComment?.upvoteCount).toBe(1);

        // 9. Forgot Password capability
        const forgotResponse = await request(app)
            .post('/api/v1/public/auth/forgot-password')
            .send({ email: 'customer@test.com' });

        expect(forgotResponse.status).toBe(200);

        // To functionally test reset, we need the token from the DB since we don't have a mail catcher
        const tokenRows = await query<{ token: string }>(
            `SELECT token FROM password_reset_tokens WHERE user_id = (SELECT id FROM portal_users WHERE email = 'customer@test.com')`
        );
        expect(tokenRows.rowCount).toBe(1);
        const resetToken = tokenRows.rows[0].token;

        // 10. Perform Password Reset
        const resetResponse = await request(app)
            .post('/api/v1/public/auth/reset-password')
            .send({ token: resetToken, newPassword: 'NewPassword321!' });

        expect(resetResponse.status).toBe(200);

        // 11. Login with new password
        const ambiguousLoginResponse = await request(app)
            .post('/api/v1/public/auth/login')
            .send({ email: 'customer@test.com', password: 'NewPassword321!' });

        expect(ambiguousLoginResponse.status).toBe(409);
        expect(ambiguousLoginResponse.body.error).toBe('tenant_selection_required');

        const loginResponse = await request(app)
            .post('/api/v1/public/auth/login')
            .send({
                email: 'customer@test.com',
                password: 'NewPassword321!',
                tenantKey: personalTenantKey,
            });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.body.token).toBeDefined();
    });

    it('lists changelog entries for a board', async () => {
        // 1. Create a changelog entry via Admin 
        // Wait, there is no admin route for creating changelog yet in public.ts, 
        // so we insert it directly via query to test the GET public route
        await query(
            `INSERT INTO changelog_entries (id, workspace_id, board_id, title, body, entry_type, published_at)
       VALUES ($1, $2, $3, 'Test Release', 'We shipped a feature!', 'feature', NOW())`,
            ['log-123', WORKSPACE_ID, boardId]
        );

        // 2. Fetch the changelog publicly
        const changelogRes = await request(app).get(`/api/v1/public/boards/${boardSlug}/changelog`);
        expect(changelogRes.status).toBe(200);
        expect(changelogRes.body.items).toBeDefined();
        expect(changelogRes.body.items).toHaveLength(1);
        expect(changelogRes.body.items[0].title).toBe('Test Release');
    });

    it('hides internal-only comments from public counts and detail payloads', async () => {
        const registerResponse = await request(app)
            .post('/api/v1/public/auth/register')
            .send({
                email: 'internal-operator@test.com',
                password: 'Password123!',
                displayName: 'Internal Operator'
            });

        expect(registerResponse.status).toBe(201);
        const token = registerResponse.body.token as string;
        const portalUserId = registerResponse.body.user.id as string;

        await query(
            `
              INSERT INTO users (id, email, display_name)
              VALUES ($1, $2, 'Internal Operator')
              ON CONFLICT (id) DO NOTHING
            `,
            [portalUserId, 'internal-operator@test.com'],
        );

        await query(
            `
              INSERT INTO workspace_memberships (workspace_id, user_id, role, active, invited_by)
              VALUES ($1, $2, 'product_manager', TRUE, $3)
              ON CONFLICT (workspace_id, user_id) DO NOTHING
            `,
            [WORKSPACE_ID, portalUserId, ADMIN_ID],
        );

        const submitResponse = await request(app)
            .post(`/api/v1/public/boards/${boardSlug}/ideas`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Internal Notes Visibility Check',
                description: 'Ensure internal comments stay out of public counts and payloads.'
            });

        expect(submitResponse.status).toBe(201);
        const ideaId = submitResponse.body.id as string;

        const internalCommentResponse = await request(app)
            .post(`/api/v1/public/boards/${boardSlug}/ideas/${ideaId}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                body: 'Internal triage note',
                isInternal: true,
            });

        expect(internalCommentResponse.status).toBe(201);
        expect(internalCommentResponse.body.isInternal).toBe(true);

        const detailResponse = await request(app)
            .get(`/api/v1/public/boards/${boardSlug}/ideas/${ideaId}?threaded=true`)
            .set('Authorization', `Bearer ${token}`);

        expect(detailResponse.status).toBe(200);
        expect(detailResponse.body.idea.commentCount).toBe(0);
        expect(detailResponse.body.comments).toHaveLength(0);

        const ideasResponse = await request(app)
            .get(`/api/v1/public/boards/${boardSlug}/ideas`)
            .set('Authorization', `Bearer ${token}`);

        expect(ideasResponse.status).toBe(200);
        const listedIdea = ideasResponse.body.items.find((item: { id: string }) => item.id === ideaId) as { commentCount: number } | undefined;
        expect(listedIdea?.commentCount).toBe(0);
    });

    it('enforces domain-restricted access on public content routes', async () => {
        const updateSettingsResponse = await request(app)
            .patch(`/api/v1/workspaces/${WORKSPACE_ID}/boards/${boardId}/settings`)
            .set(headers({ userId: ADMIN_ID, role: 'workspace_admin' }))
            .send({
                accessMode: 'domain_restricted',
                allowedDomains: ['acme.corp'],
                allowedEmails: ['vip@partner.org'],
            });

        expect(updateSettingsResponse.status).toBe(200);

        const boardMetadataResponse = await request(app).get(`/api/v1/public/boards/${boardSlug}`);
        expect(boardMetadataResponse.status).toBe(200);
        expect(boardMetadataResponse.body._accessRestricted).toBe(true);
        expect(boardMetadataResponse.body._accessMode).toBe('domain_restricted');

        const anonymousIdeasResponse = await request(app).get(`/api/v1/public/boards/${boardSlug}/ideas`);
        expect(anonymousIdeasResponse.status).toBe(401);

        const blockedUserRegisterResponse = await request(app)
            .post('/api/v1/public/auth/register')
            .send({
                email: 'outsider@other.com',
                password: 'Password123!',
                displayName: 'Blocked User',
            });
        expect(blockedUserRegisterResponse.status).toBe(201);

        const blockedIdeasResponse = await request(app)
            .get(`/api/v1/public/boards/${boardSlug}/ideas`)
            .set('Authorization', `Bearer ${blockedUserRegisterResponse.body.token}`);
        expect(blockedIdeasResponse.status).toBe(403);

        const allowedDomainRegisterResponse = await request(app)
            .post('/api/v1/public/auth/register')
            .send({
                email: 'member@acme.corp',
                password: 'Password123!',
                displayName: 'Allowed Domain User',
            });
        expect(allowedDomainRegisterResponse.status).toBe(201);

        const allowedIdeasResponse = await request(app)
            .get(`/api/v1/public/boards/${boardSlug}/ideas`)
            .set('Authorization', `Bearer ${allowedDomainRegisterResponse.body.token}`);
        expect(allowedIdeasResponse.status).toBe(200);
        expect(Array.isArray(allowedIdeasResponse.body.items)).toBe(true);

        const allowlistedEmailRegisterResponse = await request(app)
            .post('/api/v1/public/auth/register')
            .send({
                email: 'vip@partner.org',
                password: 'Password123!',
                displayName: 'Allowed Email User',
            });
        expect(allowlistedEmailRegisterResponse.status).toBe(201);

        const allowlistedCategoriesResponse = await request(app)
            .get(`/api/v1/public/boards/${boardSlug}/categories`)
            .set('Authorization', `Bearer ${allowlistedEmailRegisterResponse.body.token}`);
        expect(allowlistedCategoriesResponse.status).toBe(200);
        expect(Array.isArray(allowlistedCategoriesResponse.body.items)).toBe(true);
    });

    it('resolves enterprise domains and personal fallback through the tenant API', async () => {
        const enterpriseResponse = await request(app)
            .post('/api/v1/public/tenant/resolve')
            .send({ domain: 'acme.corp' });

        expect(enterpriseResponse.status).toBe(200);
        expect(enterpriseResponse.body.resolution).toBe('enterprise');
        expect(enterpriseResponse.body.tenant.tenantKey).toBe('tnt_testtenant001');

        const personalResponse = await request(app)
            .post('/api/v1/public/tenant/resolve')
            .send({ email: 'someone@gmail.com' });

        expect(personalResponse.status).toBe(200);
        expect(personalResponse.body.resolution).toBe('personal');
        expect(personalResponse.body.personalTenantFallback).toBe(true);
    });

    it('returns tenant context for registered public sessions', async () => {
        const registerResponse = await request(app)
            .post('/api/v1/public/auth/register')
            .send({
                email: 'member@acme.corp',
                password: 'Password123!',
                displayName: 'Acme Member',
            });

        expect(registerResponse.status).toBe(201);
        expect(registerResponse.body.tenant.tenantType).toBe('enterprise');
        expect(registerResponse.body.tenant.accountType).toBe('enterprise_member');

        const meResponse = await request(app)
            .get('/api/v1/public/auth/me')
            .set('Authorization', `Bearer ${registerResponse.body.token}`);

        expect(meResponse.status).toBe(200);
        expect(meResponse.body.tenant.tenantKey).toBe('tnt_testtenant001');
        expect(meResponse.body.tenant.accountType).toBe('enterprise_member');
    });

    it('issues renewable tenant visitor sessions and revokes them on logout', async () => {
        const boardResponse = await request(app).get(`/api/v1/public/boards/${boardSlug}`);
        expect(boardResponse.status).toBe(200);
        const firstVisitorToken = boardResponse.headers['x-tenant-visitor-token'] as string | undefined;
        expect(firstVisitorToken).toBeTruthy();

        const ideasResponse = await request(app)
            .get(`/api/v1/public/boards/${boardSlug}/ideas`)
            .set('x-tenant-visitor-token', firstVisitorToken ?? '');
        expect(ideasResponse.status).toBe(200);
        expect(ideasResponse.headers['x-tenant-visitor-token']).toBe(firstVisitorToken);

        const logoutResponse = await request(app)
            .post('/api/v1/public/auth/logout')
            .set('x-tenant-visitor-token', firstVisitorToken ?? '');
        expect(logoutResponse.status).toBe(200);

        const renewedBoardResponse = await request(app)
            .get(`/api/v1/public/boards/${boardSlug}`)
            .set('x-tenant-visitor-token', firstVisitorToken ?? '');
        expect(renewedBoardResponse.status).toBe(200);
        expect(renewedBoardResponse.headers['x-tenant-visitor-token']).toBeTruthy();
        expect(renewedBoardResponse.headers['x-tenant-visitor-token']).not.toBe(firstVisitorToken);
    });

    it('supports tenant domain claim proof verification and support-admin impersonation', async () => {
        const claimResponse = await request(app)
            .post(`/api/v1/tenants/${TENANT_ID}/domains`)
            .set(headers({ userId: ADMIN_ID, role: 'tenant_admin' }))
            .send({
                domain: 'identity.acme.corp',
                domainKind: 'alias',
            });

        expect(claimResponse.status).toBe(201);
        expect(claimResponse.body.verification.txtValue).toContain('customervoice-verification=');
        expect(claimResponse.body.verification.proofToken).toBeTruthy();

        const verifyResponse = await request(app)
            .post(`/api/v1/tenants/${TENANT_ID}/domains/${claimResponse.body.id}/verify`)
            .set(headers({ userId: ADMIN_ID, role: 'tenant_admin' }))
            .send({
                proofToken: claimResponse.body.verification.proofToken,
            });

        expect(verifyResponse.status).toBe(200);
        expect(verifyResponse.body.verificationStatus).toBe('verified');

        const impersonateResponse = await request(app)
            .post(`/api/v1/operator/tenants/${TENANT_ID}/impersonate`)
            .set(operatorHeaders({ userId: ADMIN_ID }))
            .send({ assumedRole: 'tenant_admin' });

        expect(impersonateResponse.status).toBe(201);
        const impersonationToken = impersonateResponse.body.impersonation.sessionToken as string;

        const impersonatedDomainsResponse = await request(app)
            .get(`/api/v1/tenants/${TENANT_ID}/domains`)
            .set('x-user-id', ADMIN_ID)
            .set('x-user-email', 'admin@customervoice.test')
            .set('x-impersonation-token', impersonationToken);

        expect(impersonatedDomainsResponse.status).toBe(200);
        expect(Array.isArray(impersonatedDomainsResponse.body.items)).toBe(true);

        const revokeResponse = await request(app)
            .post('/api/v1/operator/impersonations/revoke')
            .set(operatorHeaders({ userId: ADMIN_ID }))
            .send({ sessionToken: impersonationToken });

        expect(revokeResponse.status).toBe(200);

        const expiredImpersonationResponse = await request(app)
            .get(`/api/v1/tenants/${TENANT_ID}/domains`)
            .set('x-user-id', ADMIN_ID)
            .set('x-user-email', 'admin@customervoice.test')
            .set('x-impersonation-token', impersonationToken);

        expect(expiredImpersonationResponse.status).toBe(401);
        expect(expiredImpersonationResponse.body.error).toBe('invalid_impersonation_session');
    });

    it('applies tenant-aware webhook throttling on webhook admin routes', async () => {
        process.env.TENANT_WEBHOOK_RATE_LIMIT = '1';

        const firstResponse = await request(app)
            .get(`/api/v1/workspaces/${WORKSPACE_ID}/webhooks`)
            .set(headers({ userId: ADMIN_ID, role: 'workspace_admin' }));
        expect(firstResponse.status).toBe(200);

        const throttledResponse = await request(app)
            .get(`/api/v1/workspaces/${WORKSPACE_ID}/webhooks`)
            .set(headers({ userId: ADMIN_ID, role: 'workspace_admin' }));
        expect(throttledResponse.status).toBe(429);
        expect(throttledResponse.body.error).toBe('rate_limit_exceeded');

        delete process.env.TENANT_WEBHOOK_RATE_LIMIT;
    });
});
