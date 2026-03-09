import { Router } from 'express';
import { createHash } from 'crypto';
import { z } from 'zod';
import {
    countBoardsByLegacySlug,
    ensurePersonalTenantForPortalUser,
    ensurePortalTenantProfile,
    ensureTenantActorForPortalUser,
    ensureTenantActorForVisitor,
    ensureTenantVisitor,
    findBoardBySlug,
    findBoardByPublicKey,
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
    findPortalSessionContextByToken,
    createPortalSession,
    deletePortalSession,
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
    insertCommentAttachment,
    findDefaultWorkspaceForTenant,
    findTenantById,
    findTenantByKey,
    findTenantSsoConnection,
    findActiveTenantVisitorBySessionToken,
    findVerifiedTenantDomain,
    isPublicEmailProviderDomain,
    listPortalTenantProfiles,
    listTenantDomains,
    listTenantSsoConnections,
    renewTenantVisitorSession,
    revokeTenantVisitorSession,
    resolveTenantForEmail,
} from '../db/repositories.js';
import { asyncHandler } from '../lib/async-handler.js';
import multer from 'multer';
import { assignRequestContext } from '../lib/request-context.js';
import { uploadFileBuffer } from '../lib/storage.js';
import { addClient, broadcast } from '../lib/sse.js';
import { acquireConcurrentLease, consumeFixedWindowRateLimit } from '../lib/rate-limit.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

const ideaSortSchema = z.enum(['top_voted', 'most_commented', 'newest', 'highest_impact']).optional();
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
    tenantKey: z.string().trim().min(3).max(80).optional(),
});

const loginSchema = z.object({
    email: z.string().email().max(255),
    password: z.string().min(1).max(128),
    tenantKey: z.string().trim().min(3).max(80).optional(),
});

const tenantResolveSchema = z.object({
    email: z.string().email().max(255).optional(),
    domain: z.string().trim().min(3).max(255).optional(),
}).refine((value) => Boolean(value.email || value.domain), {
    message: 'email_or_domain_required',
});

const submitIdeaSchema = z.object({
    title: z.string().trim().min(4).max(180),
    description: z.string().trim().min(8).max(8000),
    categoryIds: z.array(z.string().min(1)).max(20).optional(),
});

const commentSchema = z.object({
    body: z.string().trim().min(2).max(4000),
    parentCommentId: z.string().trim().uuid().optional(),
    isInternal: z.boolean().optional(),
});

const profileUpdateSchema = z.object({
    displayName: z.string().trim().min(1).max(100).optional(),
    avatarUrl: z.string().url().max(2000).optional(),
});

const publicBoardRoutePatterns = {
    board: ['/public/boards/:boardSlug', '/public/t/:tenantKey/boards/:boardPublicKey'],
    settings: ['/public/boards/:boardSlug/settings', '/public/t/:tenantKey/boards/:boardPublicKey/settings'],
    stream: ['/public/boards/:boardSlug/stream', '/public/t/:tenantKey/boards/:boardPublicKey/stream'],
    ideas: ['/public/boards/:boardSlug/ideas', '/public/t/:tenantKey/boards/:boardPublicKey/ideas'],
    ideaDetail: ['/public/boards/:boardSlug/ideas/:ideaId', '/public/t/:tenantKey/boards/:boardPublicKey/ideas/:ideaId'],
    ideaAttachments: ['/public/boards/:boardSlug/ideas/:ideaId/attachments', '/public/t/:tenantKey/boards/:boardPublicKey/ideas/:ideaId/attachments'],
    categories: ['/public/boards/:boardSlug/categories', '/public/t/:tenantKey/boards/:boardPublicKey/categories'],
    votes: ['/public/boards/:boardSlug/ideas/:ideaId/votes', '/public/t/:tenantKey/boards/:boardPublicKey/ideas/:ideaId/votes'],
    comments: ['/public/boards/:boardSlug/ideas/:ideaId/comments', '/public/t/:tenantKey/boards/:boardPublicKey/ideas/:ideaId/comments'],
    commentAttachments: ['/public/boards/:boardSlug/ideas/:ideaId/comments/:commentId/attachments', '/public/t/:tenantKey/boards/:boardPublicKey/ideas/:ideaId/comments/:commentId/attachments'],
    subscribe: ['/public/boards/:boardSlug/ideas/:ideaId/subscribe', '/public/t/:tenantKey/boards/:boardPublicKey/ideas/:ideaId/subscribe'],
    favorite: ['/public/boards/:boardSlug/ideas/:ideaId/favorite', '/public/t/:tenantKey/boards/:boardPublicKey/ideas/:ideaId/favorite'],
    changelog: ['/public/boards/:boardSlug/changelog', '/public/t/:tenantKey/boards/:boardPublicKey/changelog'],
    commentUpvote: ['/public/boards/:boardSlug/ideas/:ideaId/comments/:commentId/upvote', '/public/t/:tenantKey/boards/:boardPublicKey/ideas/:ideaId/comments/:commentId/upvote'],
} as const;

const tenantVisitorTokenHeader = 'x-tenant-visitor-token';
const tenantVisitorExpiresAtHeader = 'x-tenant-visitor-expires-at';
const tenantVisitorTenantHeader = 'x-tenant-visitor-tenant';

function getVisitorId(req: {
    header: (name: string) => string | undefined;
    ip?: string;
}): string {
    const headerValue = req.header('x-visitor-id')?.trim();
    if (headerValue && headerValue.length > 0) {
        return headerValue;
    }

    const fingerprint = `${req.ip ?? 'unknown'}:${req.header('user-agent') ?? 'browser'}`;
    return `visitor_${createHash('sha256').update(fingerprint).digest('hex').slice(0, 24)}`;
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

async function getPortalSession(req: { header: (name: string) => string | undefined }) {
    const authHeader = req.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    if (!token || token.length === 0) return null;
    return findPortalSessionContextByToken(token);
}

type PortalSessionRecord = NonNullable<Awaited<ReturnType<typeof findPortalSessionContextByToken>>>;
type PublicBoardRecord = NonNullable<Awaited<ReturnType<typeof findBoardByPublicKey>>>;
type BoardSettingsExtended = Awaited<ReturnType<typeof getBoardSettingsExtended>>;
type TenantVisitorSessionRecord = Awaited<ReturnType<typeof ensureTenantVisitor>>;

function decorateBoard(board: PublicBoardRecord) {
    return {
        ...board,
        canonicalPath: `/portal/t/${board.tenantKey}/boards/${board.publicBoardKey}`,
        legacyPath: `/portal/boards/${board.slug}`,
    };
}

function sanitizeBoardSettings(settings: BoardSettingsExtended, accessMode: BoardSettingsExtended['accessMode']) {
    return {
        ...settings,
        allowedDomains: [],
        allowedEmails: [],
        _accessRestricted: true,
        _accessMode: accessMode,
    };
}

function getTenantVisitorToken(req: {
    header: (name: string) => string | undefined;
    query?: Record<string, unknown>;
}): string | null {
    const token = req.header(tenantVisitorTokenHeader)?.trim();
    if (token && token.length > 0) {
        return token;
    }

    const queryToken = typeof req.query?.visitorToken === 'string' ? req.query.visitorToken.trim() : '';
    return queryToken.length > 0 ? queryToken : null;
}

function setTenantVisitorHeaders(
    res: { setHeader: (name: string, value: string) => void },
    visitor: TenantVisitorSessionRecord,
    tenantKey: string | null,
): void {
    res.setHeader(tenantVisitorTokenHeader, visitor.sessionToken);
    res.setHeader(tenantVisitorExpiresAtHeader, visitor.expiresAt);
    if (tenantKey) {
        res.setHeader(tenantVisitorTenantHeader, tenantKey);
    }
}

async function hydrateTenantVisitorSession(params: {
    req: { header: (name: string) => string | undefined; ip?: string };
    res: { setHeader: (name: string, value: string) => void };
    tenantId: string;
    tenantKey: string | null;
}): Promise<TenantVisitorSessionRecord> {
    const existingToken = getTenantVisitorToken(params.req);
    if (existingToken) {
        const existing = await findActiveTenantVisitorBySessionToken({
            tenantId: params.tenantId,
            sessionToken: existingToken,
        });

        if (existing) {
            const renewed = await renewTenantVisitorSession({ tenantVisitorId: existing.id });
            if (renewed) {
                setTenantVisitorHeaders(params.res, renewed, params.tenantKey);
                return renewed;
            }
        }
    }

    const visitorKey = getVisitorId(params.req);
    await ensureVisitor(visitorKey);
    const visitor = await ensureTenantVisitor({
        tenantId: params.tenantId,
        visitorKey,
    });

    setTenantVisitorHeaders(params.res, visitor, params.tenantKey);
    return visitor;
}

function enforceTenantRateLimit(tenantId: string, scope: string, res: { status: (code: number) => { json: (body: unknown) => void } }): boolean {
    const limit = scope === 'sso' ? 30 : scope === 'tenant_resolve' ? 60 : 240;
    const windowMs = 60_000;
    const result = consumeFixedWindowRateLimit({
        bucket: `${scope}:${tenantId}`,
        limit,
        windowMs,
    });

    if (!result.allowed) {
        res.status(429).json({
            error: 'rate_limit_exceeded',
            retryAfterMs: result.retryAfterMs,
        });
        return false;
    }

    return true;
}

async function resolveBoardFromRequest(
    req: { params: Record<string, string | string[] | undefined> },
    res: { status: (code: number) => { json: (body: unknown) => void } },
): Promise<PublicBoardRecord | null> {
    const tenantKeyParam = Array.isArray(req.params.tenantKey) ? req.params.tenantKey[0] : req.params.tenantKey;
    const boardPublicKeyParam = Array.isArray(req.params.boardPublicKey) ? req.params.boardPublicKey[0] : req.params.boardPublicKey;
    if (tenantKeyParam && boardPublicKeyParam) {
        const board = await findBoardByPublicKey({
            tenantKey: String(tenantKeyParam),
            publicBoardKey: String(boardPublicKeyParam),
            onlyPublic: false,
        });

        if (!board) {
            res.status(404).json({ error: 'board_not_found' });
            return null;
        }

        assignRequestContext({
            tenantId: board.tenantId,
            tenantKey: board.tenantKey,
            workspaceId: board.workspaceId,
            boardId: board.id,
        });
        return board;
    }

    const slugParam = Array.isArray(req.params.boardSlug) ? req.params.boardSlug[0] : req.params.boardSlug;
    const slug = String(slugParam ?? '');
    const board = await findBoardBySlug({ slug, onlyPublic: false });
    if (!board) {
        const legacyCount = await countBoardsByLegacySlug({ slug, onlyPublic: false });
        if (legacyCount > 1) {
            res.status(409).json({ error: 'legacy_board_ambiguous' });
            return null;
        }

        res.status(404).json({ error: 'board_not_found' });
        return null;
    }

    assignRequestContext({
        tenantId: board.tenantId,
        tenantKey: board.tenantKey,
        workspaceId: board.workspaceId,
        boardId: board.id,
    });
    return board;
}

function isAllowedByDomainOrEmail(email: string, settings: BoardSettingsExtended): boolean {
    const normalizedEmail = email.trim().toLowerCase();
    const emailAllowed = settings.allowedEmails.some(
        (allowedEmail) => allowedEmail.trim().toLowerCase() === normalizedEmail,
    );

    const emailDomain = normalizedEmail.split('@')[1]?.trim().toLowerCase();
    const domainAllowed = emailDomain
        ? settings.allowedDomains.some(
            (allowedDomain) => allowedDomain.trim().toLowerCase() === emailDomain,
        )
        : false;

    return emailAllowed || domainAllowed;
}

async function resolveBoardActorContext(params: {
    req: { header: (name: string) => string | undefined; ip?: string };
    res: { setHeader: (name: string, value: string) => void };
    board: PublicBoardRecord;
    portalSession: PortalSessionRecord | null;
    visitorSession?: TenantVisitorSessionRecord | null;
}): Promise<{
    userId: string;
    userEmail: string;
    tenantActorId: string;
}> {
    if (params.portalSession) {
        const emailDomain = params.portalSession.user.email.split('@')[1]?.trim().toLowerCase() ?? '';
        const verifiedDomain = emailDomain ? await findVerifiedTenantDomain(emailDomain) : null;
        const accountType =
            params.portalSession.tenantId === params.board.tenantId && params.portalSession.tenantType === 'personal'
                ? 'personal_owner'
                : verifiedDomain?.tenantId === params.board.tenantId
                    ? 'enterprise_member'
                    : 'guest';

        await ensurePortalTenantProfile({
            tenantId: params.board.tenantId,
            portalUserId: params.portalSession.user.id,
            accountType,
            homeDomain: emailDomain || null,
        });

        await ensureUser({
            userId: params.portalSession.user.id,
            email: params.portalSession.user.email,
            displayName: params.portalSession.user.displayName ?? undefined,
        });

        const actor = await ensureTenantActorForPortalUser({
            tenantId: params.board.tenantId,
            portalUserId: params.portalSession.user.id,
            email: params.portalSession.user.email,
            displayName: params.portalSession.user.displayName,
        });

        return {
            userId: params.portalSession.user.id,
            userEmail: params.portalSession.user.email,
            tenantActorId: actor.id,
        };
    }

    const visitorSession = params.visitorSession ?? await hydrateTenantVisitorSession({
        req: params.req,
        res: params.res,
        tenantId: params.board.tenantId,
        tenantKey: params.board.tenantKey,
    });
    const visitorId = visitorSession.visitorKey;
    const actor = await ensureTenantActorForVisitor({
        tenantId: params.board.tenantId,
        visitorKey: visitorId,
    });

    return {
        userId: visitorId,
        userEmail: actor.email ?? `visitor-${visitorId.slice(0, 8)}@portal.customervoice.local`,
        tenantActorId: actor.id,
    };
}

async function enforceBoardAccess(
    req: { header: (name: string) => string | undefined; ip?: string },
    res: {
        status: (code: number) => {
            json: (body: unknown) => void;
        };
        setHeader: (name: string, value: string) => void;
    },
    board: PublicBoardRecord,
    options: { allowRestrictedMetadata?: boolean } = {},
): Promise<{
    granted: boolean;
    portalUser: PortalSessionRecord | null;
    visitorSession: TenantVisitorSessionRecord | null;
    settings: BoardSettingsExtended;
}> {
    const settings = await getBoardSettingsExtended(board.id);
    const portalSession = await getPortalSession(req);

    if (!enforceTenantRateLimit(board.tenantId, 'public_api', res)) {
        return { granted: false, portalUser: null, visitorSession: null, settings };
    }

    if (settings.accessMode === 'public' || settings.accessMode === 'link_only') {
        const visitorSession = portalSession ? null : await hydrateTenantVisitorSession({
            req,
            res,
            tenantId: board.tenantId,
            tenantKey: board.tenantKey,
        });
        return { granted: true, portalUser: portalSession, visitorSession, settings };
    }

    if (!portalSession) {
        if (options.allowRestrictedMetadata) {
            res.status(200).json({
                ...decorateBoard(board),
                _accessRestricted: true,
                _accessMode: settings.accessMode,
                _accessDeniedReason: 'auth_required',
            });
        } else {
            res.status(401).json({ error: 'auth_required', accessMode: settings.accessMode });
        }

        return { granted: false, portalUser: null, visitorSession: null, settings };
    }

    if (settings.accessMode === 'domain_restricted' && !isAllowedByDomainOrEmail(portalSession.user.email, settings)) {
        if (options.allowRestrictedMetadata) {
            res.status(200).json({
                ...decorateBoard(board),
                _accessRestricted: true,
                _accessMode: settings.accessMode,
                _accessDeniedReason: 'domain_not_allowed',
            });
        } else {
            res.status(403).json({ error: 'domain_not_allowed' });
        }

        return { granted: false, portalUser: portalSession, visitorSession: null, settings };
    }

    return { granted: true, portalUser: portalSession, visitorSession: null, settings };
}

export const publicRouter = Router();

publicRouter.post(
    '/public/tenant/resolve',
    asyncHandler(async (req, res) => {
        const parsed = tenantResolveSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
            return;
        }

        const inputDomain = parsed.data.email
            ? parsed.data.email.split('@')[1]?.trim().toLowerCase() ?? ''
            : parsed.data.domain?.trim().toLowerCase() ?? '';

        const resolvedDomain = await findVerifiedTenantDomain(inputDomain);
        if (resolvedDomain) {
            const tenant = await findTenantById(resolvedDomain.tenantId);
            if (!tenant) {
                res.status(404).json({ error: 'tenant_not_found' });
                return;
            }

            assignRequestContext({
                tenantId: tenant.id,
                tenantKey: tenant.tenantKey,
                domain: inputDomain,
            });

            if (!enforceTenantRateLimit(tenant.id, 'tenant_resolve', res)) {
                return;
            }

            const ssoConnections = await listTenantSsoConnections(tenant.id);
            res.status(200).json({
                resolution: 'enterprise',
                domain: inputDomain,
                publicEmailProvider: false,
                personalTenantFallback: false,
                tenant: {
                    id: tenant.id,
                    tenantKey: tenant.tenantKey,
                    name: tenant.name,
                    tenantType: tenant.tenantType,
                    primaryDomain: tenant.primaryDomain,
                },
                loginOptions: {
                    passwordAvailable: true,
                    ssoAvailable: ssoConnections.some((connection) => connection.active),
                },
            });
            return;
        }

        res.status(200).json({
            resolution: 'personal',
            domain: inputDomain,
            publicEmailProvider: isPublicEmailProviderDomain(inputDomain),
            personalTenantFallback: true,
            tenant: null,
            loginOptions: {
                passwordAvailable: true,
                ssoAvailable: false,
            },
        });
    }),
);

publicRouter.get(
    '/public/tenant/:tenantKey',
    asyncHandler(async (req, res) => {
        const tenantKey = String(req.params.tenantKey);
        const tenant = await findTenantByKey(tenantKey);
        if (!tenant) {
            res.status(404).json({ error: 'tenant_not_found' });
            return;
        }

        assignRequestContext({
            tenantId: tenant.id,
            tenantKey: tenant.tenantKey,
        });

        if (!enforceTenantRateLimit(tenant.id, 'tenant_resolve', res)) {
            return;
        }

        const [domains, ssoConnections] = await Promise.all([
            listTenantDomains(tenant.id),
            listTenantSsoConnections(tenant.id),
        ]);

        res.status(200).json({
            tenant: {
                id: tenant.id,
                tenantKey: tenant.tenantKey,
                name: tenant.name,
                tenantType: tenant.tenantType,
                status: tenant.status,
                primaryDomain: tenant.primaryDomain,
            },
            domains: domains.map((domain) => ({
                id: domain.id,
                domain: domain.domain,
                isPrimary: domain.isPrimary,
                verificationStatus: domain.verificationStatus,
            })),
            loginOptions: {
                passwordAvailable: true,
                ssoAvailable: ssoConnections.some((connection) => connection.active),
            },
        });
    }),
);

publicRouter.get(
    '/public/legacy/boards/:boardSlug/resolve',
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        res.status(200).json(decorateBoard(board));
    }),
);

/* ── GET /public/boards/:boardSlug/stream ── */
publicRouter.get(
    [...publicBoardRoutePatterns.stream],
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board);
        if (!access.granted) {
            return;
        }

        const lease = acquireConcurrentLease({
            bucket: `sse:${board.tenantId}`,
            limit: 40,
        });
        if (!lease.allowed) {
            res.status(429).json({ error: 'sse_tenant_limit_reached' });
            return;
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        // Prevent buffering in proxies
        res.flushHeaders();

        res.on('close', lease.release);
        addClient(`${board.tenantId}:${board.id}`, res);
    }),
);

/* ── GET /public/boards/:boardSlug ── */
publicRouter.get(
    [...publicBoardRoutePatterns.board],
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board, { allowRestrictedMetadata: true });
        if (!access.granted) {
            return;
        }

        res.status(200).json(decorateBoard(board));
    }),
);

/* ── GET /public/boards/:boardSlug/settings ── */
publicRouter.get(
    [...publicBoardRoutePatterns.settings],
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const settings = await getBoardSettingsExtended(board.id);
        if (!enforceTenantRateLimit(board.tenantId, 'public_api', res)) {
            return;
        }

        const portalSession = await getPortalSession(req);
        if (settings.accessMode === 'public' || settings.accessMode === 'link_only') {
            if (!portalSession) {
                await hydrateTenantVisitorSession({
                    req,
                    res,
                    tenantId: board.tenantId,
                    tenantKey: board.tenantKey,
                });
            }
            res.status(200).json(settings);
            return;
        }

        if (!portalSession) {
            res.status(200).json(sanitizeBoardSettings(settings, settings.accessMode));
            return;
        }

        if (settings.accessMode === 'domain_restricted' && !isAllowedByDomainOrEmail(portalSession.user.email, settings)) {
            res.status(200).json(sanitizeBoardSettings(settings, settings.accessMode));
            return;
        }

        res.status(200).json(settings);
    }),
);

/* ── GET /public/boards/:boardSlug/ideas ── */
publicRouter.get(
    [...publicBoardRoutePatterns.ideas],
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board);
        if (!access.granted) {
            return;
        }

        const parsed = publicIdeasQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
            return;
        }

        const visitorId = access.portalUser?.user.id ?? access.visitorSession?.visitorKey ?? getVisitorId(req);

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
            excludeInternalComments: true,
        });

        res.status(200).json({ items });
    }),
);

/* ── GET /public/boards/:boardSlug/ideas/:ideaId ── */
publicRouter.get(
    [...publicBoardRoutePatterns.ideaDetail],
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board);
        if (!access.granted) {
            return;
        }

        const ideaId = String(req.params.ideaId);
        const visitorId = access.portalUser?.user.id ?? access.visitorSession?.visitorKey ?? getVisitorId(req);

        const idea = await findIdea({
            workspaceId: board.workspaceId,
            boardId: board.id,
            ideaId,
            viewerId: visitorId,
            excludeInternalComments: true,
        });

        if (!idea) {
            res.status(404).json({ error: 'idea_not_found' });
            return;
        }

        const useThreaded = req.query.threaded === 'true';
        const comments = useThreaded
            ? await listThreadedComments({ workspaceId: board.workspaceId, ideaId: idea.id, excludeInternal: true })
            : await listIdeaComments({ workspaceId: board.workspaceId, ideaId: idea.id, excludeInternal: true });

        // Enrich with subscription/favorite state if authenticated
        let isSubscribed = false;
        let isFavorited = false;
        if (access.portalUser) {
            [isSubscribed, isFavorited] = await Promise.all([
                getIdeaSubscription({ ideaId: idea.id, userId: access.portalUser.user.id }),
                getIdeaFavorite({ ideaId: idea.id, userId: access.portalUser.user.id }),
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
    [...publicBoardRoutePatterns.ideaAttachments],
    upload.single('file'),
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board);
        if (!access.granted) {
            return;
        }

        if (access.settings.requireAuthToSubmit && !access.portalUser) {
            res.status(401).json({ error: 'auth_required' });
            return;
        }

        if (!req.file) {
            res.status(400).json({ error: 'missing_file' });
            return;
        }

        const ideaId = String(req.params.ideaId);
        const visitorId = access.portalUser?.user.id ?? access.visitorSession?.visitorKey ?? getVisitorId(req);
        const { buffer, originalname, mimetype, size } = req.file;

        const fileUrl = await uploadFileBuffer(
            buffer,
            originalname,
            mimetype,
            `tenants/${board.tenantId}/workspaces/${board.workspaceId}/boards/${board.id}/ideas/${ideaId}`
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
    [...publicBoardRoutePatterns.categories],
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board);
        if (!access.granted) {
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
    [...publicBoardRoutePatterns.votes],
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board);
        if (!access.granted) {
            return;
        }

        if (access.settings.requireAuthToVote && !access.portalUser) {
            res.status(401).json({ error: 'auth_required', message: 'Sign in to vote' });
            return;
        }

        const ideaId = String(req.params.ideaId);
        const actorContext = await resolveBoardActorContext({
            req,
            res,
            board,
            portalSession: access.portalUser,
            visitorSession: access.visitorSession,
        });

        const vote = await voteIdea({
            workspaceId: board.workspaceId,
            ideaId,
            userId: actorContext.userId,
            tenantId: board.tenantId,
            tenantActorId: actorContext.tenantActorId,
        });

        broadcast(`${board.tenantId}:${board.id}`, 'idea.voted', { ideaId, delta: 1 });
        res.status(200).json(vote);
    }),
);

/* ── DELETE /public/boards/:boardSlug/ideas/:ideaId/votes ── */
publicRouter.delete(
    [...publicBoardRoutePatterns.votes],
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board);
        if (!access.granted) {
            return;
        }

        const ideaId = String(req.params.ideaId);
        const userId = access.portalUser?.user.id ?? access.visitorSession?.visitorKey ?? getVisitorId(req);

        const vote = await unvoteIdea({
            workspaceId: board.workspaceId,
            ideaId,
            userId,
        });

        broadcast(`${board.tenantId}:${board.id}`, 'idea.voted', { ideaId, delta: -1 });
        res.status(200).json(vote);
    }),
);

/* ── POST /public/boards/:boardSlug/ideas — Submit New Idea ── */
publicRouter.post(
    [...publicBoardRoutePatterns.ideas],
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board);
        if (!access.granted) {
            return;
        }

        if (!access.settings.enableIdeaSubmission) {
            res.status(403).json({ error: 'submission_disabled' });
            return;
        }

        if (access.settings.requireAuthToSubmit && !access.portalUser) {
            res.status(401).json({ error: 'auth_required', message: 'Sign in to submit ideas' });
            return;
        }

        const parsed = submitIdeaSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
            return;
        }

        const actorContext = await resolveBoardActorContext({
            req,
            res,
            board,
            portalSession: access.portalUser,
            visitorSession: access.visitorSession,
        });

        const idea = await createIdea({
            workspaceId: board.workspaceId,
            boardId: board.id,
            tenantId: board.tenantId,
            tenantActorId: actorContext.tenantActorId,
            title: parsed.data.title,
            description: parsed.data.description,
            categoryIds: parsed.data.categoryIds,
            createdBy: actorContext.userId,
        });

        res.status(201).json(idea);
    }),
);

/* ── POST /public/boards/:boardSlug/ideas/:ideaId/comments — Post Comment ── */
publicRouter.post(
    [...publicBoardRoutePatterns.comments],
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board);
        if (!access.granted) {
            return;
        }

        if (!access.settings.enableCommenting) {
            res.status(403).json({ error: 'commenting_disabled' });
            return;
        }

        if (access.settings.requireAuthToComment && !access.portalUser) {
            res.status(401).json({ error: 'auth_required', message: 'Sign in to comment' });
            return;
        }

        const parsed = commentSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
            return;
        }

        const ideaId = String(req.params.ideaId);
        const actorContext = await resolveBoardActorContext({
            req,
            res,
            board,
            portalSession: access.portalUser,
            visitorSession: access.visitorSession,
        });

        try {
            const comment = await createThreadedComment({
                workspaceId: board.workspaceId,
                ideaId,
                userId: actorContext.userId,
                userEmail: actorContext.userEmail,
                tenantId: board.tenantId,
                tenantActorId: actorContext.tenantActorId,
                body: parsed.data.body,
                parentCommentId: parsed.data.parentCommentId,
                isInternal: parsed.data.isInternal ?? false,
            });

            if (!comment.isInternal) {
                broadcast(`${board.tenantId}:${board.id}`, 'comment.created', { ideaId, comment });
            }
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
    [...publicBoardRoutePatterns.commentAttachments],
    upload.single('file'),
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board);
        if (!access.granted) {
            return;
        }

        if (access.settings.requireAuthToComment && !access.portalUser) {
            res.status(401).json({ error: 'auth_required' });
            return;
        }

        if (!req.file) {
            res.status(400).json({ error: 'missing_file' });
            return;
        }

        const ideaId = String(req.params.ideaId);
        const commentId = String(req.params.commentId);
        const visitorId = access.portalUser?.user.id ?? access.visitorSession?.visitorKey ?? getVisitorId(req);
        const { buffer, originalname, mimetype, size } = req.file;

        const fileUrl = await uploadFileBuffer(
            buffer,
            originalname,
            mimetype,
            `tenants/${board.tenantId}/workspaces/${board.workspaceId}/boards/${board.id}/ideas/${ideaId}/comments/${commentId}`
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

        let tenantResolution;
        try {
            tenantResolution = await resolveTenantForEmail({
                email: parsed.data.email,
                requestedTenantKey: parsed.data.tenantKey ?? null,
                portalUser: user,
                displayName: parsed.data.displayName ?? null,
            });
        } catch (error) {
            if (error instanceof Error && error.message === 'tenant_not_found') {
                res.status(404).json({ error: 'tenant_not_found' });
                return;
            }
            throw error;
        }

        const { tenant, accountType } = tenantResolution;

        await ensurePortalTenantProfile({
            tenantId: tenant.id,
            portalUserId: user.id,
            accountType,
            homeDomain: parsed.data.email.split('@')[1]?.trim().toLowerCase() ?? null,
        });

        const workspace = await findDefaultWorkspaceForTenant(tenant.id);
        const session = await createPortalSession({
            userId: user.id,
            tenantId: tenant.id,
            workspaceId: workspace?.id ?? null,
        });

        res.status(201).json({
            user,
            token: session.token,
            expiresAt: session.expiresAt,
            tenant: {
                id: tenant.id,
                tenantKey: tenant.tenantKey,
                tenantType: tenant.tenantType,
                accountType,
            },
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

        let tenant = null as NonNullable<Awaited<ReturnType<typeof findTenantById>>> | null;
        let accountType: 'personal_owner' | 'enterprise_member' | 'guest';
        const existingProfiles = await listPortalTenantProfiles(record.user.id);

        if (!parsed.data.tenantKey && existingProfiles.length > 1) {
            const tenantSummaries = await Promise.all(
                existingProfiles.map(async (profile) => {
                    const profileTenant = await findTenantById(profile.tenantId);
                    return profileTenant
                        ? {
                            id: profileTenant.id,
                            tenantKey: profileTenant.tenantKey,
                            name: profileTenant.name,
                            tenantType: profileTenant.tenantType,
                            accountType: profile.accountType,
                        }
                        : null;
                }),
            );

            res.status(409).json({
                error: 'tenant_selection_required',
                tenants: tenantSummaries.filter(Boolean),
            });
            return;
        }

        if (!parsed.data.tenantKey && existingProfiles.length === 1) {
            const profileTenant = await findTenantById(existingProfiles[0].tenantId);
            if (!profileTenant) {
                res.status(404).json({ error: 'tenant_not_found' });
                return;
            }

            tenant = profileTenant;
            accountType = existingProfiles[0].accountType;
        } else {
            let resolved;
            try {
                resolved = await resolveTenantForEmail({
                    email: parsed.data.email,
                    requestedTenantKey: parsed.data.tenantKey ?? null,
                    portalUser: record.user,
                    displayName: record.user.displayName,
                });
            } catch (error) {
                if (error instanceof Error && error.message === 'tenant_not_found') {
                    res.status(404).json({ error: 'tenant_not_found' });
                    return;
                }
                throw error;
            }
            tenant = resolved.tenant;
            accountType = resolved.accountType;
        }

        if (!tenant) {
            res.status(404).json({ error: 'tenant_not_found' });
            return;
        }

        await ensurePortalTenantProfile({
            tenantId: tenant.id,
            portalUserId: record.user.id,
            accountType,
            homeDomain: parsed.data.email.split('@')[1]?.trim().toLowerCase() ?? null,
        });

        const workspace = await findDefaultWorkspaceForTenant(tenant.id);
        const session = await createPortalSession({
            userId: record.user.id,
            tenantId: tenant.id,
            workspaceId: workspace?.id ?? null,
        });

        res.status(200).json({
            user: record.user,
            token: session.token,
            expiresAt: session.expiresAt,
            tenant: {
                id: tenant.id,
                tenantKey: tenant.tenantKey,
                tenantType: tenant.tenantType,
                accountType,
            },
        });
    }),
);

/* ── GET /public/auth/me ── */
publicRouter.get(
    '/public/auth/me',
    asyncHandler(async (req, res) => {
        const session = await getPortalSession(req);
        if (!session) {
            res.status(401).json({ error: 'not_authenticated' });
            return;
        }

        res.status(200).json({
            user: session.user,
            tenant: session.tenantId ? {
                tenantId: session.tenantId,
                tenantKey: session.tenantKey,
                tenantType: session.tenantType,
                tenantName: session.tenantName,
                accountType: session.accountType,
                workspaceId: session.workspaceId,
            } : null,
        });
    }),
);

/* ── POST /public/auth/logout ── */
publicRouter.post(
    '/public/auth/logout',
    asyncHandler(async (req, res) => {
        const visitorToken = getTenantVisitorToken(req);
        const authHeader = req.header('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7).trim();
            if (token.length > 0) {
                await deletePortalSession(token);
            }
        }

        if (visitorToken) {
            await revokeTenantVisitorSession({ sessionToken: visitorToken });
            res.setHeader(tenantVisitorTokenHeader, '');
            res.setHeader(tenantVisitorExpiresAtHeader, '');
        }

        res.status(200).json({ ok: true });
    }),
);

/* ── POST /public/boards/:boardSlug/ideas/:ideaId/subscribe ── */
publicRouter.post(
    [...publicBoardRoutePatterns.subscribe],
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board);
        if (!access.granted || !access.portalUser) {
            if (access.granted) {
                res.status(401).json({ error: 'auth_required', message: 'Sign in to follow ideas' });
            }
            return;
        }

        const ideaId = String(req.params.ideaId);
        const actorContext = await resolveBoardActorContext({
            req,
            res,
            board,
            portalSession: access.portalUser,
            visitorSession: access.visitorSession,
        });
        const result = await subscribeToIdea({
            ideaId,
            userId: access.portalUser.user.id,
            tenantId: board.tenantId,
            tenantActorId: actorContext.tenantActorId,
        });
        res.status(200).json(result);
    }),
);

/* ── DELETE /public/boards/:boardSlug/ideas/:ideaId/subscribe ── */
publicRouter.delete(
    [...publicBoardRoutePatterns.subscribe],
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board);
        if (!access.granted || !access.portalUser) {
            if (access.granted) {
                res.status(401).json({ error: 'auth_required' });
            }
            return;
        }

        const ideaId = String(req.params.ideaId);
        await unsubscribeFromIdea({ ideaId, userId: access.portalUser.user.id });
        res.status(200).json({ ok: true });
    }),
);

/* ── POST /public/boards/:boardSlug/ideas/:ideaId/favorite ── */
publicRouter.post(
    [...publicBoardRoutePatterns.favorite],
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board);
        if (!access.granted || !access.portalUser) {
            if (access.granted) {
                res.status(401).json({ error: 'auth_required', message: 'Sign in to favorite ideas' });
            }
            return;
        }

        const ideaId = String(req.params.ideaId);
        const actorContext = await resolveBoardActorContext({
            req,
            res,
            board,
            portalSession: access.portalUser,
            visitorSession: access.visitorSession,
        });
        const result = await favoriteIdea({
            ideaId,
            userId: access.portalUser.user.id,
            tenantId: board.tenantId,
            tenantActorId: actorContext.tenantActorId,
        });
        res.status(200).json(result);
    }),
);

/* ── DELETE /public/boards/:boardSlug/ideas/:ideaId/favorite ── */
publicRouter.delete(
    [...publicBoardRoutePatterns.favorite],
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board);
        if (!access.granted || !access.portalUser) {
            if (access.granted) {
                res.status(401).json({ error: 'auth_required' });
            }
            return;
        }

        const ideaId = String(req.params.ideaId);
        await unfavoriteIdea({ ideaId, userId: access.portalUser.user.id });
        res.status(200).json({ ok: true });
    }),
);

/* ── GET /public/me/profile ── */
publicRouter.get(
    '/public/me/profile',
    asyncHandler(async (req, res) => {
        const portalSession = await getPortalSession(req);
        if (!portalSession) {
            res.status(401).json({ error: 'not_authenticated' });
            return;
        }
        res.status(200).json({ user: portalSession.user, tenant: portalSession.tenantKey });
    }),
);

/* ── PATCH /public/me/profile ── */
publicRouter.patch(
    '/public/me/profile',
    asyncHandler(async (req, res) => {
        const portalSession = await getPortalSession(req);
        if (!portalSession) {
            res.status(401).json({ error: 'not_authenticated' });
            return;
        }

        const parsed = profileUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
            return;
        }

        const updated = await updatePortalUserProfile({
            userId: portalSession.user.id,
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
        const portalSession = await getPortalSession(req);
        if (!portalSession) {
            res.status(401).json({ error: 'not_authenticated' });
            return;
        }

        const ideaIds = await listUserSubscriptions({
            userId: portalSession.user.id,
            tenantId: portalSession.tenantId,
        });
        res.status(200).json({ ideaIds });
    }),
);

/* ── GET /public/me/favorites ── */
publicRouter.get(
    '/public/me/favorites',
    asyncHandler(async (req, res) => {
        const portalSession = await getPortalSession(req);
        if (!portalSession) {
            res.status(401).json({ error: 'not_authenticated' });
            return;
        }

        const ideaIds = await listUserFavorites({
            userId: portalSession.user.id,
            tenantId: portalSession.tenantId,
        });
        res.status(200).json({ ideaIds });
    }),
);

/* ── GET /public/me/ideas ── */
publicRouter.get(
    '/public/me/ideas',
    asyncHandler(async (req, res) => {
        const portalSession = await getPortalSession(req);
        if (!portalSession) {
            res.status(401).json({ error: 'not_authenticated' });
            return;
        }

        const items = await listUserIdeas({
            userId: portalSession.user.id,
            tenantId: portalSession.tenantId,
        });
        res.status(200).json({ items });
    }),
);

/* ── GET /public/me/votes ── */
publicRouter.get(
    '/public/me/votes',
    asyncHandler(async (req, res) => {
        const portalSession = await getPortalSession(req);
        if (!portalSession) {
            res.status(401).json({ error: 'not_authenticated' });
            return;
        }

        const items = await listUserVotedIdeas({
            userId: portalSession.user.id,
            tenantId: portalSession.tenantId,
        });
        res.status(200).json({ items });
    }),
);

/* ── GET /public/boards/:boardSlug/changelog ── */
publicRouter.get(
    [...publicBoardRoutePatterns.changelog],
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board);
        if (!access.granted) {
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
    [...publicBoardRoutePatterns.commentUpvote],
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board);
        if (!access.granted || !access.portalUser) {
            if (access.granted) {
                res.status(401).json({ error: 'auth_required' });
            }
            return;
        }

        const commentId = String(req.params.commentId);
        const actorContext = await resolveBoardActorContext({
            req,
            res,
            board,
            portalSession: access.portalUser,
            visitorSession: access.visitorSession,
        });
        const result = await upvoteComment({
            commentId,
            userId: access.portalUser.user.id,
            tenantId: board.tenantId,
            tenantActorId: actorContext.tenantActorId,
        });
        res.status(200).json(result);
    })
);

/* ── DELETE /public/boards/:boardSlug/ideas/:ideaId/comments/:commentId/upvote ── */
publicRouter.delete(
    [...publicBoardRoutePatterns.commentUpvote],
    asyncHandler(async (req, res) => {
        const board = await resolveBoardFromRequest(req, res);
        if (!board) {
            return;
        }

        const access = await enforceBoardAccess(req, res, board);
        if (!access.granted || !access.portalUser) {
            if (access.granted) {
                res.status(401).json({ error: 'auth_required' });
            }
            return;
        }

        const commentId = String(req.params.commentId);
        const result = await removeCommentUpvote({ commentId, userId: access.portalUser.user.id });
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
            password: z.string().min(6).max(128).optional(),
            newPassword: z.string().min(6).max(128).optional(),
        }).refine((value) => Boolean(value.password || value.newPassword), {
            message: 'password_required',
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

        const nextPassword = parsed.data.password ?? parsed.data.newPassword ?? '';
        const passwordHash = hashPassword(nextPassword);

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

        const personalTenant = await ensurePersonalTenantForPortalUser({
            portalUser: record.user,
            displayName,
        });
        await ensurePortalTenantProfile({
            tenantId: personalTenant.id,
            portalUserId: record.user.id,
            accountType: 'personal_owner',
            homeDomain: email.split('@')[1] ?? null,
        });
        const workspace = await findDefaultWorkspaceForTenant(personalTenant.id);
        const { token } = await createPortalSession({
            userId: record.user.id,
            tenantId: personalTenant.id,
            workspaceId: workspace?.id ?? null,
        });

        // Redirect back to portal with token.
        const portalUrl = process.env.VITE_APP_URL || 'http://localhost:3333/portal';
        res.redirect(`${portalUrl}/auth/callback?token=${token}`);
    })
);
