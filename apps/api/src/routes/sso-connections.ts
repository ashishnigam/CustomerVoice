import { Router } from 'express';
import { z } from 'zod';
import {
  createSsoConnection,
  listSsoConnections,
  updateSsoConnection,
} from '../db/repositories.js';
import { asyncHandler } from '../lib/async-handler.js';
import { enforceWorkspaceScope, requirePermission } from '../middleware/auth.js';

const providerSchema = z.enum(['okta', 'azure', 'custom_saml', 'oidc']);

const createSchema = z.object({
  provider: providerSchema,
  domain: z.string().trim().min(3).max(255),
  clientId: z.string().trim().min(1).max(255).nullable().optional(),
  clientSecret: z.string().trim().min(1).max(500).nullable().optional(),
  metadataUrl: z.string().url().nullable().optional(),
  active: z.boolean().optional(),
});

const updateSchema = z
  .object({
    provider: providerSchema.optional(),
    domain: z.string().trim().min(3).max(255).optional(),
    clientId: z.string().trim().min(1).max(255).nullable().optional(),
    clientSecret: z.string().trim().min(1).max(500).nullable().optional(),
    metadataUrl: z.string().url().nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'at least one field is required',
  });

export const ssoConnectionsRouter = Router();

ssoConnectionsRouter.use(enforceWorkspaceScope);

ssoConnectionsRouter.get(
  '/workspaces/:workspaceId/sso-connections',
  requirePermission('policy:read'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.params.workspaceId);
    const items = await listSsoConnections(workspaceId);
    res.status(200).json({ items });
  }),
);

ssoConnectionsRouter.post(
  '/workspaces/:workspaceId/sso-connections',
  requirePermission('policy:write'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.params.workspaceId);
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const created = await createSsoConnection({
      workspaceId,
      provider: parsed.data.provider,
      domain: parsed.data.domain,
      clientId: parsed.data.clientId,
      clientSecret: parsed.data.clientSecret,
      metadataUrl: parsed.data.metadataUrl,
      active: parsed.data.active,
    });
    res.status(201).json(created);
  }),
);

ssoConnectionsRouter.patch(
  '/workspaces/:workspaceId/sso-connections/:connectionId',
  requirePermission('policy:write'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.params.workspaceId);
    const connectionId = String(req.params.connectionId);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const updated = await updateSsoConnection(connectionId, workspaceId, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'sso_connection_not_found' });
      return;
    }
    res.status(200).json(updated);
  }),
);
