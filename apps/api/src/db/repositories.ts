import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from './client.js';
import type { IdeaStatus, PermissionEffect, Role } from '../lib/types.js';

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

interface BoardRow {
  id: string;
  workspace_id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: 'public' | 'private';
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface IdeaRow {
  id: string;
  workspace_id: string;
  board_id: string;
  title: string;
  description: string;
  status: IdeaStatus;
  active: boolean;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  vote_count?: number | string | null;
  comment_count?: number | string | null;
  viewer_has_voted?: boolean | null;
}

interface IdeaCommentRow {
  id: string;
  workspace_id: string;
  idea_id: string;
  user_id: string;
  user_email: string;
  body: string;
  active: boolean;
  created_at: string;
  updated_at: string;
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

export interface BoardRecord {
  id: string;
  workspaceId: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: 'public' | 'private';
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaRecord {
  id: string;
  workspaceId: string;
  boardId: string;
  title: string;
  description: string;
  status: IdeaStatus;
  active: boolean;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  voteCount: number;
  commentCount: number;
  viewerHasVoted: boolean;
}

export interface IdeaCommentRecord {
  id: string;
  workspaceId: string;
  ideaId: string;
  userId: string;
  userEmail: string;
  body: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaVoteRecord {
  ideaId: string;
  voteCount: number;
  hasVoted: boolean;
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

function mapBoard(row: BoardRow): BoardRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    active: row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapIdea(row: IdeaRow): IdeaRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    boardId: row.board_id,
    title: row.title,
    description: row.description,
    status: row.status,
    active: row.active,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    voteCount: Number(row.vote_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
    viewerHasVoted: Boolean(row.viewer_has_voted ?? false),
  };
}

function mapIdeaComment(row: IdeaCommentRow): IdeaCommentRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    ideaId: row.idea_id,
    userId: row.user_id,
    userEmail: row.user_email,
    body: row.body,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function slugify(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  return base.length > 0 ? base : `board-${uuidv4().slice(0, 8)}`;
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

export async function listBoards(params: {
  workspaceId: string;
  includeInactive?: boolean;
}): Promise<BoardRecord[]> {
  const includeInactive = params.includeInactive ?? false;
  const result = await query<BoardRow>(
    `
      SELECT
        id,
        workspace_id,
        slug,
        name,
        description,
        visibility,
        active,
        created_by,
        created_at,
        updated_at
      FROM boards
      WHERE workspace_id = $1
        AND ($2::boolean = TRUE OR active = TRUE)
      ORDER BY created_at DESC
    `,
    [params.workspaceId, includeInactive],
  );

  return result.rows.map(mapBoard);
}

export async function findBoard(params: {
  workspaceId: string;
  boardId: string;
}): Promise<BoardRecord | null> {
  const result = await query<BoardRow>(
    `
      SELECT
        id,
        workspace_id,
        slug,
        name,
        description,
        visibility,
        active,
        created_by,
        created_at,
        updated_at
      FROM boards
      WHERE workspace_id = $1 AND id = $2
      LIMIT 1
    `,
    [params.workspaceId, params.boardId],
  );

  return (result.rowCount ?? 0) === 0 ? null : mapBoard(result.rows[0]);
}

export async function createBoard(params: {
  workspaceId: string;
  name: string;
  description?: string | null;
  visibility: 'public' | 'private';
  createdBy: string;
}): Promise<BoardRecord> {
  const id = uuidv4();
  const slug = `${slugify(params.name)}-${id.slice(0, 8)}`;
  const result = await query<BoardRow>(
    `
      INSERT INTO boards (id, workspace_id, slug, name, description, visibility, active, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
      RETURNING
        id,
        workspace_id,
        slug,
        name,
        description,
        visibility,
        active,
        created_by,
        created_at,
        updated_at
    `,
    [id, params.workspaceId, slug, params.name, params.description ?? null, params.visibility, params.createdBy],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error('board_insert_failed');
  }

  return mapBoard(result.rows[0]);
}

export async function updateBoard(params: {
  workspaceId: string;
  boardId: string;
  name?: string;
  description?: string | null;
  visibility?: 'public' | 'private';
  active?: boolean;
}): Promise<BoardRecord | null> {
  const fields: string[] = [];
  const values: unknown[] = [params.workspaceId, params.boardId];
  let index = 3;

  if (params.name !== undefined) {
    fields.push(`name = $${index++}`);
    values.push(params.name);
  }

  if (params.description !== undefined) {
    fields.push(`description = $${index++}`);
    values.push(params.description);
  }

  if (params.visibility !== undefined) {
    fields.push(`visibility = $${index++}`);
    values.push(params.visibility);
  }

  if (params.active !== undefined) {
    fields.push(`active = $${index++}`);
    values.push(params.active);
  }

  if (fields.length === 0) {
    return findBoard({
      workspaceId: params.workspaceId,
      boardId: params.boardId,
    });
  }

  fields.push('updated_at = NOW()');

  const result = await query<BoardRow>(
    `
      UPDATE boards
      SET ${fields.join(', ')}
      WHERE workspace_id = $1 AND id = $2
      RETURNING
        id,
        workspace_id,
        slug,
        name,
        description,
        visibility,
        active,
        created_by,
        created_at,
        updated_at
    `,
    values,
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  return mapBoard(result.rows[0]);
}

export async function listIdeas(params: {
  workspaceId: string;
  boardId: string;
  status?: IdeaStatus;
  includeInactive?: boolean;
  search?: string;
  limit?: number;
  viewerId?: string;
}): Promise<IdeaRecord[]> {
  const includeInactive = params.includeInactive ?? false;
  const clampedLimit = Math.max(1, Math.min(params.limit ?? 100, 200));
  const search = params.search?.trim();
  const result = await query<IdeaRow>(
    `
      SELECT
        i.id,
        i.workspace_id,
        i.board_id,
        i.title,
        i.description,
        i.status,
        i.active,
        i.created_by,
        i.updated_by,
        i.created_at,
        i.updated_at,
        COALESCE(v.vote_count, 0)::int AS vote_count,
        COALESCE(c.comment_count, 0)::int AS comment_count,
        CASE
          WHEN $7::text IS NULL THEN FALSE
          ELSE EXISTS (
            SELECT 1
            FROM idea_votes iv2
            WHERE iv2.workspace_id = i.workspace_id AND iv2.idea_id = i.id AND iv2.user_id = $7
          )
        END AS viewer_has_voted
      FROM ideas i
      LEFT JOIN (
        SELECT workspace_id, idea_id, COUNT(*) AS vote_count
        FROM idea_votes
        WHERE workspace_id = $1
        GROUP BY workspace_id, idea_id
      ) v ON v.workspace_id = i.workspace_id AND v.idea_id = i.id
      LEFT JOIN (
        SELECT workspace_id, idea_id, COUNT(*) AS comment_count
        FROM idea_comments
        WHERE workspace_id = $1 AND active = TRUE
        GROUP BY workspace_id, idea_id
      ) c ON c.workspace_id = i.workspace_id AND c.idea_id = i.id
      WHERE i.workspace_id = $1
        AND i.board_id = $2
        AND ($3::text IS NULL OR i.status = $3)
        AND ($4::boolean = TRUE OR i.active = TRUE)
        AND (
          $5::text IS NULL
          OR i.title ILIKE '%' || $5 || '%'
          OR i.description ILIKE '%' || $5 || '%'
        )
      ORDER BY
        COALESCE(v.vote_count, 0) DESC,
        i.created_at DESC
      LIMIT $6
    `,
    [
      params.workspaceId,
      params.boardId,
      params.status ?? null,
      includeInactive,
      search && search.length > 0 ? search : null,
      clampedLimit,
      params.viewerId ?? null,
    ],
  );

  return result.rows.map(mapIdea);
}

export async function findIdea(params: {
  workspaceId: string;
  boardId: string;
  ideaId: string;
  viewerId?: string;
}): Promise<IdeaRecord | null> {
  const result = await query<IdeaRow>(
    `
      SELECT
        i.id,
        i.workspace_id,
        i.board_id,
        i.title,
        i.description,
        i.status,
        i.active,
        i.created_by,
        i.updated_by,
        i.created_at,
        i.updated_at,
        (
          SELECT COUNT(*)::int
          FROM idea_votes iv
          WHERE iv.workspace_id = i.workspace_id AND iv.idea_id = i.id
        ) AS vote_count,
        (
          SELECT COUNT(*)::int
          FROM idea_comments ic
          WHERE ic.workspace_id = i.workspace_id AND ic.idea_id = i.id AND ic.active = TRUE
        ) AS comment_count,
        CASE
          WHEN $4::text IS NULL THEN FALSE
          ELSE EXISTS (
            SELECT 1
            FROM idea_votes iv2
            WHERE iv2.workspace_id = i.workspace_id AND iv2.idea_id = i.id AND iv2.user_id = $4
          )
        END AS viewer_has_voted
      FROM ideas i
      WHERE i.workspace_id = $1 AND i.board_id = $2 AND i.id = $3
      LIMIT 1
    `,
    [params.workspaceId, params.boardId, params.ideaId, params.viewerId ?? null],
  );

  return (result.rowCount ?? 0) === 0 ? null : mapIdea(result.rows[0]);
}

export async function createIdea(params: {
  workspaceId: string;
  boardId: string;
  title: string;
  description: string;
  status?: IdeaStatus;
  createdBy: string;
}): Promise<IdeaRecord> {
  const id = uuidv4();
  const status = params.status ?? 'new';
  const result = await query<IdeaRow>(
    `
      INSERT INTO ideas (
        id,
        workspace_id,
        board_id,
        title,
        description,
        status,
        active,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $7)
      RETURNING
        id,
        workspace_id,
        board_id,
        title,
        description,
        status,
        active,
        created_by,
        updated_by,
        created_at,
        updated_at,
        0::int AS vote_count,
        0::int AS comment_count,
        FALSE AS viewer_has_voted
    `,
    [
      id,
      params.workspaceId,
      params.boardId,
      params.title,
      params.description,
      status,
      params.createdBy,
    ],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error('idea_insert_failed');
  }

  return mapIdea(result.rows[0]);
}

export async function updateIdeaStatus(params: {
  workspaceId: string;
  boardId: string;
  ideaId: string;
  status: IdeaStatus;
  updatedBy: string;
  viewerId?: string;
}): Promise<IdeaRecord | null> {
  const updated = await query<{ id: string }>(
    `
      UPDATE ideas
      SET status = $4, updated_by = $5, updated_at = NOW()
      WHERE workspace_id = $1 AND board_id = $2 AND id = $3
      RETURNING id
    `,
    [params.workspaceId, params.boardId, params.ideaId, params.status, params.updatedBy],
  );

  if ((updated.rowCount ?? 0) === 0) {
    return null;
  }

  return findIdea({
    workspaceId: params.workspaceId,
    boardId: params.boardId,
    ideaId: params.ideaId,
    viewerId: params.viewerId ?? params.updatedBy,
  });
}

async function getIdeaVoteState(params: {
  workspaceId: string;
  ideaId: string;
  userId: string;
}): Promise<IdeaVoteRecord> {
  const result = await query<{ vote_count: number | string; has_voted: boolean }>(
    `
      SELECT
        COUNT(*)::int AS vote_count,
        EXISTS (
          SELECT 1
          FROM idea_votes iv2
          WHERE iv2.workspace_id = $1 AND iv2.idea_id = $2 AND iv2.user_id = $3
        ) AS has_voted
      FROM idea_votes iv
      WHERE iv.workspace_id = $1 AND iv.idea_id = $2
    `,
    [params.workspaceId, params.ideaId, params.userId],
  );

  return {
    ideaId: params.ideaId,
    voteCount: Number(result.rows[0]?.vote_count ?? 0),
    hasVoted: Boolean(result.rows[0]?.has_voted),
  };
}

export async function voteIdea(params: {
  workspaceId: string;
  ideaId: string;
  userId: string;
}): Promise<IdeaVoteRecord> {
  await query(
    `
      INSERT INTO idea_votes (workspace_id, idea_id, user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (idea_id, user_id) DO NOTHING
    `,
    [params.workspaceId, params.ideaId, params.userId],
  );

  return getIdeaVoteState(params);
}

export async function unvoteIdea(params: {
  workspaceId: string;
  ideaId: string;
  userId: string;
}): Promise<IdeaVoteRecord> {
  await query(
    `
      DELETE FROM idea_votes
      WHERE workspace_id = $1 AND idea_id = $2 AND user_id = $3
    `,
    [params.workspaceId, params.ideaId, params.userId],
  );

  return getIdeaVoteState(params);
}

export async function listIdeaComments(params: {
  workspaceId: string;
  ideaId: string;
  limit?: number;
}): Promise<IdeaCommentRecord[]> {
  const clampedLimit = Math.max(1, Math.min(params.limit ?? 100, 300));
  const result = await query<IdeaCommentRow>(
    `
      SELECT
        c.id,
        c.workspace_id,
        c.idea_id,
        c.user_id,
        u.email AS user_email,
        c.body,
        c.active,
        c.created_at,
        c.updated_at
      FROM idea_comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.workspace_id = $1 AND c.idea_id = $2 AND c.active = TRUE
      ORDER BY c.created_at ASC
      LIMIT $3
    `,
    [params.workspaceId, params.ideaId, clampedLimit],
  );

  return result.rows.map(mapIdeaComment);
}

export async function createIdeaComment(params: {
  workspaceId: string;
  ideaId: string;
  userId: string;
  body: string;
}): Promise<IdeaCommentRecord> {
  const id = uuidv4();
  const result = await query<IdeaCommentRow>(
    `
      INSERT INTO idea_comments (
        id,
        workspace_id,
        idea_id,
        user_id,
        body,
        active
      )
      VALUES ($1, $2, $3, $4, $5, TRUE)
      RETURNING
        id,
        workspace_id,
        idea_id,
        user_id,
        (
          SELECT email
          FROM users
          WHERE id = $4
        ) AS user_email,
        body,
        active,
        created_at,
        updated_at
    `,
    [id, params.workspaceId, params.ideaId, params.userId, params.body],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error('idea_comment_insert_failed');
  }

  return mapIdeaComment(result.rows[0]);
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
