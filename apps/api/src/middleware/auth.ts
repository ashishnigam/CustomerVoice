import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import {
  ensureUser,
  findActiveTenantImpersonationSessionByToken,
  findGlobalOperatorAssignment,
  findWorkspaceContext,
  findWorkspaceMembershipContext,
} from '../db/repositories.js';
import { assignRequestContext } from '../lib/request-context.js';
import { can } from '../lib/rbac.js';
import { permissionSchema, roleSchema, type Permission, type Role } from '../lib/types.js';

type GlobalOperatorRole = 'support_admin' | 'global_admin';

export interface RequestActor {
  userId: string;
  tenantId: string;
  workspaceId: string;
  role: Role;
  email: string;
  operatorUserId?: string | null;
  operatorEmail?: string | null;
  globalRole?: GlobalOperatorRole | null;
  impersonationSessionId?: string | null;
}

export interface GlobalOperatorIdentity {
  userId: string;
  email: string;
  globalRole: GlobalOperatorRole;
}

export interface RequestWithActor extends Request {
  actor?: RequestActor;
  operator?: GlobalOperatorIdentity;
}

const authMode = process.env.AUTH_MODE ?? 'supabase';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseIssuer = process.env.SUPABASE_ISSUER ?? (supabaseUrl ? `${supabaseUrl}/auth/v1` : null);
const supabaseAudience = process.env.SUPABASE_JWT_AUDIENCE;
const supabaseJwksUrl =
  process.env.SUPABASE_JWKS_URL ??
  (supabaseUrl ? `${supabaseUrl}/auth/v1/.well-known/jwks.json` : null);

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getDisplayName(payload: JWTPayload): string | undefined {
  const metadata = payload.user_metadata;
  if (!metadata || typeof metadata !== 'object' || !('full_name' in metadata)) {
    return undefined;
  }

  const metadataRecord = metadata as Record<string, unknown>;
  const fullName = metadataRecord.full_name;
  return typeof fullName === 'string' && fullName.trim().length > 0 ? fullName : undefined;
}

function getWorkspaceContext(req: Request): string | null {
  const workspaceHeader = req.header('x-workspace-id');
  if (workspaceHeader && workspaceHeader.length > 0) {
    return workspaceHeader;
  }

  return getRouteWorkspaceContext(req);
}

function getRouteWorkspaceContext(req: Request): string | null {
  if (typeof req.params.workspaceId === 'string' && req.params.workspaceId.length > 0) {
    return req.params.workspaceId;
  }

  const pathMatch = req.path.match(/\/workspaces\/([^/]+)/);
  return pathMatch?.[1] ?? null;
}

function getBearerToken(req: Request): string | null {
  const header = req.header('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
}

function getImpersonationToken(req: Request): string | null {
  const token = req.header('x-impersonation-token');
  return token && token.trim().length > 0 ? token.trim() : null;
}

function parseGlobalRole(value: string | null | undefined): GlobalOperatorRole | null {
  if (value === 'support_admin' || value === 'global_admin') {
    return value;
  }

  return null;
}

function getGlobalRoleFromPayload(payload: JWTPayload): GlobalOperatorRole | null {
  const direct = parseGlobalRole(typeof payload.global_role === 'string' ? payload.global_role : null);
  if (direct) {
    return direct;
  }

  const appMetadata = payload.app_metadata;
  if (appMetadata && typeof appMetadata === 'object' && 'global_role' in appMetadata) {
    return parseGlobalRole(String((appMetadata as Record<string, unknown>).global_role ?? ''));
  }

  return null;
}

function getJwks() {
  if (!supabaseJwksUrl) {
    throw new Error('SUPABASE_JWKS_URL or SUPABASE_URL must be set for supabase auth mode');
  }

  if (!cachedJwks) {
    cachedJwks = createRemoteJWKSet(new URL(supabaseJwksUrl));
  }

  return cachedJwks;
}

async function verifySupabaseToken(token: string): Promise<JWTPayload> {
  const options: { issuer?: string; audience?: string } = {};
  if (supabaseIssuer) options.issuer = supabaseIssuer;
  if (supabaseAudience) options.audience = supabaseAudience;

  const { payload } = await jwtVerify(token, getJwks(), options);
  return payload;
}

function assignActor(req: Request, actor: RequestActor): void {
  const request = req as RequestWithActor;
  request.actor = actor;
  assignRequestContext({
    tenantId: actor.tenantId,
    workspaceId: actor.workspaceId,
    userId: actor.userId,
    userEmail: actor.email,
    operatorUserId: actor.operatorUserId ?? null,
    operatorEmail: actor.operatorEmail ?? null,
    globalRole: actor.globalRole ?? null,
    impersonationSessionId: actor.impersonationSessionId ?? null,
  });
}

function assignOperator(req: Request, operator: GlobalOperatorIdentity): void {
  const request = req as RequestWithActor;
  request.operator = operator;
  assignRequestContext({
    userId: operator.userId,
    userEmail: operator.email,
    operatorUserId: operator.userId,
    operatorEmail: operator.email,
    globalRole: operator.globalRole,
  });
}

async function hydrateImpersonatedActor(req: Request): Promise<RequestActor | null> {
  const sessionToken = getImpersonationToken(req);
  if (!sessionToken) {
    return null;
  }

  const session = await findActiveTenantImpersonationSessionByToken(sessionToken);
  if (!session) {
    return null;
  }

  const assignment = await findGlobalOperatorAssignment({ userId: session.operatorUserId });
  if (!assignment) {
    return null;
  }

  return {
    userId: session.operatorUserId,
    tenantId: session.tenantId,
    workspaceId: session.workspaceId,
    role: session.assumedRole,
    email: session.operatorEmail,
    operatorUserId: session.operatorUserId,
    operatorEmail: session.operatorEmail,
    globalRole: assignment.globalRole,
    impersonationSessionId: session.id,
  };
}

async function requireActorSupabase(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const impersonatedActor = await hydrateImpersonatedActor(req);
  if (getImpersonationToken(req) && !impersonatedActor) {
    res.status(401).json({ error: 'invalid_impersonation_session' });
    return;
  }
  if (impersonatedActor) {
    assignActor(req, impersonatedActor);
    next();
    return;
  }

  const workspaceId = getWorkspaceContext(req);
  if (!workspaceId) {
    res.status(400).json({ error: 'workspace_context_required' });
    return;
  }

  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'bearer_token_required' });
    return;
  }

  try {
    const payload = await verifySupabaseToken(token);
    const userId = typeof payload.sub === 'string' ? payload.sub : null;
    const email =
      typeof payload.email === 'string' ? payload.email : typeof payload.sub === 'string' ? `${payload.sub}@users.local` : null;

    if (!userId || !email) {
      res.status(401).json({ error: 'invalid_token_claims' });
      return;
    }

    await ensureUser({
      userId,
      email,
      displayName: getDisplayName(payload),
    });

    const membership = await findWorkspaceMembershipContext(workspaceId, userId);
    if (!membership || !membership.active) {
      res.status(403).json({ error: 'membership_required', workspaceId });
      return;
    }

    assignActor(req, {
      userId,
      tenantId: membership.tenantId,
      workspaceId,
      role: membership.role,
      email,
    });

    next();
  } catch {
    res.status(401).json({ error: 'invalid_access_token' });
  }
}

async function requireActorMock(req: Request, res: Response, next: NextFunction): Promise<void> {
  const impersonatedActor = await hydrateImpersonatedActor(req);
  if (getImpersonationToken(req) && !impersonatedActor) {
    res.status(401).json({ error: 'invalid_impersonation_session' });
    return;
  }
  if (impersonatedActor) {
    assignActor(req, impersonatedActor);
    next();
    return;
  }

  const userId = req.header('x-user-id');
  const workspaceId = getWorkspaceContext(req);
  const routeWorkspaceId = getRouteWorkspaceContext(req);
  const role = req.header('x-role');
  const email = req.header('x-user-email') ?? 'mock-user@customervoice.local';

  if (!userId || !workspaceId || !role) {
    res.status(401).json({ error: 'missing_mock_actor_headers' });
    return;
  }

  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) {
    res.status(401).json({ error: 'invalid_mock_role' });
    return;
  }

  const routeWorkspace = routeWorkspaceId ? await findWorkspaceContext(routeWorkspaceId) : null;
  const headerWorkspace = workspaceId ? await findWorkspaceContext(workspaceId) : null;
  const workspace = routeWorkspace && routeWorkspace.active ? routeWorkspace : headerWorkspace;
  if (!workspace || !workspace.active) {
    res.status(404).json({ error: 'workspace_not_found' });
    return;
  }

  assignActor(req, {
    userId,
    tenantId: workspace.tenantId,
    workspaceId,
    role: parsed.data,
    email,
  });

  next();
}

async function requireGlobalOperatorSupabase(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'bearer_token_required' });
    return;
  }

  try {
    const payload = await verifySupabaseToken(token);
    const userId = typeof payload.sub === 'string' ? payload.sub : null;
    const email =
      typeof payload.email === 'string' ? payload.email : typeof payload.sub === 'string' ? `${payload.sub}@users.local` : null;
    const globalRole = parseGlobalRole(req.header('x-global-role')) ?? getGlobalRoleFromPayload(payload);

    if (!userId || !email || !globalRole) {
      res.status(403).json({ error: 'global_operator_required' });
      return;
    }

    const assignment = await findGlobalOperatorAssignment({ userId, globalRole });
    if (!assignment || !assignment.active) {
      res.status(403).json({ error: 'global_operator_required' });
      return;
    }

    assignOperator(req, {
      userId,
      email,
      globalRole: assignment.globalRole,
    });

    next();
  } catch {
    res.status(401).json({ error: 'invalid_access_token' });
  }
}

async function requireGlobalOperatorMock(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.header('x-user-id');
  const email = req.header('x-user-email') ?? 'mock-operator@customervoice.local';
  const requestedRole = parseGlobalRole(req.header('x-global-role'));

  if (!userId) {
    res.status(401).json({ error: 'missing_mock_actor_headers' });
    return;
  }

  const assignment = await findGlobalOperatorAssignment({
    userId,
    globalRole: requestedRole,
  });

  if (!assignment || !assignment.active) {
    res.status(403).json({ error: 'global_operator_required' });
    return;
  }

  assignOperator(req, {
    userId,
    email,
    globalRole: assignment.globalRole,
  });

  next();
}

export function requireActor(req: Request, res: Response, next: NextFunction): void {
  if (authMode === 'mock') {
    requireActorMock(req, res, next).catch(next);
    return;
  }

  requireActorSupabase(req, res, next).catch(next);
}

export function requireGlobalOperator(req: Request, res: Response, next: NextFunction): void {
  if (authMode === 'mock') {
    requireGlobalOperatorMock(req, res, next).catch(next);
    return;
  }

  requireGlobalOperatorSupabase(req, res, next).catch(next);
}

export function requirePermission(permission: Permission) {
  const permissionCheck = permissionSchema.safeParse(permission);
  if (!permissionCheck.success) {
    throw new Error(`invalid permission declaration: ${permission}`);
  }

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const request = req as RequestWithActor;
    if (!request.actor) {
      res.status(401).json({ error: 'actor_required' });
      return;
    }

    let allowed = false;
    try {
      allowed = await can({
        workspaceId: request.actor.workspaceId,
        role: request.actor.role,
        permission,
      });
    } catch (error) {
      next(error);
      return;
    }

    if (!allowed) {
      res.status(403).json({ error: 'forbidden', permission, role: request.actor.role });
      return;
    }

    next();
  };
}

export function enforceWorkspaceScope(req: Request, res: Response, next: NextFunction): void {
  const request = req as RequestWithActor;
  if (!request.actor) {
    res.status(401).json({ error: 'actor_required' });
    return;
  }

  let workspaceId: string | null = null;
  if (typeof req.params.workspaceId === 'string') {
    workspaceId = req.params.workspaceId;
  } else {
    const pathMatch = req.path.match(/\/workspaces\/([^/]+)/);
    workspaceId = pathMatch?.[1] ?? null;
  }

  if (workspaceId && workspaceId !== request.actor.workspaceId) {
    res.status(403).json({ error: 'workspace_scope_violation' });
    return;
  }

  next();
}
