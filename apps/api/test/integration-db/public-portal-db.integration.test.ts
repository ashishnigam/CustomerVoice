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
    };
}

async function seedBaseData(): Promise<void> {
    await query(
        'TRUNCATE TABLE idea_categories, password_reset_tokens, comment_upvotes, idea_comments, idea_votes, ideas, boards, workspace_memberships, users, workspaces, tenants, portal_users RESTART IDENTITY CASCADE',
    );

    await query(
        `
      INSERT INTO tenants (id, name, slug)
      VALUES ($1, 'CustomerVoice Test Tenant', 'customer-voice-test')
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
      INSERT INTO workspace_memberships (workspace_id, user_id, role, active, invited_by)
      VALUES ($1, $2, 'workspace_admin', TRUE, $2)
    `,
        [WORKSPACE_ID, ADMIN_ID],
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
        const token = registerResponse.body.token;

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
        expect(voteResponse.body.voteCount).toBe(2); // 1 automatic vote for creator + this vote (if it double counts, or just 1 if idempotent)

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
            .get(`/api/v1/public/boards/${boardSlug}/ideas/${ideaId}/comments?threaded=true`);

        expect(fetchCommentsRes.status).toBe(200);
        const comments = fetchCommentsRes.body.items;

        // We should only see roots at top level
        expect(comments).toHaveLength(1);
        expect(comments[0].id).toBe(commentId);
        expect(comments[0].replies).toBeDefined();
        expect(comments[0].replies[0].id).toBe(replyId);
        expect(comments[0].replies[0].upvoteCount).toBe(1);

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
        const loginResponse = await request(app)
            .post('/api/v1/public/auth/login')
            .send({ email: 'customer@test.com', password: 'NewPassword321!' });

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
        const changelogRes = await request(app).get(`/ api / v1 / public / boards / ${boardSlug}/changelog`);
        expect(changelogRes.status).toBe(200);
        expect(changelogRes.body.items).toBeDefined();
        expect(changelogRes.body.items).toHaveLength(1);
        expect(changelogRes.body.items[0].title).toBe('Test Release');
    });
});
