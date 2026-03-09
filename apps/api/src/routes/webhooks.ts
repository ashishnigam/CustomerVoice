import { Router } from 'express';
import { z } from 'zod';
import {
    createAuditEvent,
    createWebhook,
    deleteWebhook,
    listWebhooks,
    updateWebhook,
    syncPortalUserMrr,
} from '../db/repositories.js';
import { asyncHandler } from '../lib/async-handler.js';
import { assignRequestContext } from '../lib/request-context.js';
import { consumeFixedWindowRateLimit } from '../lib/rate-limit.js';
import { enforceWorkspaceScope, requirePermission, type RequestWithActor } from '../middleware/auth.js';

export const webhooksRouter = Router();

webhooksRouter.use(enforceWorkspaceScope);

const createWebhookSchema = z.object({
    url: z.string().url(),
    events: z.array(z.string()).min(1),
    secret: z.string().min(16),
    active: z.boolean().optional(),
});

const updateWebhookSchema = z.object({
    url: z.string().url().optional(),
    events: z.array(z.string()).min(1).optional(),
    secret: z.string().min(16).optional(),
    active: z.boolean().optional(),
});

function enforceWebhookRateLimit(req: RequestWithActor, res: { status: (code: number) => { json: (body: unknown) => void } }): boolean {
    const tenantId = req.actor?.tenantId;
    if (!tenantId) {
        return true;
    }

    const result = consumeFixedWindowRateLimit({
        bucket: `webhooks:${tenantId}`,
        limit: Number(process.env.TENANT_WEBHOOK_RATE_LIMIT ?? 90),
        windowMs: 60_000,
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

webhooksRouter.get(
    '/workspaces/:workspaceId/webhooks',
    requirePermission('policy:read'),
    asyncHandler(async (req, res) => {
        const request = req as RequestWithActor;
        const workspaceId = String(req.params.workspaceId);
        assignRequestContext({
            tenantId: request.actor?.tenantId ?? null,
            workspaceId,
        });
        if (!enforceWebhookRateLimit(request, res)) {
            return;
        }
        const items = await listWebhooks(workspaceId);
        res.status(200).json({ items });
    }),
);

webhooksRouter.post(
    '/workspaces/:workspaceId/webhooks',
    requirePermission('policy:write'),
    asyncHandler(async (req, res) => {
        const request = req as RequestWithActor;
        const workspaceId = String(req.params.workspaceId);
        assignRequestContext({
            tenantId: request.actor?.tenantId ?? null,
            workspaceId,
        });
        if (!enforceWebhookRateLimit(request, res)) {
            return;
        }
        const parsed = createWebhookSchema.safeParse(req.body);

        if (!parsed.success) {
            res.status(400).json({ error: 'invalid_data', details: parsed.error.issues });
            return;
        }

        const webhook = await createWebhook({
            workspaceId,
            url: parsed.data.url,
            events: parsed.data.events,
            secret: parsed.data.secret,
            active: parsed.data.active,
        });

        if (request.actor) {
            await createAuditEvent({
                workspaceId,
                actorId: request.actor.userId,
                action: 'webhook.create',
                metadata: {
                    webhookId: webhook.id,
                    tenantId: request.actor.tenantId,
                    events: webhook.events,
                    active: webhook.active,
                },
            });
        }

        res.status(201).json(webhook);
    }),
);

webhooksRouter.patch(
    '/workspaces/:workspaceId/webhooks/:webhookId',
    requirePermission('policy:write'),
    asyncHandler(async (req, res) => {
        const request = req as RequestWithActor;
        const workspaceId = String(req.params.workspaceId);
        const webhookId = String(req.params.webhookId);
        assignRequestContext({
            tenantId: request.actor?.tenantId ?? null,
            workspaceId,
        });
        if (!enforceWebhookRateLimit(request, res)) {
            return;
        }

        const parsed = updateWebhookSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'invalid_data', details: parsed.error.issues });
            return;
        }

        const webhook = await updateWebhook(webhookId, workspaceId, parsed.data);
        if (!webhook) {
            res.status(404).json({ error: 'webhook_not_found' });
            return;
        }

        if (request.actor) {
            await createAuditEvent({
                workspaceId,
                actorId: request.actor.userId,
                action: 'webhook.update',
                metadata: {
                    webhookId: webhook.id,
                    tenantId: request.actor.tenantId,
                    events: webhook.events,
                    active: webhook.active,
                },
            });
        }

        res.status(200).json(webhook);
    }),
);

webhooksRouter.delete(
    '/workspaces/:workspaceId/webhooks/:webhookId',
    requirePermission('policy:write'),
    asyncHandler(async (req, res) => {
        const request = req as RequestWithActor;
        const workspaceId = String(req.params.workspaceId);
        const webhookId = String(req.params.webhookId);
        assignRequestContext({
            tenantId: request.actor?.tenantId ?? null,
            workspaceId,
        });
        if (!enforceWebhookRateLimit(request, res)) {
            return;
        }

        const deleted = await deleteWebhook(webhookId, workspaceId);
        if (!deleted) {
            res.status(404).json({ error: 'webhook_not_found' });
            return;
        }

        if (request.actor) {
            await createAuditEvent({
                workspaceId,
                actorId: request.actor.userId,
                action: 'webhook.delete',
                metadata: {
                    webhookId,
                    tenantId: request.actor.tenantId,
                },
            });
        }

        res.status(200).json({ success: true });
    }),
);

const syncMrrSchema = z.object({
    email: z.string().email(),
    mrr: z.number().min(0),
});

webhooksRouter.post(
    '/workspaces/:workspaceId/users/mrr',
    requirePermission('policy:write'),
    asyncHandler(async (req, res) => {
        const request = req as RequestWithActor;
        const workspaceId = String(req.params.workspaceId);
        assignRequestContext({
            tenantId: request.actor?.tenantId ?? null,
            workspaceId,
        });
        if (!enforceWebhookRateLimit(request, res)) {
            return;
        }
        const parsed = syncMrrSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'invalid_data', details: parsed.error.issues });
            return;
        }

        await syncPortalUserMrr(parsed.data.email, parsed.data.mrr);
        if (request.actor) {
            await createAuditEvent({
                workspaceId,
                actorId: request.actor.userId,
                action: 'webhook.mrr.sync',
                metadata: {
                    tenantId: request.actor.tenantId,
                    email: parsed.data.email,
                    mrr: parsed.data.mrr,
                },
            });
        }
        res.status(200).json({ success: true });
    }),
);
