import { Router } from 'express';
import { z } from 'zod';
import {
  createAuditEvent,
  createSsoConnection,
  createTenantDomain,
  deleteTenantDomain,
  findDefaultWorkspaceForTenant,
  findTenantDomainById,
  listTenantDomains,
  listTenantSsoConnections,
  updateTenantDomain,
  updateTenantSsoConnection,
  verifyTenantDomainClaim,
} from '../db/repositories.js';
import { asyncHandler } from '../lib/async-handler.js';
import { assignRequestContext } from '../lib/request-context.js';
import { requirePermission, type RequestWithActor } from '../middleware/auth.js';

const providerSchema = z.enum(['okta', 'azure', 'custom_saml', 'oidc']);

const createDomainSchema = z.object({
  domain: z.string().trim().min(3).max(255),
  isPrimary: z.boolean().optional(),
  domainKind: z.enum(['enterprise', 'public_email_provider', 'alias']).optional(),
});

const updateDomainSchema = z
  .object({
    domain: z.string().trim().min(3).max(255).optional(),
    isPrimary: z.boolean().optional(),
    domainKind: z.enum(['enterprise', 'public_email_provider', 'alias']).optional(),
    verificationStatus: z.enum(['pending', 'verified', 'failed', 'blocked']).optional(),
    verificationMethod: z.enum(['dns_txt', 'email', 'manual', 'system']).optional(),
    active: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'at least one field is required',
  });

const createTenantSsoSchema = z.object({
  provider: providerSchema,
  domain: z.string().trim().min(3).max(255),
  clientId: z.string().trim().min(1).max(255).nullable().optional(),
  clientSecret: z.string().trim().min(1).max(500).nullable().optional(),
  metadataUrl: z.string().url().nullable().optional(),
  active: z.boolean().optional(),
});

const updateTenantSsoSchema = z
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

const verifyDomainSchema = z.object({
  proofToken: z.string().trim().min(1),
});

function enforceTenantScope(req: RequestWithActor, tenantId: string): boolean {
  return Boolean(req.actor && req.actor.tenantId === tenantId);
}

function serializeTenantDomain(domain: Awaited<ReturnType<typeof createTenantDomain>>): Record<string, unknown> {
  return {
    ...domain,
    verification: {
      method: domain.verificationMethod,
      status: domain.verificationStatus,
      txtName: '_customervoice-challenge',
      txtValue: domain.verificationToken ? `customervoice-verification=${domain.verificationToken}` : null,
      proofToken: domain.verificationToken,
    },
  };
}

export const tenantsRouter = Router();

tenantsRouter.get(
  '/tenants/:tenantId/domains',
  requirePermission('policy:read'),
  asyncHandler(async (req, res) => {
    const tenantId = String(req.params.tenantId);
    const request = req as RequestWithActor;
    assignRequestContext({ tenantId, workspaceId: request.actor?.workspaceId ?? null });

    if (!enforceTenantScope(request, tenantId)) {
      res.status(403).json({ error: 'tenant_scope_violation' });
      return;
    }

    const items = await listTenantDomains(tenantId);
    res.status(200).json({ items: items.map(serializeTenantDomain) });
  }),
);

tenantsRouter.post(
  '/tenants/:tenantId/domains',
  requirePermission('policy:write'),
  asyncHandler(async (req, res) => {
    const tenantId = String(req.params.tenantId);
    const request = req as RequestWithActor;
    assignRequestContext({ tenantId, workspaceId: request.actor?.workspaceId ?? null });

    if (!enforceTenantScope(request, tenantId)) {
      res.status(403).json({ error: 'tenant_scope_violation' });
      return;
    }

    const parsed = createDomainSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const created = await createTenantDomain({
      tenantId,
      domain: parsed.data.domain,
      isPrimary: parsed.data.isPrimary,
      domainKind: parsed.data.domainKind,
      verificationMethod: 'dns_txt',
      verificationStatus: 'pending',
    });

    if (request.actor) {
      await createAuditEvent({
        workspaceId: request.actor.workspaceId,
        actorId: request.actor.userId,
        action: 'tenant.domain.claim',
        metadata: {
          tenantId,
          domainId: created.id,
          domain: created.domain,
          verificationStatus: created.verificationStatus,
        },
      });
    }

    res.status(201).json(serializeTenantDomain(created));
  }),
);

tenantsRouter.post(
  '/tenants/:tenantId/domains/:domainId/verify',
  requirePermission('policy:write'),
  asyncHandler(async (req, res) => {
    const tenantId = String(req.params.tenantId);
    const domainId = String(req.params.domainId);
    const request = req as RequestWithActor;
    assignRequestContext({ tenantId, workspaceId: request.actor?.workspaceId ?? null });

    if (!enforceTenantScope(request, tenantId)) {
      res.status(403).json({ error: 'tenant_scope_violation' });
      return;
    }

    const parsed = verifyDomainSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const existing = await findTenantDomainById({ tenantId, domainId });
    if (!existing) {
      res.status(404).json({ error: 'tenant_domain_not_found' });
      return;
    }

    const updated = await verifyTenantDomainClaim({
      tenantId,
      domainId,
      proofToken: parsed.data.proofToken,
      verificationMethod: 'dns_txt',
    });

    if (!updated) {
      res.status(400).json({ error: 'invalid_verification_token' });
      return;
    }

    if (request.actor) {
      await createAuditEvent({
        workspaceId: request.actor.workspaceId,
        actorId: request.actor.userId,
        action: 'tenant.domain.verify',
        metadata: {
          tenantId,
          domainId: updated.id,
          domain: updated.domain,
          verificationStatus: updated.verificationStatus,
        },
      });
    }

    res.status(200).json(serializeTenantDomain(updated));
  }),
);

tenantsRouter.patch(
  '/tenants/:tenantId/domains/:domainId',
  requirePermission('policy:write'),
  asyncHandler(async (req, res) => {
    const tenantId = String(req.params.tenantId);
    const domainId = String(req.params.domainId);
    const request = req as RequestWithActor;
    assignRequestContext({ tenantId, workspaceId: request.actor?.workspaceId ?? null });

    if (!enforceTenantScope(request, tenantId)) {
      res.status(403).json({ error: 'tenant_scope_violation' });
      return;
    }

    const parsed = updateDomainSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const updated = await updateTenantDomain({
      tenantId,
      domainId,
      ...parsed.data,
    });

    if (!updated) {
      res.status(404).json({ error: 'tenant_domain_not_found' });
      return;
    }

    if (request.actor) {
      await createAuditEvent({
        workspaceId: request.actor.workspaceId,
        actorId: request.actor.userId,
        action: 'tenant.domain.update',
        metadata: {
          tenantId,
          domainId: updated.id,
          domain: updated.domain,
          verificationStatus: updated.verificationStatus,
        },
      });
    }

    res.status(200).json(serializeTenantDomain(updated));
  }),
);

tenantsRouter.delete(
  '/tenants/:tenantId/domains/:domainId',
  requirePermission('policy:write'),
  asyncHandler(async (req, res) => {
    const tenantId = String(req.params.tenantId);
    const domainId = String(req.params.domainId);
    const request = req as RequestWithActor;
    assignRequestContext({ tenantId, workspaceId: request.actor?.workspaceId ?? null });

    if (!enforceTenantScope(request, tenantId)) {
      res.status(403).json({ error: 'tenant_scope_violation' });
      return;
    }

    const deleted = await deleteTenantDomain({ tenantId, domainId });
    if (!deleted) {
      res.status(404).json({ error: 'tenant_domain_not_found' });
      return;
    }

    if (request.actor) {
      await createAuditEvent({
        workspaceId: request.actor.workspaceId,
        actorId: request.actor.userId,
        action: 'tenant.domain.delete',
        metadata: {
          tenantId,
          domainId,
        },
      });
    }

    res.status(200).json({ ok: true });
  }),
);

tenantsRouter.get(
  '/tenants/:tenantId/sso-connections',
  requirePermission('policy:read'),
  asyncHandler(async (req, res) => {
    const tenantId = String(req.params.tenantId);
    const request = req as RequestWithActor;
    assignRequestContext({ tenantId, workspaceId: request.actor?.workspaceId ?? null });

    if (!enforceTenantScope(request, tenantId)) {
      res.status(403).json({ error: 'tenant_scope_violation' });
      return;
    }

    const items = await listTenantSsoConnections(tenantId);
    res.status(200).json({ items });
  }),
);

tenantsRouter.post(
  '/tenants/:tenantId/sso-connections',
  requirePermission('policy:write'),
  asyncHandler(async (req, res) => {
    const tenantId = String(req.params.tenantId);
    const request = req as RequestWithActor;
    assignRequestContext({ tenantId, workspaceId: request.actor?.workspaceId ?? null });

    if (!enforceTenantScope(request, tenantId)) {
      res.status(403).json({ error: 'tenant_scope_violation' });
      return;
    }

    const parsed = createTenantSsoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const workspace = await findDefaultWorkspaceForTenant(tenantId);
    if (!workspace) {
      res.status(404).json({ error: 'tenant_workspace_not_found' });
      return;
    }

    const created = await createSsoConnection({
      workspaceId: workspace.id,
      tenantId,
      provider: parsed.data.provider,
      domain: parsed.data.domain,
      clientId: parsed.data.clientId,
      clientSecret: parsed.data.clientSecret,
      metadataUrl: parsed.data.metadataUrl,
      active: parsed.data.active,
    });

    if (request.actor) {
      await createAuditEvent({
        workspaceId: request.actor.workspaceId,
        actorId: request.actor.userId,
        action: 'tenant.sso_connection.create',
        metadata: {
          tenantId,
          connectionId: created.id,
          domain: created.domain,
          provider: created.provider,
        },
      });
    }

    res.status(201).json(created);
  }),
);

tenantsRouter.patch(
  '/tenants/:tenantId/sso-connections/:connectionId',
  requirePermission('policy:write'),
  asyncHandler(async (req, res) => {
    const tenantId = String(req.params.tenantId);
    const connectionId = String(req.params.connectionId);
    const request = req as RequestWithActor;
    assignRequestContext({ tenantId, workspaceId: request.actor?.workspaceId ?? null });

    if (!enforceTenantScope(request, tenantId)) {
      res.status(403).json({ error: 'tenant_scope_violation' });
      return;
    }

    const parsed = updateTenantSsoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const updated = await updateTenantSsoConnection(connectionId, tenantId, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'sso_connection_not_found' });
      return;
    }

    if (request.actor) {
      await createAuditEvent({
        workspaceId: request.actor.workspaceId,
        actorId: request.actor.userId,
        action: 'tenant.sso_connection.update',
        metadata: {
          tenantId,
          connectionId: updated.id,
          domain: updated.domain,
          provider: updated.provider,
          active: updated.active,
        },
      });
    }

    res.status(200).json(updated);
  }),
);
