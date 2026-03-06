import { Router } from 'express';
import { createHash } from 'crypto';
import { z } from 'zod';
import {
    findBoardBySlug,
    listIdeas,
    findIdea,
    listIdeaComments,
    listIdeaCategories,
    voteIdea,
    unvoteIdea,
    ensureUser,
    createIdea,
    getBoardSettingsExtended,
    createPortalUser,
    findPortalUserByEmail,
    findPortalUserByToken,
    createPortalSession,
    deletePortalSession,
    createPublicIdeaComment,
    subscribeToIdea,
    unsubscribeFromIdea,
    getIdeaSubscription,
    listUserSubscriptions,
    favoriteIdea,
    unfavoriteIdea,
    getIdeaFavorite,
    listUserFavorites,
    updatePortalUserProfile,
    listUserIdeas,
    listUserVotedIdeas,
    listChangelogEntries,
    listThreadedComments,
    createThreadedComment,
    upvoteComment,
    removeCommentUpvote,
    createPasswordResetToken,
    findPasswordResetToken,
    markResetTokenUsed,
    updatePortalUserPassword,
    listIdeaAttachments,
    insertIdeaAttachment,
    listCommentAttachments,
    insertCommentAttachment,
} from '../db/repositories.js';
import { asyncHandler } from '../lib/async-handler.js';
import multer from 'multer';
import { uploadFileBuffer } from '../lib/storage.js';
import { addClient, broadcast } from '../lib/sse.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

const ideaSortSchema = z.enum(['top_voted', 'most_commented', 'newest']).optional();
const ideaStatusSchema = z.enum([
    'new',
    'under_review',
    'accepted',
    'planned',
    'in_progress',
    'completed',
    'declined',
]);

const publicIdeasQuerySchema = z.object({
    status: ideaStatusSchema.optional(),
    search: z.string().max(120).optional(),
    categoryIds: z.string().optional(),
    sort: ideaSortSchema,
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).optional(),
});

const registerSchema = z.object({
    email: z.string().email().max(255),
    password: z.string().min(6).max(128),
    displayName: z.string().trim().min(1).max(100).optional(),
});

const loginSchema = z.object({
    email: z.string().email().max(255),
    password: z.string().min(1).max(128),
});

const submitIdeaSchema = z.object({
    title: z.string().trim().min(4).max(180),
    description: z.string().trim().min(8).max(8000),
    categoryIds: z.array(z.string().min(1)).max(20).optional(),
});

const commentSchema = z.object({
    body: z.string().trim().min(2).max(4000),
    parentCommentId: z.string().trim().uuid().optional(),
});

const profileUpdateSchema = z.object({
    displayName: z.string().trim().min(1).max(100).optional(),
    avatarUrl: z.string().url().max(2000).optional(),
});

const ANON_USER_ID = '00000000-0000-0000-0000-000000000001';

function getVisitorId(req: { header: (name: string) => string | undefined }): string {
    return req.header('x-visitor-id') ?? ANON_USER_ID;
}

function parseCategoryIds(value?: string): string[] | undefined {
    if (!value || value.trim().length === 0) return undefined;
    return value.split(',').filter((id) => id.trim().length > 0);
}

function hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
}

async function ensureVisitor(visitorId: string): Promise<void> {
    await ensureUser({
        userId: visitorId,
        email: `visitor-${visitorId.slice(0, 8)}@portal.customervoice.local`,
        displayName: 'Portal Visitor',
    });
}

async function getPortalUser(req: { header: (name: string) => string | undefined }) {
    const authHeader = req.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    if (!token || token.length === 0) return null;
    return findPortalUserByToken(token);
}

export const publicRouter = Router();

/* ── GET /public/boards/:boardSlug/stream ── */
publicRouter.get(
    '/public/boards/:boardSlug/stream',
    asyncHandler(async (req, res) => {
        const slug = String(req.params.boardSlug);
        const board = await findBoardBySlug({ slug, onlyPublic: false });

        if (!board) {
            res.status(404).json({ error: 'board_not_found' });
            return;
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        // Prevent buffering in proxies
        res.flushHeaders();

        addClient(board.id, res);
    }),
);

/* ── GET /public/boards/:boardSlug ── */
publicRouter.get(
    '/public/boards/:boardSlug',
    asyncHandler(async (req, res) => {
        const slug = String(req.params.boardSlug);
        const board = await findBoardBySlug({ slug, onlyPublic: false });

        if (!board) {
            res.status(404).json({ error: 'board_not_found' });
            return;
        }

        // Get settings to check access mode
        const settings = await getBoardSettingsExtended(board.id);

        if (settings.accessMode === 'private' || settings.accessMode === 'domain_restricted') {
            const portalUser = await getPortalUser(req);
            if (!portalUser) {
                // Return board info but with limited data so portal can show login
                res.status(200).json({
                    ...board,
                    _accessRestricted: true,
                    _accessMode: settings.accessMode,
                });
                return;
            }

            if (settings.accessMode === 'domain_restricted') {
                const domain = portalUser.email.split('@')[1]?.toLowerCase();
                if (!settings.allowedDomains.some((d) => d.toLowerCase() === domain)) {
                    res.status(403).json({ error: 'domain_not_allowed' });
                    return;
                }
            }
        }

        res.status(200).json(board);
    }),
);

/* ── GET /public/boards/:boardSlug/settings ── */
publicRouter.get(
    '/public/boards/:boardSlug/settings',
    asyncHandler(async (req, res) => {
        const slug = String(req.params.boardSlug);
        const board = await findBoardBySlug({ slug, onlyPublic: false });

        if (!board) {
            res.status(404).json({ error: 'board_not_found' });
            return;
        }

        const settings = await getBoardSettingsExtended(board.id);
        res.status(200).json(settings);
    }),
);

/* ── GET /public/boards/:boardSlug/ideas ── */
publicRouter.get(
    '/public/boards/:boardSlug/ideas',
    asyncHandler(async (req, res) => {
        const slug = String(req.params.boardSlug);
        const board = await findBoardBySlug({ slug, onlyPublic: false });

        if (!board) {
            res.status(404).json({ error: 'board_not_found' });
            return;
        }

        const parsed = publicIdeasQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
            return;
        }

        const portalUser = await getPortalUser(req);
        const visitorId = portalUser?.id ?? getVisitorId(req);

        const items = await listIdeas({
            workspaceId: board.workspaceId,
            boardId: board.id,
            status: parsed.data.status,
            search: parsed.data.search,
            categoryIds: parseCategoryIds(parsed.data.categoryIds),
            sort: parsed.data.sort ?? 'top_voted',
            limit: parsed.data.limit ?? 20,
            offset: parsed.data.offset ?? 0,
            viewerId: visitorId,
        });

        res.status(200).json({ items });
    }),
);

/* ── GET /public/boards/:boardSlug/ideas/:ideaId ── */
publicRouter.get(
    '/public/boards/:boardSlug/ideas/:ideaId',
    asyncHandler(async (req, res) => {
        const slug = String(req.params.boardSlug);
        const board = await findBoardBySlug({ slug, onlyPublic: false });

        if (!board) {
            res.status(404).json({ error: 'board_not_found' });
            return;
        }

        const ideaId = String(req.params.ideaId);
        const portalUser = await getPortalUser(req);
        const visitorId = portalUser?.id ?? getVisitorId(req);

        const idea = await findIdea({
            workspaceId: board.workspaceId,
            boardId: board.id,
            ideaId,
            viewerId: visitorId,
        });

        if (!idea) {
            res.status(404).json({ error: 'idea_not_found' });
            return;
        }

        const useThreaded = req.query.threaded === 'true';
        const comments = useThreaded
            ? await listThreadedComments({ workspaceId: board.workspaceId, ideaId: idea.id })
            : await listIdeaComments({ workspaceId: board.workspaceId, ideaId: idea.id });

        // Enrich with subscription/favorite state if authenticated
        let isSubscribed = false;
        let isFavorited = false;
        if (portalUser) {
            [isSubscribed, isFavorited] = await Promise.all([
                getIdeaSubscription({ ideaId: idea.id, userId: portalUser.id }),
                getIdeaFavorite({ ideaId: idea.id, userId: portalUser.id }),
            ]);
        }

        const attachments = await listIdeaAttachments({
            workspaceId: board.workspaceId,
            ideaId: idea.id,
        });

        res.status(200).json({ idea, comments, isSubscribed, isFavorited, attachments });
    }),
);

/* ── POST /public/boards/:boardSlug/ideas/:ideaId/attachments ── */
publicRouter.post(
    '/public/boards/:boardSlug/ideas/:ideaId/attachments',
    upload.single('file'),
    asyncHandler(async (req, res) => {
        const slug = String(req.params.boardSlug);
        const board = await findBoardBySlug({ slug, onlyPublic: false });

        if (!board) {
            res.status(404).json({ error: 'board_not_found' });
            return;
        }

        // Technically we should check auth settings for the board
        const settings = await getBoardSettingsExtended(board.id);
        const portalUser = await getPortalUser(req);

        if (settings.requireAuthToSubmit && !portalUser) {
            res.status(401).json({ error: 'auth_required' });
            return;
        }

        if (!req.file) {
            res.status(400).json({ error: 'missing_file' });
            return;
        }

        const ideaId = String(req.params.ideaId);
        const visitorId = portalUser?.id ?? getVisitorId(req);
        const { buffer, originalname, mimetype, size } = req.file;

        const fileUrl = await uploadFileBuffer(
            buffer,
            originalname,
            mimetype,
            `workspaces/${board.workspaceId}/boards/${board.id}/ideas/${ideaId}`
        );

        const attachmentRecord = await insertIdeaAttachment({
            workspaceId: board.workspaceId,
            boardId: board.id,
            ideaId,
            fileName: originalname,
            fileUrl,
            contentType: mimetype,
            sizeBytes: size,
            createdBy: visitorId,
        });

        res.status(201).json(attachmentRecord);
    }),
);

/* ── GET /public/boards/:boardSlug/categories ── */
publicRouter.get(
    '/public/boards/:boardSlug/categories',
    asyncHandler(async (req, res) => {
        const slug = String(req.params.boardSlug);
        const board = await findBoardBySlug({ slug, onlyPublic: false });

        if (!board) {
            res.status(404).json({ error: 'board_not_found' });
            return;
        }

        const items = await listIdeaCategories({
            workspaceId: board.workspaceId,
        });

        res.status(200).json({ items });
    }),
);

/* ── POST /public/boards/:boardSlug/ideas/:ideaId/votes ── */
publicRouter.post(
    '/public/boards/:boardSlug/ideas/:ideaId/votes',
    asyncHandler(async (req, res) => {
        const slug = String(req.params.boardSlug);
        const board = await findBoardBySlug({ slug, onlyPublic: false });

        if (!board) {
            res.status(404).json({ error: 'board_not_found' });
            return;
        }

        const settings = await getBoardSettingsExtended(board.id);
        const portalUser = await getPortalUser(req);

        if (settings.requireAuthToVote && !portalUser) {
            res.status(401).json({ error: 'auth_required', message: 'Sign in to vote' });
            return;
        }

        const ideaId = String(req.params.ideaId);
        const userId = portalUser?.id ?? getVisitorId(req);

        if (!portalUser) {
            await ensureVisitor(userId);
        } else {
            await ensureUser({
                userId: portalUser.id,
                email: portalUser.email,
                displayName: portalUser.displayName ?? undefined,
            });
        }

        const vote = await voteIdea({
            workspaceId: board.workspaceId,
            ideaId,
            userId,
        });

        broadcast(board.id, 'idea.voted', { ideaId, delta: 1 });
        res.status(200).json(vote);
    }),
);

/* ── DELETE /public/boards/:boardSlug/ideas/:ideaId/votes ── */
publicRouter.delete(
    '/public/boards/:boardSlug/ideas/:ideaId/votes',
    asyncHandler(async (req, res) => {
        const slug = String(req.params.boardSlug);
        const board = await findBoardBySlug({ slug, onlyPublic: false });

        if (!board) {
            res.status(404).json({ error: 'board_not_found' });
            return;
        }

        const ideaId = String(req.params.ideaId);
        const portalUser = await getPortalUser(req);
        const userId = portalUser?.id ?? getVisitorId(req);

        const vote = await unvoteIdea({
            workspaceId: board.workspaceId,
            ideaId,
            userId,
        });

        broadcast(board.id, 'idea.voted', { ideaId, delta: -1 });
        res.status(200).json(vote);
    }),
);

/* ── POST /public/boards/:boardSlug/ideas — Submit New Idea ── */
publicRouter.post(
    '/public/boards/:boardSlug/ideas',
    asyncHandler(async (req, res) => {
        const slug = String(req.params.boardSlug);
        const board = await findBoardBySlug({ slug, onlyPublic: false });

        if (!board) {
            res.status(404).json({ error: 'board_not_found' });
            return;
        }

        const settings = await getBoardSettingsExtended(board.id);

        if (!settings.enableIdeaSubmission) {
            res.status(403).json({ error: 'submission_disabled' });
            return;
        }

        const portalUser = await getPortalUser(req);

        if (settings.requireAuthToSubmit && !portalUser) {
            res.status(401).json({ error: 'auth_required', message: 'Sign in to submit ideas' });
            return;
        }

        const parsed = submitIdeaSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
            return;
        }

        let creatorId: string;
        if (portalUser) {
            creatorId = portalUser.id;
            await ensureUser({
                userId: portalUser.id,
                email: portalUser.email,
                displayName: portalUser.displayName ?? undefined,
            });
        } else {
            creatorId = getVisitorId(req);
            await ensureVisitor(creatorId);
        }

        const idea = await createIdea({
            workspaceId: board.workspaceId,
            boardId: board.id,
            title: parsed.data.title,
            description: parsed.data.description,
            categoryIds: parsed.data.categoryIds,
            createdBy: creatorId,
        });

        res.status(201).json(idea);
    }),
);

/* ── POST /public/boards/:boardSlug/ideas/:ideaId/comments — Post Comment ── */
publicRouter.post(
    '/public/boards/:boardSlug/ideas/:ideaId/comments',
    asyncHandler(async (req, res) => {
        const slug = String(req.params.boardSlug);
        const board = await findBoardBySlug({ slug, onlyPublic: false });

        if (!board) {
            res.status(404).json({ error: 'board_not_found' });
            return;
        }

        const settings = await getBoardSettingsExtended(board.id);

        if (!settings.enableCommenting) {
            res.status(403).json({ error: 'commenting_disabled' });
            return;
        }

        const portalUser = await getPortalUser(req);

        if (settings.requireAuthToComment && !portalUser) {
            res.status(401).json({ error: 'auth_required', message: 'Sign in to comment' });
            return;
        }

        const parsed = commentSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
            return;
        }

        const ideaId = String(req.params.ideaId);
        let userId: string;
        let userEmail: string;

        if (portalUser) {
            userId = portalUser.id;
            userEmail = portalUser.email;
        } else {
            userId = getVisitorId(req);
            userEmail = `visitor-${userId.slice(0, 8)}@portal.customervoice.local`;
        }

        try {
            const comment = await createThreadedComment({
                workspaceId: board.workspaceId,
                ideaId,
                userId,
                userEmail,
                body: parsed.data.body,
                parentCommentId: parsed.data.parentCommentId,
            });

            broadcast(board.id, 'comment.created', { ideaId, comment });
            res.status(201).json(comment);
        } catch (err) {
            if (err instanceof Error && err.message === 'idea_comments_locked') {
                res.status(409).json({ error: 'idea_comments_locked' });
                return;
            }
            if (err instanceof Error && err.message === 'idea_not_found') {
                res.status(404).json({ error: 'idea_not_found' });
                return;
            }
            throw err;
        }
    }),
);

/* ── POST /public/boards/:boardSlug/ideas/:ideaId/comments/:commentId/attachments ── */
publicRouter.post(
    '/public/boards/:boardSlug/ideas/:ideaId/comments/:commentId/attachments',
    upload.single('file'),
    asyncHandler(async (req, res) => {
        const slug = String(req.params.boardSlug);
        const board = await findBoardBySlug({ slug, onlyPublic: false });

        if (!board) {
            res.status(404).json({ error: 'board_not_found' });
            return;
        }

        const settings = await getBoardSettingsExtended(board.id);
        const portalUser = await getPortalUser(req);

        if (settings.requireAuthToComment && !portalUser) {
            res.status(401).json({ error: 'auth_required' });
            return;
        }

        if (!req.file) {
            res.status(400).json({ error: 'missing_file' });
            return;
        }

        const ideaId = String(req.params.ideaId);
        const commentId = String(req.params.commentId);
        const visitorId = portalUser?.id ?? getVisitorId(req);
        const { buffer, originalname, mimetype, size } = req.file;

        const fileUrl = await uploadFileBuffer(
            buffer,
            originalname,
            mimetype,
            `workspaces/${board.workspaceId}/boards/${board.id}/ideas/${ideaId}/comments/${commentId}`
        );

        const attachmentRecord = await insertCommentAttachment({
            workspaceId: board.workspaceId,
            boardId: board.id,
            ideaId,
            commentId,
            fileName: originalname,
            fileUrl,
            contentType: mimetype,
            sizeBytes: size,
            createdBy: visitorId,
        });

        res.status(201).json(attachmentRecord);
    }),
);

/* ── POST /public/auth/register ── */
publicRouter.post(
    '/public/auth/register',
    asyncHandler(async (req, res) => {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
            return;
        }

        const existing = await findPortalUserByEmail(parsed.data.email);
        if (existing) {
            res.status(409).json({ error: 'email_already_registered' });
            return;
        }

        const passwordHash = hashPassword(parsed.data.password);
        const user = await createPortalUser({
            email: parsed.data.email,
            displayName: parsed.data.displayName,
            passwordHash,
        });

        const session = await createPortalSession({ userId: user.id });

        res.status(201).json({
            user,
            token: session.token,
            expiresAt: session.expiresAt,
        });
    }),
);

/* ── POST /public/auth/login ── */
publicRouter.post(
    '/public/auth/login',
    asyncHandler(async (req, res) => {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
            return;
        }

        const record = await findPortalUserByEmail(parsed.data.email);
        if (!record) {
            res.status(401).json({ error: 'invalid_credentials' });
            return;
        }

        const passwordHash = hashPassword(parsed.data.password);
        if (record.passwordHash !== passwordHash) {
            res.status(401).json({ error: 'invalid_credentials' });
            return;
        }

        const session = await createPortalSession({ userId: record.user.id });

        res.status(200).json({
            user: record.user,
            token: session.token,
            expiresAt: session.expiresAt,
        });
    }),
);

/* ── GET /public/auth/me ── */
publicRouter.get(
    '/public/auth/me',
    asyncHandler(async (req, res) => {
        const user = await getPortalUser(req);
        if (!user) {
            res.status(401).json({ error: 'not_authenticated' });
            return;
        }

        res.status(200).json({ user });
    }),
);

/* ── POST /public/auth/logout ── */
publicRouter.post(
    '/public/auth/logout',
    asyncHandler(async (req, res) => {
        const authHeader = req.header('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7).trim();
            if (token.length > 0) {
                await deletePortalSession(token);
            }
        }

        res.status(200).json({ ok: true });
    }),
);

/* ── POST /public/boards/:boardSlug/ideas/:ideaId/subscribe ── */
publicRouter.post(
    '/public/boards/:boardSlug/ideas/:ideaId/subscribe',
    asyncHandler(async (req, res) => {
        const portalUser = await getPortalUser(req);
        if (!portalUser) {
            res.status(401).json({ error: 'auth_required', message: 'Sign in to follow ideas' });
            return;
        }

        const ideaId = String(req.params.ideaId);
        const result = await subscribeToIdea({ ideaId, userId: portalUser.id });
        res.status(200).json(result);
    }),
);

/* ── DELETE /public/boards/:boardSlug/ideas/:ideaId/subscribe ── */
publicRouter.delete(
    '/public/boards/:boardSlug/ideas/:ideaId/subscribe',
    asyncHandler(async (req, res) => {
        const portalUser = await getPortalUser(req);
        if (!portalUser) {
            res.status(401).json({ error: 'auth_required' });
            return;
        }

        const ideaId = String(req.params.ideaId);
        await unsubscribeFromIdea({ ideaId, userId: portalUser.id });
        res.status(200).json({ ok: true });
    }),
);

/* ── POST /public/boards/:boardSlug/ideas/:ideaId/favorite ── */
publicRouter.post(
    '/public/boards/:boardSlug/ideas/:ideaId/favorite',
    asyncHandler(async (req, res) => {
        const portalUser = await getPortalUser(req);
        if (!portalUser) {
            res.status(401).json({ error: 'auth_required', message: 'Sign in to favorite ideas' });
            return;
        }

        const ideaId = String(req.params.ideaId);
        const result = await favoriteIdea({ ideaId, userId: portalUser.id });
        res.status(200).json(result);
    }),
);

/* ── DELETE /public/boards/:boardSlug/ideas/:ideaId/favorite ── */
publicRouter.delete(
    '/public/boards/:boardSlug/ideas/:ideaId/favorite',
    asyncHandler(async (req, res) => {
        const portalUser = await getPortalUser(req);
        if (!portalUser) {
            res.status(401).json({ error: 'auth_required' });
            return;
        }

        const ideaId = String(req.params.ideaId);
        await unfavoriteIdea({ ideaId, userId: portalUser.id });
        res.status(200).json({ ok: true });
    }),
);

/* ── GET /public/me/profile ── */
publicRouter.get(
    '/public/me/profile',
    asyncHandler(async (req, res) => {
        const portalUser = await getPortalUser(req);
        if (!portalUser) {
            res.status(401).json({ error: 'not_authenticated' });
            return;
        }
        res.status(200).json({ user: portalUser });
    }),
);

/* ── PATCH /public/me/profile ── */
publicRouter.patch(
    '/public/me/profile',
    asyncHandler(async (req, res) => {
        const portalUser = await getPortalUser(req);
        if (!portalUser) {
            res.status(401).json({ error: 'not_authenticated' });
            return;
        }

        const parsed = profileUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
            return;
        }

        const updated = await updatePortalUserProfile({
            userId: portalUser.id,
            displayName: parsed.data.displayName,
            avatarUrl: parsed.data.avatarUrl,
        });

        res.status(200).json({ user: updated });
    }),
);

/* ── GET /public/me/subscriptions ── */
publicRouter.get(
    '/public/me/subscriptions',
    asyncHandler(async (req, res) => {
        const portalUser = await getPortalUser(req);
        if (!portalUser) {
            res.status(401).json({ error: 'not_authenticated' });
            return;
        }

        const ideaIds = await listUserSubscriptions({ userId: portalUser.id });
        res.status(200).json({ ideaIds });
    }),
);

/* ── GET /public/me/favorites ── */
publicRouter.get(
    '/public/me/favorites',
    asyncHandler(async (req, res) => {
        const portalUser = await getPortalUser(req);
        if (!portalUser) {
            res.status(401).json({ error: 'not_authenticated' });
            return;
        }

        const ideaIds = await listUserFavorites({ userId: portalUser.id });
        res.status(200).json({ ideaIds });
    }),
);

/* ── GET /public/me/ideas ── */
publicRouter.get(
    '/public/me/ideas',
    asyncHandler(async (req, res) => {
        const portalUser = await getPortalUser(req);
        if (!portalUser) {
            res.status(401).json({ error: 'not_authenticated' });
            return;
        }

        const items = await listUserIdeas({ userId: portalUser.id });
        res.status(200).json({ items });
    }),
);

/* ── GET /public/me/votes ── */
publicRouter.get(
    '/public/me/votes',
    asyncHandler(async (req, res) => {
        const portalUser = await getPortalUser(req);
        if (!portalUser) {
            res.status(401).json({ error: 'not_authenticated' });
            return;
        }

        const items = await listUserVotedIdeas({ userId: portalUser.id });
        res.status(200).json({ items });
    }),
);

/* ── GET /public/boards/:boardSlug/changelog ── */
publicRouter.get(
    '/public/boards/:boardSlug/changelog',
    asyncHandler(async (req, res) => {
        const slug = String(req.params.boardSlug);
        const board = await findBoardBySlug({ slug, onlyPublic: false });

        if (!board) {
            res.status(404).json({ error: 'board_not_found' });
            return;
        }

        const limit = Number(req.query.limit) || 50;
        const offset = Number(req.query.offset) || 0;

        const items = await listChangelogEntries({
            workspaceId: board.workspaceId,
            boardId: board.id,
            limit,
            offset,
        });

        res.status(200).json({ items });
    })
);

/* ── POST /public/boards/:boardSlug/ideas/:ideaId/comments/:commentId/upvote ── */
publicRouter.post(
    '/public/boards/:boardSlug/ideas/:ideaId/comments/:commentId/upvote',
    asyncHandler(async (req, res) => {
        const portalUser = await getPortalUser(req);
        if (!portalUser) {
            res.status(401).json({ error: 'auth_required' });
            return;
        }

        const commentId = String(req.params.commentId);
        const result = await upvoteComment({ commentId, userId: portalUser.id });
        res.status(200).json(result);
    })
);

/* ── DELETE /public/boards/:boardSlug/ideas/:ideaId/comments/:commentId/upvote ── */
publicRouter.delete(
    '/public/boards/:boardSlug/ideas/:ideaId/comments/:commentId/upvote',
    asyncHandler(async (req, res) => {
        const portalUser = await getPortalUser(req);
        if (!portalUser) {
            res.status(401).json({ error: 'auth_required' });
            return;
        }

        const commentId = String(req.params.commentId);
        const result = await removeCommentUpvote({ commentId, userId: portalUser.id });
        res.status(200).json(result);
    })
);

/* ── POST /public/auth/forgot-password ── */
publicRouter.post(
    '/public/auth/forgot-password',
    asyncHandler(async (req, res) => {
        const schema = z.object({ email: z.string().email() });
        const parsed = schema.safeParse(req.body);

        if (!parsed.success) {
            res.status(400).json({ error: 'invalid_email' });
            return;
        }

        const record = await findPortalUserByEmail(parsed.data.email);

        if (record) {
            const { token } = await createPasswordResetToken({
                userId: record.user.id,
                userEmail: record.user.email
            });
            // In a real app, send email here. For now, we just console.log
            console.log(`[DEV] Password reset token for ${record.user.email}: ${token}`);
        }

        // Always return success to prevent email enumeration
        res.status(200).json({ ok: true, message: 'If the email exists, a reset link has been sent.' });
    })
);

/* ── POST /public/auth/reset-password ── */
publicRouter.post(
    '/public/auth/reset-password',
    asyncHandler(async (req, res) => {
        const schema = z.object({
            token: z.string().min(1),
            password: z.string().min(6).max(128),
        });
        const parsed = schema.safeParse(req.body);

        if (!parsed.success) {
            res.status(400).json({ error: 'invalid_payload' });
            return;
        }

        const resetRecord = await findPasswordResetToken(parsed.data.token);

        if (!resetRecord || resetRecord.used || new Date(resetRecord.expiresAt) < new Date()) {
            res.status(400).json({ error: 'invalid_or_expired_token' });
            return;
        }

        const passwordHash = hashPassword(parsed.data.password);

        await updatePortalUserPassword({
            userId: resetRecord.userId,
            passwordHash,
        });

        await markResetTokenUsed(parsed.data.token);

        res.status(200).json({ ok: true });
    })
);

/* ── GET /public/auth/:provider ── */
publicRouter.get(
    '/public/auth/:provider',
    asyncHandler(async (req, res) => {
        const provider = String(req.params.provider);
        if (!['github', 'google'].includes(provider)) {
            res.status(400).send('Invalid provider');
            return;
        }

        // Mock OAuth redirect directly to callback with a mock code
        const apiBase = process.env.VITE_API_URL || 'http://localhost:8080/api/v1';
        res.redirect(`${apiBase}/public/auth/${provider}/callback?code=mock_code_for_${provider}`);
    })
);

/* ── GET /public/auth/:provider/callback ── */
publicRouter.get(
    '/public/auth/:provider/callback',
    asyncHandler(async (req, res) => {
        const provider = String(req.params.provider);
        if (!['github', 'google'].includes(provider)) {
            res.status(400).send('Invalid provider');
            return;
        }

        // Mock getting user details
        const email = `mockuser_${provider}@example.com`;
        const displayName = `Mock ${provider === 'github' ? 'GitHub' : 'Google'} User`;

        let record = await findPortalUserByEmail(email);
        if (!record) {
            const newUser = await createPortalUser({
                email,
                displayName,
                authProvider: provider,
            });
            record = { user: newUser, passwordHash: null };
        }

        const { token } = await createPortalSession({ userId: record.user.id });

        // Redirect back to portal with token.
        const portalUrl = process.env.VITE_APP_URL || 'http://localhost:3000/portal';
        res.redirect(`${portalUrl}/auth/callback?token=${token}`);
    })
);
