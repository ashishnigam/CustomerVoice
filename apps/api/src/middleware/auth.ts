import type { NextFunction, Request, Response } from 'express';
import { can } from '../lib/rbac.js';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { ensureUser, findWorkspaceMembership } from '../db/repositories.js';
import { permissionSchema, roleSchema, type Permission, type Role } from '../lib/types.js';

export interface RequestActor {
  userId: string;
  workspaceId: string;
  role: Role;
  email: string;
}

export interface RequestWithActor extends Request {
  actor?: RequestActor;
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

  if (typeof req.params.workspaceId === 'string' && req.params.workspaceId.length > 0) {
    return req.params.workspaceId;
  }

  return null;
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

async function requireActorSupabase(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
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

    const membership = await findWorkspaceMembership(workspaceId, userId);
    if (!membership || !membership.active) {
      res.status(403).json({ error: 'membership_required', workspaceId });
      return;
    }

    const request = req as RequestWithActor;
    request.actor = {
      userId,
      workspaceId,
      role: membership.role,
      email,
    };

    next();
  } catch {
    res.status(401).json({ error: 'invalid_access_token' });
  }
}

function requireActorMock(req: Request, res: Response, next: NextFunction): void {
  const userId = req.header('x-user-id');
  const workspaceId = getWorkspaceContext(req);
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

  const request = req as RequestWithActor;
  request.actor = {
    userId,
    workspaceId,
    role: parsed.data,
    email,
  };

  next();
}

export function requireActor(req: Request, res: Response, next: NextFunction): void {
  if (authMode === 'mock') {
    requireActorMock(req, res, next);
    return;
  }

  requireActorSupabase(req, res, next).catch(next);
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
