import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from './client.js';
import type { PermissionEffect, Role } from '../lib/types.js';

interface MembershipRow {
  user_id: string;
  email: string;
  role: Role;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuditEventRow {
  id: string;
  workspace_id: string;
  actor_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MembershipRecord {
  userId: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditRecord {
  id: string;
  workspaceId: string;
  actorId: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

function mapMembership(row: MembershipRow): MembershipRecord {
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAudit(row: AuditEventRow): AuditRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    actorId: row.actor_id,
    action: row.action,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

async function ensureUserWithClient(
  client: { query: (text: string, params?: unknown[]) => Promise<unknown> },
  params: { userId: string; email: string; displayName?: string },
): Promise<void> {
  await client.query(
    `
      INSERT INTO users (id, email, display_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (id)
      DO UPDATE
      SET email = EXCLUDED.email,
          display_name = COALESCE(EXCLUDED.display_name, users.display_name),
          updated_at = NOW()
    `,
    [params.userId, params.email, params.displayName ?? null],
  );
}

export async function ensureUser(params: {
  userId: string;
  email: string;
  displayName?: string;
}): Promise<void> {
  await query(
    `
      INSERT INTO users (id, email, display_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (id)
      DO UPDATE
      SET email = EXCLUDED.email,
          display_name = COALESCE(EXCLUDED.display_name, users.display_name),
          updated_at = NOW()
    `,
    [params.userId, params.email, params.displayName ?? null],
  );
}

export async function workspaceExists(workspaceId: string): Promise<boolean> {
  const result = await query<{ present: number }>(
    'SELECT 1 AS present FROM workspaces WHERE id = $1 AND active = TRUE',
    [workspaceId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function findWorkspaceMembership(
  workspaceId: string,
  userId: string,
): Promise<MembershipRecord | null> {
  const result = await query<MembershipRow>(
    `
      SELECT
        m.user_id,
        u.email,
        m.role,
        m.active,
        m.created_at,
        m.updated_at
      FROM workspace_memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.workspace_id = $1 AND m.user_id = $2
      LIMIT 1
    `,
    [workspaceId, userId],
  );

  return (result.rowCount ?? 0) === 0 ? null : mapMembership(result.rows[0]);
}

export async function listWorkspaceMemberships(workspaceId: string): Promise<MembershipRecord[]> {
  const result = await query<MembershipRow>(
    `
      SELECT
        m.user_id,
        u.email,
        m.role,
        m.active,
        m.created_at,
        m.updated_at
      FROM workspace_memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.workspace_id = $1
      ORDER BY m.created_at ASC
    `,
    [workspaceId],
  );

  return result.rows.map(mapMembership);
}

export async function inviteWorkspaceMember(params: {
  workspaceId: string;
  userId: string;
  email: string;
  role: Role;
  invitedBy: string;
}): Promise<MembershipRecord> {
  return withTransaction(async (client) => {
    await ensureUserWithClient(client, {
      userId: params.userId,
      email: params.email,
    });

    await client.query(
      `
        INSERT INTO workspace_memberships (workspace_id, user_id, role, active, invited_by)
        VALUES ($1, $2, $3, TRUE, $4)
        ON CONFLICT (workspace_id, user_id)
        DO UPDATE
        SET role = EXCLUDED.role,
            active = TRUE,
            invited_by = EXCLUDED.invited_by,
            updated_at = NOW()
      `,
      [params.workspaceId, params.userId, params.role, params.invitedBy],
    );

    const result = await client.query<MembershipRow>(
      `
        SELECT
          m.user_id,
          u.email,
          m.role,
          m.active,
          m.created_at,
          m.updated_at
        FROM workspace_memberships m
        JOIN users u ON u.id = m.user_id
        WHERE m.workspace_id = $1 AND m.user_id = $2
        LIMIT 1
      `,
      [params.workspaceId, params.userId],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new Error('membership_insert_failed');
    }

    return mapMembership(result.rows[0]);
  });
}

export async function updateWorkspaceMemberRole(params: {
  workspaceId: string;
  userId: string;
  role: Role;
}): Promise<MembershipRecord | null> {
  const updated = await query<{ user_id: string }>(
    `
      UPDATE workspace_memberships
      SET role = $3, updated_at = NOW()
      WHERE workspace_id = $1 AND user_id = $2 AND active = TRUE
      RETURNING user_id
    `,
    [params.workspaceId, params.userId, params.role],
  );

  if ((updated.rowCount ?? 0) === 0) {
    return null;
  }

  return findWorkspaceMembership(params.workspaceId, params.userId);
}

export async function deactivateWorkspaceMember(params: {
  workspaceId: string;
  userId: string;
}): Promise<MembershipRecord | null> {
  const updated = await query<{ user_id: string }>(
    `
      UPDATE workspace_memberships
      SET active = FALSE, updated_at = NOW()
      WHERE workspace_id = $1 AND user_id = $2 AND active = TRUE
      RETURNING user_id
    `,
    [params.workspaceId, params.userId],
  );

  if ((updated.rowCount ?? 0) === 0) {
    return null;
  }

  return findWorkspaceMembership(params.workspaceId, params.userId);
}

export async function createAuditEvent(params: {
  workspaceId: string;
  actorId: string;
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<AuditRecord> {
  const id = uuidv4();
  const result = await query<AuditEventRow>(
    `
      INSERT INTO audit_events (id, workspace_id, actor_id, action, metadata)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING id, workspace_id, actor_id, action, metadata, created_at
    `,
    [id, params.workspaceId, params.actorId, params.action, JSON.stringify(params.metadata ?? {})],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error('audit_insert_failed');
  }

  return mapAudit(result.rows[0]);
}

export async function listAuditEvents(workspaceId: string, limit = 100): Promise<AuditRecord[]> {
  const clampedLimit = Math.max(1, Math.min(limit, 500));
  const result = await query<AuditEventRow>(
    `
      SELECT id, workspace_id, actor_id, action, metadata, created_at
      FROM audit_events
      WHERE workspace_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [workspaceId, clampedLimit],
  );

  return result.rows.map(mapAudit);
}

export async function getPermissionOverride(params: {
  workspaceId: string;
  role: Role;
  permission: string;
}): Promise<PermissionEffect | null> {
  const result = await query<{ effect: PermissionEffect }>(
    `
      SELECT effect
      FROM workspace_role_permissions
      WHERE workspace_id = $1 AND role = $2 AND permission = $3
      LIMIT 1
    `,
    [params.workspaceId, params.role, params.permission],
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  return result.rows[0].effect;
}
