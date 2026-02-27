import { Router } from 'express';
import { z } from 'zod';
import { listAuditEvents } from '../db/repositories.js';
import { asyncHandler } from '../lib/async-handler.js';
import { enforceWorkspaceScope, requirePermission } from '../middleware/auth.js';

export const auditRouter = Router();

auditRouter.use(enforceWorkspaceScope);

const limitSchema = z.coerce.number().int().min(1).max(500).default(100);

auditRouter.get(
  '/workspaces/:workspaceId/audit-events',
  requirePermission('audit:read'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.params.workspaceId);
    const parsedLimit = limitSchema.safeParse(req.query.limit);
    if (!parsedLimit.success) {
      res.status(400).json({ error: 'invalid_limit' });
      return;
    }

    const items = await listAuditEvents(workspaceId, parsedLimit.data);
    res.status(200).json({ items });
  }),
);
