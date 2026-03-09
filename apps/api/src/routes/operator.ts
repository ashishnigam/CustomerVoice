import { Router } from 'express';
import { z } from 'zod';
import {
  createAuditEvent,
  createTenantImpersonationSession,
  findActiveTenantImpersonationSessionByToken,
  findDefaultWorkspaceForTenant,
  findTenantById,
  findWorkspaceContext,
  revokeTenantImpersonationSession,
} from '../db/repositories.js';
import { asyncHandler } from '../lib/async-handler.js';
import { type RequestWithActor } from '../middleware/auth.js';
import { roleSchema } from '../lib/types.js';

const impersonateSchema = z.object({
  workspaceId: z.string().trim().min(1).optional(),
  assumedRole: roleSchema.optional(),
  expiresInMinutes: z.coerce.number().int().min(5).max(12 * 60).optional(),
});

const revokeSchema = z.object({
  sessionToken: z.string().trim().min(10),
});

export const operatorRouter = Router();

operatorRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const request = req as RequestWithActor;
    if (!request.operator) {
      res.status(401).json({ error: 'global_operator_required' });
      return;
    }

    res.status(200).json({
      operator: request.operator,
    });
  }),
);

operatorRouter.post(
  '/tenants/:tenantId/impersonate',
  asyncHandler(async (req, res) => {
    const request = req as RequestWithActor;
    if (!request.operator) {
      res.status(401).json({ error: 'global_operator_required' });
      return;
    }

    const parsed = impersonateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const tenantId = String(req.params.tenantId);
    const tenant = await findTenantById(tenantId);
    if (!tenant) {
      res.status(404).json({ error: 'tenant_not_found' });
      return;
    }

    const workspace = parsed.data.workspaceId
      ? await findWorkspaceContext(parsed.data.workspaceId)
      : await findDefaultWorkspaceForTenant(tenantId);
    if (!workspace) {
      res.status(404).json({ error: 'tenant_workspace_not_found' });
      return;
    }
    if (workspace.tenantId !== tenantId) {
      res.status(403).json({ error: 'workspace_scope_violation' });
      return;
    }

    const session = await createTenantImpersonationSession({
      operatorUserId: request.operator.userId,
      operatorEmail: request.operator.email,
      tenantId,
      workspaceId: workspace.id,
      assumedRole: parsed.data.assumedRole ?? 'tenant_admin',
      expiresInMinutes: parsed.data.expiresInMinutes,
    });

    await createAuditEvent({
      workspaceId: workspace.id,
      actorId: request.operator.userId,
      action: 'operator.impersonation.start',
      metadata: {
        tenantId,
        tenantKey: tenant.tenantKey,
        globalRole: request.operator.globalRole,
        operatorUserId: request.operator.userId,
        operatorEmail: request.operator.email,
        impersonationSessionId: session.id,
        assumedRole: session.assumedRole,
      },
    });

    res.status(201).json({
      tenant: {
        id: tenant.id,
        tenantKey: tenant.tenantKey,
        name: tenant.name,
      },
      workspace,
      impersonation: {
        id: session.id,
        sessionToken: session.sessionToken,
        expiresAt: session.expiresAt,
        assumedRole: session.assumedRole,
      },
    });
  }),
);

operatorRouter.post(
  '/impersonations/revoke',
  asyncHandler(async (req, res) => {
    const request = req as RequestWithActor;
    if (!request.operator) {
      res.status(401).json({ error: 'global_operator_required' });
      return;
    }

    const parsed = revokeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const activeSession = await findActiveTenantImpersonationSessionByToken(parsed.data.sessionToken);
    const revoked = await revokeTenantImpersonationSession({
      sessionToken: parsed.data.sessionToken,
      operatorUserId: request.operator.userId,
    });

    if (!revoked) {
      res.status(404).json({ error: 'impersonation_session_not_found' });
      return;
    }

    if (activeSession) {
      await createAuditEvent({
        workspaceId: activeSession.workspaceId,
        actorId: request.operator.userId,
        action: 'operator.impersonation.end',
        metadata: {
          tenantId: activeSession.tenantId,
          globalRole: request.operator.globalRole,
          operatorUserId: request.operator.userId,
          operatorEmail: request.operator.email,
          impersonationSessionId: activeSession.id,
        },
      });
    }

    res.status(200).json({ ok: true });
  }),
);
