import { Router } from 'express';
import { z } from 'zod';
import { emitAudit } from '../lib/audit.js';
import { asyncHandler } from '../lib/async-handler.js';
import {
  deactivateWorkspaceMember,
  inviteWorkspaceMember,
  listWorkspaceMemberships,
  updateWorkspaceMemberRole,
  workspaceExists,
} from '../db/repositories.js';
import { enforceWorkspaceScope, requirePermission } from '../middleware/auth.js';
import { roleSchema as roleValueSchema } from '../lib/types.js';
import type { RequestWithActor } from '../middleware/auth.js';

const inviteSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  role: roleValueSchema,
});

const roleUpdateSchema = z.object({
  role: roleValueSchema,
});

export const membersRouter = Router();

membersRouter.use(enforceWorkspaceScope);

membersRouter.get(
  '/workspaces/:workspaceId/members',
  requirePermission('membership:read'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.params.workspaceId);
    if (!(await workspaceExists(workspaceId))) {
      res.status(404).json({ error: 'workspace_not_found' });
      return;
    }

    const memberships = await listWorkspaceMemberships(workspaceId);
    res.status(200).json({ items: memberships });
  }),
);

membersRouter.post(
  '/workspaces/:workspaceId/members/invite',
  requirePermission('membership:write'),
  asyncHandler(async (req, res) => {
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const workspaceId = String(req.params.workspaceId);
    if (!(await workspaceExists(workspaceId))) {
      res.status(404).json({ error: 'workspace_not_found' });
      return;
    }

    const actor = (req as RequestWithActor).actor;
    if (!actor) {
      res.status(401).json({ error: 'actor_required' });
      return;
    }

    const created = await inviteWorkspaceMember({
      workspaceId,
      userId: parsed.data.userId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedBy: actor.userId,
    });

    await emitAudit(req, 'membership.invite', {
      targetUserId: parsed.data.userId,
      role: parsed.data.role,
    });

    res.status(201).json(created);
  }),
);

membersRouter.patch(
  '/workspaces/:workspaceId/members/:userId/role',
  requirePermission('membership:write'),
  asyncHandler(async (req, res) => {
    const parsed = roleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const workspaceId = String(req.params.workspaceId);
    const userId = String(req.params.userId);
    const updated = await updateWorkspaceMemberRole({
      workspaceId,
      userId,
      role: parsed.data.role,
    });

    if (!updated) {
      res.status(404).json({ error: 'member_not_found' });
      return;
    }

    await emitAudit(req, 'membership.role_update', {
      targetUserId: userId,
      role: parsed.data.role,
    });

    res.status(200).json(updated);
  }),
);

membersRouter.delete(
  '/workspaces/:workspaceId/members/:userId',
  requirePermission('membership:write'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.params.workspaceId);
    const userId = String(req.params.userId);
    const updated = await deactivateWorkspaceMember({
      workspaceId,
      userId,
    });

    if (!updated) {
      res.status(404).json({ error: 'member_not_found' });
      return;
    }

    await emitAudit(req, 'membership.deactivate', {
      targetUserId: userId,
    });

    res.status(200).json(updated);
  }),
);
