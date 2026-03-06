import { Router } from 'express';
import { z } from 'zod';
import {
    createWebhook,
    deleteWebhook,
    listWebhooks,
    updateWebhook,
} from '../db/repositories.js';
import { asyncHandler } from '../lib/async-handler.js';
import { enforceWorkspaceScope, requirePermission } from '../middleware/auth.js';

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

webhooksRouter.get(
    '/workspaces/:workspaceId/webhooks',
    requirePermission('policy:read'),
    asyncHandler(async (req, res) => {
        const workspaceId = String(req.params.workspaceId);
        const items = await listWebhooks(workspaceId);
        res.status(200).json({ items });
    }),
);

webhooksRouter.post(
    '/workspaces/:workspaceId/webhooks',
    requirePermission('policy:write'),
    asyncHandler(async (req, res) => {
        const workspaceId = String(req.params.workspaceId);
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

        res.status(201).json(webhook);
    }),
);

webhooksRouter.patch(
    '/workspaces/:workspaceId/webhooks/:webhookId',
    requirePermission('policy:write'),
    asyncHandler(async (req, res) => {
        const workspaceId = String(req.params.workspaceId);
        const webhookId = String(req.params.webhookId);

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

        res.status(200).json(webhook);
    }),
);

webhooksRouter.delete(
    '/workspaces/:workspaceId/webhooks/:webhookId',
    requirePermission('policy:write'),
    asyncHandler(async (req, res) => {
        const workspaceId = String(req.params.workspaceId);
        const webhookId = String(req.params.webhookId);

        const deleted = await deleteWebhook(webhookId, workspaceId);
        if (!deleted) {
            res.status(404).json({ error: 'webhook_not_found' });
            return;
        }

        res.status(200).json({ success: true });
    }),
);
