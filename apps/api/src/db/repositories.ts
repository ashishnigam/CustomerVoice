import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from './client.js';
import type { IdeaModerationState, IdeaStatus, PermissionEffect, Role } from '../lib/types.js';

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
  moderation_state: IdeaModerationState;
  comments_locked: boolean;
  merged_into_idea_id: string | null;
  active: boolean;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  vote_count?: number | string | null;
  comment_count?: number | string | null;
  viewer_has_voted?: boolean | null;
  category_ids?: string[] | null;
  category_names?: string[] | null;
  category_slugs?: string[] | null;
}

interface IdeaCommentRow {
  id: string;
  workspace_id: string;
  idea_id: string;
  user_id: string;
  user_email: string;
  body: string;
  active: boolean;
  is_official: boolean;
  is_team_member: boolean;
  created_at: string;
  updated_at: string;
}

interface IdeaCategoryRow {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  color_hex: string | null;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface IdeaAudienceRow {
  user_id: string | null;
  email: string;
}

interface NotificationJobRow {
  id: string;
  workspace_id: string;
  board_id: string;
  idea_id: string;
  event_type: string;
  template_id: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'dead';
  attempt_count: number;
  max_attempts: number;
  recipient_count: number;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

interface NotificationRecipientRow {
  id: string;
  job_id: string;
  workspace_id: string;
  user_id: string | null;
  email: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
}

interface IdeaAnalyticsRow {
  idea_id: string;
  board_id: string;
  title: string;
  status: IdeaStatus;
  moderation_state: IdeaModerationState;
  vote_count: number | string;
  comment_count: number | string;
  reach: string | number;
  impact: string | number;
  confidence: string | number;
  effort: string | number;
  rice_score: string | number;
  revenue_potential_usd: string | number;
  customer_segment: string | null;
  customer_count: number;
  contact_emails: string[] | null;
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
  moderationState: IdeaModerationState;
  commentsLocked: boolean;
  mergedIntoIdeaId: string | null;
  active: boolean;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  voteCount: number;
  commentCount: number;
  viewerHasVoted: boolean;
  categoryIds: string[];
  categoryNames: string[];
  categorySlugs: string[];
}

export interface IdeaCommentRecord {
  id: string;
  workspaceId: string;
  ideaId: string;
  userId: string;
  userEmail: string;
  body: string;
  active: boolean;
  isOfficial: boolean;
  isTeamMember: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaVoteRecord {
  ideaId: string;
  voteCount: number;
  hasVoted: boolean;
}

export type IdeaSortMode = 'top_voted' | 'most_commented' | 'newest';

export interface IdeaCategoryRecord {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  colorHex: string | null;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationAudienceRecord {
  userId: string | null;
  email: string;
}

export interface NotificationJobRecord {
  id: string;
  workspaceId: string;
  boardId: string;
  ideaId: string;
  eventType: string;
  templateId: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'dead';
  attemptCount: number;
  maxAttempts: number;
  recipientCount: number;
  lastError: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
}

export interface NotificationRecipientRecord {
  id: string;
  jobId: string;
  workspaceId: string;
  userId: string | null;
  email: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface IdeaAnalyticsInputRecord {
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  revenuePotentialUsd: number;
  customerSegment: string | null;
  customerCount: number;
}

export interface IdeaAnalyticsRecord {
  ideaId: string;
  boardId: string;
  title: string;
  status: IdeaStatus;
  moderationState: IdeaModerationState;
  voteCount: number;
  commentCount: number;
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  riceScore: number;
  revenuePotentialUsd: number;
  customerSegment: string | null;
  customerCount: number;
  contactEmails: string[];
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
    moderationState: row.moderation_state,
    commentsLocked: row.comments_locked,
    mergedIntoIdeaId: row.merged_into_idea_id,
    active: row.active,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    voteCount: Number(row.vote_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
    viewerHasVoted: Boolean(row.viewer_has_voted ?? false),
    categoryIds: row.category_ids ?? [],
    categoryNames: row.category_names ?? [],
    categorySlugs: row.category_slugs ?? [],
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
    isOfficial: row.is_official ?? false,
    isTeamMember: row.is_team_member ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapIdeaCategory(row: IdeaCategoryRow): IdeaCategoryRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    slug: row.slug,
    colorHex: row.color_hex,
    active: row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNotificationJob(row: NotificationJobRow): NotificationJobRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    boardId: row.board_id,
    ideaId: row.idea_id,
    eventType: row.event_type,
    templateId: row.template_id,
    payload: row.payload ?? {},
    status: row.status,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    recipientCount: row.recipient_count,
    lastError: row.last_error,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    processedAt: row.processed_at,
  };
}

function mapNotificationRecipient(row: NotificationRecipientRow): NotificationRecipientRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    email: row.email,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    sentAt: row.sent_at,
    createdAt: row.created_at,
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

async function generateUniqueBoardSlug(workspaceId: string, name: string): Promise<string> {
  const baseSlug = slugify(name);
  const existing = await query<{ slug: string }>(
    `
      SELECT slug
      FROM boards
      WHERE workspace_id = $1
        AND (slug = $2 OR slug LIKE $3)
    `,
    [workspaceId, baseSlug, `${baseSlug}-%`],
  );

  const existingSlugs = new Set(existing.rows.map((row) => row.slug));
  if (existingSlugs.size === 0) {
    return baseSlug;
  }

  let suffix = 2;
  let candidate = `${baseSlug}-${suffix}`;
  while (existingSlugs.has(candidate)) {
    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }

  return candidate;
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

export async function findBoardBySlug(params: {
  slug: string;
  onlyPublic?: boolean;
}): Promise<BoardRecord | null> {
  const onlyPublic = params.onlyPublic ?? true;
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
      WHERE (slug = $1 OR slug LIKE $1 || '-%')
        AND active = TRUE
        AND ($2::boolean = FALSE OR visibility = 'public')
      ORDER BY
        CASE WHEN slug = $1 THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [params.slug, onlyPublic],
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
  const slug = await generateUniqueBoardSlug(params.workspaceId, params.name);
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
  moderationState?: IdeaModerationState;
  includeInactive?: boolean;
  includeModerated?: boolean;
  search?: string;
  categoryIds?: string[];
  sort?: IdeaSortMode;
  limit?: number;
  offset?: number;
  viewerId?: string;
}): Promise<IdeaRecord[]> {
  const includeInactive = params.includeInactive ?? false;
  const includeModerated = params.includeModerated ?? false;
  const clampedLimit = Math.max(1, Math.min(params.limit ?? 100, 200));
  const clampedOffset = Math.max(0, params.offset ?? 0);
  const search = params.search?.trim();
  const normalizedCategoryIds =
    params.categoryIds && params.categoryIds.length > 0 ? params.categoryIds : null;
  const sort = params.sort ?? 'top_voted';
  const result = await query<IdeaRow>(
    `
      SELECT
        i.id,
        i.workspace_id,
        i.board_id,
        i.title,
        i.description,
        i.status,
        i.moderation_state,
        i.comments_locked,
        i.merged_into_idea_id,
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
        END AS viewer_has_voted,
        COALESCE(
          ARRAY(
            SELECT icl.category_id
            FROM idea_category_links icl
            WHERE icl.workspace_id = i.workspace_id AND icl.idea_id = i.id
            ORDER BY icl.category_id
          ),
          ARRAY[]::text[]
        ) AS category_ids,
        COALESCE(
          ARRAY(
            SELECT c.name
            FROM idea_category_links icl
            JOIN idea_categories c ON c.id = icl.category_id
            WHERE icl.workspace_id = i.workspace_id AND icl.idea_id = i.id AND c.active = TRUE
            ORDER BY c.name
          ),
          ARRAY[]::text[]
        ) AS category_names,
        COALESCE(
          ARRAY(
            SELECT c.slug
            FROM idea_category_links icl
            JOIN idea_categories c ON c.id = icl.category_id
            WHERE icl.workspace_id = i.workspace_id AND icl.idea_id = i.id AND c.active = TRUE
            ORDER BY c.slug
          ),
          ARRAY[]::text[]
        ) AS category_slugs
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
        AND ($8::text[] IS NULL OR EXISTS (
          SELECT 1
          FROM idea_category_links iclf
          WHERE iclf.workspace_id = i.workspace_id
            AND iclf.idea_id = i.id
            AND iclf.category_id = ANY($8)
        ))
        AND ($9::text IS NULL OR i.moderation_state = $9)
        AND ($10::boolean = TRUE OR i.moderation_state = 'normal')
        AND (
          $5::text IS NULL
          OR i.title ILIKE '%' || $5 || '%'
          OR i.description ILIKE '%' || $5 || '%'
        )
      ORDER BY
        CASE WHEN $11 = 'top_voted' THEN COALESCE(v.vote_count, 0) END DESC,
        CASE WHEN $11 = 'most_commented' THEN COALESCE(c.comment_count, 0) END DESC,
        CASE WHEN $11 = 'newest' THEN i.created_at END DESC,
        COALESCE(v.vote_count, 0) DESC,
        COALESCE(c.comment_count, 0) DESC,
        i.created_at DESC
      LIMIT $6
      OFFSET $12
    `,
    [
      params.workspaceId,
      params.boardId,
      params.status ?? null,
      includeInactive,
      search && search.length > 0 ? search : null,
      clampedLimit,
      params.viewerId ?? null,
      normalizedCategoryIds,
      params.moderationState ?? null,
      includeModerated,
      sort,
      clampedOffset,
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
        i.moderation_state,
        i.comments_locked,
        i.merged_into_idea_id,
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
        END AS viewer_has_voted,
        COALESCE(
          ARRAY(
            SELECT icl.category_id
            FROM idea_category_links icl
            WHERE icl.workspace_id = i.workspace_id AND icl.idea_id = i.id
            ORDER BY icl.category_id
          ),
          ARRAY[]::text[]
        ) AS category_ids,
        COALESCE(
          ARRAY(
            SELECT c.name
            FROM idea_category_links icl
            JOIN idea_categories c ON c.id = icl.category_id
            WHERE icl.workspace_id = i.workspace_id AND icl.idea_id = i.id AND c.active = TRUE
            ORDER BY c.name
          ),
          ARRAY[]::text[]
        ) AS category_names,
        COALESCE(
          ARRAY(
            SELECT c.slug
            FROM idea_category_links icl
            JOIN idea_categories c ON c.id = icl.category_id
            WHERE icl.workspace_id = i.workspace_id AND icl.idea_id = i.id AND c.active = TRUE
            ORDER BY c.slug
          ),
          ARRAY[]::text[]
        ) AS category_slugs
      FROM ideas i
      WHERE i.workspace_id = $1 AND i.board_id = $2 AND i.id = $3
      LIMIT 1
    `,
    [params.workspaceId, params.boardId, params.ideaId, params.viewerId ?? null],
  );

  return (result.rowCount ?? 0) === 0 ? null : mapIdea(result.rows[0]);
}

export async function findIdeaById(params: {
  workspaceId: string;
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
        i.moderation_state,
        i.comments_locked,
        i.merged_into_idea_id,
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
          WHEN $3::text IS NULL THEN FALSE
          ELSE EXISTS (
            SELECT 1
            FROM idea_votes iv2
            WHERE iv2.workspace_id = i.workspace_id AND iv2.idea_id = i.id AND iv2.user_id = $3
          )
        END AS viewer_has_voted,
        COALESCE(
          ARRAY(
            SELECT icl.category_id
            FROM idea_category_links icl
            WHERE icl.workspace_id = i.workspace_id AND icl.idea_id = i.id
            ORDER BY icl.category_id
          ),
          ARRAY[]::text[]
        ) AS category_ids,
        COALESCE(
          ARRAY(
            SELECT c.name
            FROM idea_category_links icl
            JOIN idea_categories c ON c.id = icl.category_id
            WHERE icl.workspace_id = i.workspace_id AND icl.idea_id = i.id AND c.active = TRUE
            ORDER BY c.name
          ),
          ARRAY[]::text[]
        ) AS category_names,
        COALESCE(
          ARRAY(
            SELECT c.slug
            FROM idea_category_links icl
            JOIN idea_categories c ON c.id = icl.category_id
            WHERE icl.workspace_id = i.workspace_id AND icl.idea_id = i.id AND c.active = TRUE
            ORDER BY c.slug
          ),
          ARRAY[]::text[]
        ) AS category_slugs
      FROM ideas i
      WHERE i.workspace_id = $1 AND i.id = $2
      LIMIT 1
    `,
    [params.workspaceId, params.ideaId, params.viewerId ?? null],
  );

  return (result.rowCount ?? 0) === 0 ? null : mapIdea(result.rows[0]);
}

export async function createIdea(params: {
  workspaceId: string;
  boardId: string;
  title: string;
  description: string;
  status?: IdeaStatus;
  categoryIds?: string[];
  createdBy: string;
}): Promise<IdeaRecord> {
  const id = uuidv4();
  const status = params.status ?? 'new';
  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO ideas (
          id,
          workspace_id,
          board_id,
          title,
          description,
          status,
          moderation_state,
          comments_locked,
          active,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'normal', FALSE, TRUE, $7, $7)
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

    if (params.categoryIds && params.categoryIds.length > 0) {
      await client.query(
        `
          INSERT INTO idea_category_links (workspace_id, idea_id, category_id)
          SELECT $1, $2, c.id
          FROM idea_categories c
          WHERE c.workspace_id = $1
            AND c.id = ANY($3::text[])
            AND c.active = TRUE
          ON CONFLICT (idea_id, category_id) DO NOTHING
        `,
        [params.workspaceId, id, params.categoryIds],
      );
    }
  });

  const created = await findIdea({
    workspaceId: params.workspaceId,
    boardId: params.boardId,
    ideaId: id,
    viewerId: params.createdBy,
  });

  if (!created) {
    throw new Error('idea_insert_failed');
  }

  return created;
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
        c.is_official,
        c.is_team_member,
        c.created_at,
        c.updated_at
      FROM idea_comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.workspace_id = $1 AND c.idea_id = $2 AND c.active = TRUE
      ORDER BY c.is_official DESC, c.created_at ASC
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
  const ideaLockCheck = await query<{ comments_locked: boolean }>(
    `
      SELECT comments_locked
      FROM ideas
      WHERE workspace_id = $1 AND id = $2
      LIMIT 1
    `,
    [params.workspaceId, params.ideaId],
  );

  if ((ideaLockCheck.rowCount ?? 0) === 0) {
    throw new Error('idea_not_found');
  }

  if (ideaLockCheck.rows[0]?.comments_locked) {
    throw new Error('idea_comments_locked');
  }

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

export async function listIdeaCategories(params: {
  workspaceId: string;
  includeInactive?: boolean;
}): Promise<IdeaCategoryRecord[]> {
  const includeInactive = params.includeInactive ?? false;
  const result = await query<IdeaCategoryRow>(
    `
      SELECT
        id,
        workspace_id,
        name,
        slug,
        color_hex,
        active,
        created_by,
        created_at,
        updated_at
      FROM idea_categories
      WHERE workspace_id = $1
        AND ($2::boolean = TRUE OR active = TRUE)
      ORDER BY name ASC
    `,
    [params.workspaceId, includeInactive],
  );

  return result.rows.map(mapIdeaCategory);
}

export async function createIdeaCategory(params: {
  workspaceId: string;
  name: string;
  colorHex?: string | null;
  createdBy: string;
}): Promise<IdeaCategoryRecord> {
  const id = uuidv4();
  const slug = `${slugify(params.name)}-${id.slice(0, 6)}`;
  const result = await query<IdeaCategoryRow>(
    `
      INSERT INTO idea_categories (
        id,
        workspace_id,
        name,
        slug,
        color_hex,
        active,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, TRUE, $6)
      RETURNING
        id,
        workspace_id,
        name,
        slug,
        color_hex,
        active,
        created_by,
        created_at,
        updated_at
    `,
    [id, params.workspaceId, params.name.trim(), slug, params.colorHex ?? null, params.createdBy],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error('idea_category_insert_failed');
  }

  return mapIdeaCategory(result.rows[0]);
}

export async function updateIdeaCategory(params: {
  workspaceId: string;
  categoryId: string;
  name?: string;
  colorHex?: string | null;
  active?: boolean;
}): Promise<IdeaCategoryRecord | null> {
  const fields: string[] = [];
  const values: unknown[] = [params.workspaceId, params.categoryId];
  let index = 3;

  if (params.name !== undefined) {
    fields.push(`name = $${index++}`);
    values.push(params.name.trim());
    fields.push(`slug = $${index++}`);
    values.push(`${slugify(params.name)}-${params.categoryId.slice(0, 6)}`);
  }

  if (params.colorHex !== undefined) {
    fields.push(`color_hex = $${index++}`);
    values.push(params.colorHex);
  }

  if (params.active !== undefined) {
    fields.push(`active = $${index++}`);
    values.push(params.active);
  }

  if (fields.length === 0) {
    const current = await query<IdeaCategoryRow>(
      `
        SELECT
          id,
          workspace_id,
          name,
          slug,
          color_hex,
          active,
          created_by,
          created_at,
          updated_at
        FROM idea_categories
        WHERE workspace_id = $1 AND id = $2
        LIMIT 1
      `,
      [params.workspaceId, params.categoryId],
    );
    return (current.rowCount ?? 0) === 0 ? null : mapIdeaCategory(current.rows[0]);
  }

  fields.push('updated_at = NOW()');

  const updated = await query<IdeaCategoryRow>(
    `
      UPDATE idea_categories
      SET ${fields.join(', ')}
      WHERE workspace_id = $1 AND id = $2
      RETURNING
        id,
        workspace_id,
        name,
        slug,
        color_hex,
        active,
        created_by,
        created_at,
        updated_at
    `,
    values,
  );

  return (updated.rowCount ?? 0) === 0 ? null : mapIdeaCategory(updated.rows[0]);
}

export async function setIdeaCategories(params: {
  workspaceId: string;
  ideaId: string;
  categoryIds: string[];
}): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `
        DELETE FROM idea_category_links
        WHERE workspace_id = $1 AND idea_id = $2
      `,
      [params.workspaceId, params.ideaId],
    );

    if (params.categoryIds.length === 0) {
      return;
    }

    await client.query(
      `
        INSERT INTO idea_category_links (workspace_id, idea_id, category_id)
        SELECT $1, $2, c.id
        FROM idea_categories c
        WHERE c.workspace_id = $1
          AND c.active = TRUE
          AND c.id = ANY($3::text[])
        ON CONFLICT (idea_id, category_id) DO NOTHING
      `,
      [params.workspaceId, params.ideaId, params.categoryIds],
    );
  });
}

export async function setIdeaModerationState(params: {
  workspaceId: string;
  boardId: string;
  ideaId: string;
  moderationState: IdeaModerationState;
  updatedBy: string;
  active?: boolean;
}): Promise<IdeaRecord | null> {
  const result = await query<{ id: string }>(
    `
      UPDATE ideas
      SET
        moderation_state = $4,
        active = COALESCE($6, active),
        updated_by = $5,
        updated_at = NOW()
      WHERE workspace_id = $1 AND board_id = $2 AND id = $3
      RETURNING id
    `,
    [
      params.workspaceId,
      params.boardId,
      params.ideaId,
      params.moderationState,
      params.updatedBy,
      params.active ?? null,
    ],
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  return findIdea({
    workspaceId: params.workspaceId,
    boardId: params.boardId,
    ideaId: params.ideaId,
    viewerId: params.updatedBy,
  });
}

export async function setIdeaCommentsLocked(params: {
  workspaceId: string;
  boardId: string;
  ideaId: string;
  commentsLocked: boolean;
  updatedBy: string;
}): Promise<IdeaRecord | null> {
  const result = await query<{ id: string }>(
    `
      UPDATE ideas
      SET comments_locked = $4, updated_by = $5, updated_at = NOW()
      WHERE workspace_id = $1 AND board_id = $2 AND id = $3
      RETURNING id
    `,
    [params.workspaceId, params.boardId, params.ideaId, params.commentsLocked, params.updatedBy],
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  return findIdea({
    workspaceId: params.workspaceId,
    boardId: params.boardId,
    ideaId: params.ideaId,
    viewerId: params.updatedBy,
  });
}

export async function mergeIdeas(params: {
  workspaceId: string;
  sourceIdeaId: string;
  targetIdeaId: string;
  updatedBy: string;
}): Promise<{ source: IdeaRecord; target: IdeaRecord } | null> {
  if (params.sourceIdeaId === params.targetIdeaId) {
    throw new Error('merge_target_must_differ');
  }

  const boardContext = await withTransaction(async (client) => {
    const sourceResult = await client.query<{ id: string; board_id: string }>(
      `
        SELECT id, board_id
        FROM ideas
        WHERE workspace_id = $1 AND id = $2
        LIMIT 1
      `,
      [params.workspaceId, params.sourceIdeaId],
    );
    const targetResult = await client.query<{ id: string; board_id: string }>(
      `
        SELECT id, board_id
        FROM ideas
        WHERE workspace_id = $1 AND id = $2
        LIMIT 1
      `,
      [params.workspaceId, params.targetIdeaId],
    );

    if ((sourceResult.rowCount ?? 0) === 0 || (targetResult.rowCount ?? 0) === 0) {
      return null;
    }

    const sourceBoardId = sourceResult.rows[0]?.board_id;
    const targetBoardId = targetResult.rows[0]?.board_id;
    if (!sourceBoardId || !targetBoardId || sourceBoardId !== targetBoardId) {
      throw new Error('merge_requires_same_board');
    }

    await client.query(
      `
        INSERT INTO idea_votes (workspace_id, idea_id, user_id)
        SELECT workspace_id, $2, user_id
        FROM idea_votes
        WHERE workspace_id = $1 AND idea_id = $3
        ON CONFLICT (idea_id, user_id) DO NOTHING
      `,
      [params.workspaceId, params.targetIdeaId, params.sourceIdeaId],
    );

    await client.query(
      `
        DELETE FROM idea_votes
        WHERE workspace_id = $1 AND idea_id = $2
      `,
      [params.workspaceId, params.sourceIdeaId],
    );

    await client.query(
      `
        UPDATE idea_comments
        SET idea_id = $2, updated_at = NOW()
        WHERE workspace_id = $1 AND idea_id = $3
      `,
      [params.workspaceId, params.targetIdeaId, params.sourceIdeaId],
    );

    await client.query(
      `
        INSERT INTO idea_category_links (workspace_id, idea_id, category_id)
        SELECT workspace_id, $2, category_id
        FROM idea_category_links
        WHERE workspace_id = $1 AND idea_id = $3
        ON CONFLICT (idea_id, category_id) DO NOTHING
      `,
      [params.workspaceId, params.targetIdeaId, params.sourceIdeaId],
    );

    await client.query(
      `
        DELETE FROM idea_category_links
        WHERE workspace_id = $1 AND idea_id = $2
      `,
      [params.workspaceId, params.sourceIdeaId],
    );

    await client.query(
      `
        UPDATE ideas
        SET
          moderation_state = 'merged',
          merged_into_idea_id = $3,
          comments_locked = TRUE,
          active = FALSE,
          updated_by = $4,
          updated_at = NOW()
        WHERE workspace_id = $1 AND id = $2
      `,
      [params.workspaceId, params.sourceIdeaId, params.targetIdeaId, params.updatedBy],
    );

    await client.query(
      `
        UPDATE ideas
        SET updated_by = $3, updated_at = NOW()
        WHERE workspace_id = $1 AND id = $2
      `,
      [params.workspaceId, params.targetIdeaId, params.updatedBy],
    );

    return {
      sourceBoardId,
      targetBoardId,
    };
  });

  if (!boardContext) {
    return null;
  }

  const [sourceIdea, targetIdea] = await Promise.all([
    findIdea({
      workspaceId: params.workspaceId,
      boardId: boardContext.sourceBoardId,
      ideaId: params.sourceIdeaId,
      viewerId: params.updatedBy,
    }),
    findIdea({
      workspaceId: params.workspaceId,
      boardId: boardContext.targetBoardId,
      ideaId: params.targetIdeaId,
      viewerId: params.updatedBy,
    }),
  ]);

  if (!sourceIdea || !targetIdea) {
    throw new Error('merge_result_not_found');
  }

  return {
    source: sourceIdea,
    target: targetIdea,
  };
}

export async function listModerationIdeas(params: {
  workspaceId: string;
  boardId?: string;
  moderationState?: IdeaModerationState;
  search?: string;
  limit?: number;
}): Promise<IdeaRecord[]> {
  const clampedLimit = Math.max(1, Math.min(params.limit ?? 200, 300));
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
        i.moderation_state,
        i.comments_locked,
        i.merged_into_idea_id,
        i.active,
        i.created_by,
        i.updated_by,
        i.created_at,
        i.updated_at,
        (
          SELECT COUNT(*)::int FROM idea_votes iv
          WHERE iv.workspace_id = i.workspace_id AND iv.idea_id = i.id
        ) AS vote_count,
        (
          SELECT COUNT(*)::int FROM idea_comments ic
          WHERE ic.workspace_id = i.workspace_id AND ic.idea_id = i.id AND ic.active = TRUE
        ) AS comment_count,
        FALSE AS viewer_has_voted,
        COALESCE(
          ARRAY(
            SELECT icl.category_id
            FROM idea_category_links icl
            WHERE icl.workspace_id = i.workspace_id AND icl.idea_id = i.id
            ORDER BY icl.category_id
          ),
          ARRAY[]::text[]
        ) AS category_ids,
        COALESCE(
          ARRAY(
            SELECT c.name
            FROM idea_category_links icl
            JOIN idea_categories c ON c.id = icl.category_id
            WHERE icl.workspace_id = i.workspace_id AND icl.idea_id = i.id AND c.active = TRUE
            ORDER BY c.name
          ),
          ARRAY[]::text[]
        ) AS category_names,
        COALESCE(
          ARRAY(
            SELECT c.slug
            FROM idea_category_links icl
            JOIN idea_categories c ON c.id = icl.category_id
            WHERE icl.workspace_id = i.workspace_id AND icl.idea_id = i.id AND c.active = TRUE
            ORDER BY c.slug
          ),
          ARRAY[]::text[]
        ) AS category_slugs
      FROM ideas i
      WHERE i.workspace_id = $1
        AND ($2::text IS NULL OR i.board_id = $2)
        AND ($3::text IS NULL OR i.moderation_state = $3)
        AND (
          $4::text IS NULL
          OR i.title ILIKE '%' || $4 || '%'
          OR i.description ILIKE '%' || $4 || '%'
        )
      ORDER BY i.updated_at DESC
      LIMIT $5
    `,
    [
      params.workspaceId,
      params.boardId ?? null,
      params.moderationState ?? null,
      search && search.length > 0 ? search : null,
      clampedLimit,
    ],
  );

  return result.rows.map(mapIdea);
}

export async function resolveIdeaAudience(params: {
  workspaceId: string;
  ideaId: string;
}): Promise<NotificationAudienceRecord[]> {
  const result = await query<IdeaAudienceRow>(
    `
      SELECT DISTINCT u.id AS user_id, u.email
      FROM users u
      JOIN idea_votes iv ON iv.user_id = u.id
      WHERE iv.workspace_id = $1 AND iv.idea_id = $2

      UNION

      SELECT DISTINCT u.id AS user_id, u.email
      FROM users u
      JOIN idea_comments ic ON ic.user_id = u.id
      WHERE ic.workspace_id = $1 AND ic.idea_id = $2 AND ic.active = TRUE

      ORDER BY email ASC
    `,
    [params.workspaceId, params.ideaId],
  );

  return result.rows.map((row) => ({
    userId: row.user_id,
    email: row.email,
  }));
}

export async function createNotificationJob(params: {
  workspaceId?: string;
  boardId?: string;
  ideaId?: string;
  eventType: string;
  templateId: string;
  payload?: Record<string, unknown>;
  createdBy?: string;
  recipients: NotificationAudienceRecord[];
  maxAttempts?: number;
}): Promise<NotificationJobRecord> {
  const jobId = uuidv4();
  const maxAttempts = Math.max(1, Math.min(params.maxAttempts ?? 3, 10));
  const deduplicatedRecipients = Array.from(
    new Map(
      params.recipients.map((recipient) => [
        recipient.email.toLowerCase(),
        { ...recipient, email: recipient.email.toLowerCase() },
      ]),
    ).values(),
  );
  const initialStatus: NotificationJobRecord['status'] =
    deduplicatedRecipients.length === 0 ? 'sent' : 'pending';

  return withTransaction(async (client) => {
    const created = await client.query<NotificationJobRow>(
      `
        INSERT INTO notification_jobs (
          id,
          workspace_id,
          board_id,
          idea_id,
          event_type,
          template_id,
          payload,
          status,
          max_attempts,
          recipient_count,
          created_by,
          processed_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11,
          CASE WHEN $8 = 'sent' THEN NOW() ELSE NULL END
        )
        RETURNING
          id,
          workspace_id,
          board_id,
          idea_id,
          event_type,
          template_id,
          payload,
          status,
          attempt_count,
          max_attempts,
          recipient_count,
          last_error,
          created_by,
          created_at,
          updated_at,
          processed_at
      `,
      [
        jobId,
        params.workspaceId ?? null,
        params.boardId ?? null,
        params.ideaId ?? null,
        params.eventType,
        params.templateId,
        JSON.stringify(params.payload ?? {}),
        initialStatus,
        maxAttempts,
        deduplicatedRecipients.length,
        params.createdBy ?? null,
      ],
    );

    if ((created.rowCount ?? 0) === 0) {
      throw new Error('notification_job_insert_failed');
    }

    for (const recipient of deduplicatedRecipients) {
      await client.query(
        `
          INSERT INTO notification_job_recipients (
            id,
            job_id,
            workspace_id,
            user_id,
            email,
            status
          )
          VALUES ($1, $2, $3, $4, $5, 'pending')
          ON CONFLICT (job_id, email) DO NOTHING
        `,
        [uuidv4(), jobId, params.workspaceId ?? null, recipient.userId ?? null, recipient.email.toLowerCase()],
      );
    }

    return mapNotificationJob(created.rows[0]);
  });
}

export async function claimNextNotificationJob(): Promise<{
  job: NotificationJobRecord;
  recipients: NotificationRecipientRecord[];
} | null> {
  return withTransaction(async (client) => {
    const claimed = await client.query<NotificationJobRow>(
      `
        SELECT
          id,
          workspace_id,
          board_id,
          idea_id,
          event_type,
          template_id,
          payload,
          status,
          attempt_count,
          max_attempts,
          recipient_count,
          last_error,
          created_by,
          created_at,
          updated_at,
          processed_at
        FROM notification_jobs
        WHERE status IN ('pending', 'failed')
          AND attempt_count < max_attempts
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `,
    );

    if ((claimed.rowCount ?? 0) === 0) {
      return null;
    }

    const row = claimed.rows[0];
    await client.query(
      `
        UPDATE notification_jobs
        SET
          status = 'processing',
          attempt_count = attempt_count + 1,
          updated_at = NOW()
        WHERE id = $1
      `,
      [row.id],
    );

    const recipientRows = await client.query<NotificationRecipientRow>(
      `
        SELECT
          id,
          job_id,
          workspace_id,
          user_id,
          email,
          status,
          attempts,
          last_error,
          sent_at,
          created_at
        FROM notification_job_recipients
        WHERE job_id = $1
          AND status != 'sent'
        ORDER BY created_at ASC
      `,
      [row.id],
    );

    return {
      job: {
        ...mapNotificationJob(row),
        status: 'processing',
        attemptCount: row.attempt_count + 1,
      },
      recipients: recipientRows.rows.map(mapNotificationRecipient),
    };
  });
}

export async function markNotificationRecipientSent(recipientId: string): Promise<void> {
  await query(
    `
      UPDATE notification_job_recipients
      SET
        status = 'sent',
        attempts = attempts + 1,
        last_error = NULL,
        sent_at = NOW()
      WHERE id = $1
    `,
    [recipientId],
  );
}

export async function markNotificationRecipientFailed(params: {
  recipientId: string;
  error: string;
}): Promise<void> {
  await query(
    `
      UPDATE notification_job_recipients
      SET
        status = 'failed',
        attempts = attempts + 1,
        last_error = $2
      WHERE id = $1
    `,
    [params.recipientId, params.error.slice(0, 2000)],
  );
}

export async function completeNotificationJob(params: {
  jobId: string;
  status: 'sent' | 'failed' | 'dead';
  error?: string;
}): Promise<void> {
  await query(
    `
      UPDATE notification_jobs
      SET
        status = $2,
        last_error = $3,
        processed_at = CASE WHEN $2 = 'sent' OR $2 = 'dead' THEN NOW() ELSE processed_at END,
        updated_at = NOW()
      WHERE id = $1
    `,
    [params.jobId, params.status, params.error?.slice(0, 2000) ?? null],
  );
}

export async function listNotificationJobRecipients(jobId: string): Promise<NotificationRecipientRecord[]> {
  const result = await query<NotificationRecipientRow>(
    `
      SELECT
        id,
        job_id,
        workspace_id,
        user_id,
        email,
        status,
        attempts,
        last_error,
        sent_at,
        created_at
      FROM notification_job_recipients
      WHERE job_id = $1
      ORDER BY created_at ASC
    `,
    [jobId],
  );

  return result.rows.map(mapNotificationRecipient);
}

export async function upsertIdeaScoringInput(params: {
  workspaceId: string;
  ideaId: string;
  updatedBy: string;
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  revenuePotentialUsd: number;
  customerSegment?: string | null;
  customerCount?: number;
}): Promise<void> {
  await query(
    `
      INSERT INTO idea_scoring_inputs (
        workspace_id,
        idea_id,
        reach,
        impact,
        confidence,
        effort,
        revenue_potential_usd,
        customer_segment,
        customer_count,
        updated_by,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (workspace_id, idea_id)
      DO UPDATE
      SET
        reach = EXCLUDED.reach,
        impact = EXCLUDED.impact,
        confidence = EXCLUDED.confidence,
        effort = EXCLUDED.effort,
        revenue_potential_usd = EXCLUDED.revenue_potential_usd,
        customer_segment = EXCLUDED.customer_segment,
        customer_count = EXCLUDED.customer_count,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    `,
    [
      params.workspaceId,
      params.ideaId,
      params.reach,
      params.impact,
      params.confidence,
      params.effort,
      params.revenuePotentialUsd,
      params.customerSegment ?? null,
      Math.max(0, params.customerCount ?? 0),
      params.updatedBy,
    ],
  );
}

export async function listIdeaAnalytics(params: {
  workspaceId: string;
  boardId?: string;
  status?: IdeaStatus;
  customerSegment?: string;
  limit?: number;
}): Promise<IdeaAnalyticsRecord[]> {
  const clampedLimit = Math.max(1, Math.min(params.limit ?? 200, 400));
  const result = await query<IdeaAnalyticsRow>(
    `
      SELECT
        i.id AS idea_id,
        i.board_id,
        i.title,
        i.status,
        i.moderation_state,
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
        COALESCE(inp.reach, 0) AS reach,
        COALESCE(inp.impact, 0) AS impact,
        COALESCE(inp.confidence, 0) AS confidence,
        COALESCE(inp.effort, 1) AS effort,
        CASE
          WHEN COALESCE(inp.effort, 0) <= 0 THEN 0
          ELSE (COALESCE(inp.reach, 0) * COALESCE(inp.impact, 0) * COALESCE(inp.confidence, 0)) / COALESCE(inp.effort, 1)
        END AS rice_score,
        COALESCE(inp.revenue_potential_usd, 0) AS revenue_potential_usd,
        inp.customer_segment,
        COALESCE(inp.customer_count, 0) AS customer_count,
        COALESCE(
          ARRAY(
            SELECT DISTINCT audience.email
            FROM (
              SELECT u.email
              FROM users u
              JOIN idea_votes iv ON iv.user_id = u.id
              WHERE iv.workspace_id = i.workspace_id AND iv.idea_id = i.id
              UNION
              SELECT u.email
              FROM users u
              JOIN idea_comments ic ON ic.user_id = u.id
              WHERE ic.workspace_id = i.workspace_id AND ic.idea_id = i.id AND ic.active = TRUE
            ) AS audience
            ORDER BY audience.email
          ),
          ARRAY[]::text[]
        ) AS contact_emails
      FROM ideas i
      LEFT JOIN idea_scoring_inputs inp
        ON inp.workspace_id = i.workspace_id AND inp.idea_id = i.id
      WHERE i.workspace_id = $1
        AND ($2::text IS NULL OR i.board_id = $2)
        AND ($3::text IS NULL OR i.status = $3)
        AND ($4::text IS NULL OR inp.customer_segment = $4)
      ORDER BY
        CASE
          WHEN COALESCE(inp.effort, 0) <= 0 THEN 0
          ELSE (COALESCE(inp.reach, 0) * COALESCE(inp.impact, 0) * COALESCE(inp.confidence, 0)) / COALESCE(inp.effort, 1)
        END DESC,
        COALESCE(inp.revenue_potential_usd, 0) DESC,
        i.created_at DESC
      LIMIT $5
    `,
    [
      params.workspaceId,
      params.boardId ?? null,
      params.status ?? null,
      params.customerSegment ?? null,
      clampedLimit,
    ],
  );

  return result.rows.map((row) => ({
    ideaId: row.idea_id,
    boardId: row.board_id,
    title: row.title,
    status: row.status,
    moderationState: row.moderation_state,
    voteCount: Number(row.vote_count),
    commentCount: Number(row.comment_count),
    reach: Number(row.reach),
    impact: Number(row.impact),
    confidence: Number(row.confidence),
    effort: Number(row.effort),
    riceScore: Number(row.rice_score),
    revenuePotentialUsd: Number(row.revenue_potential_usd),
    customerSegment: row.customer_segment,
    customerCount: Number(row.customer_count),
    contactEmails: row.contact_emails ?? [],
  }));
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

/* ── Board Settings ── */

export type PortalAccessMode = 'public' | 'link_only' | 'private' | 'domain_restricted';

export interface BoardSettingsRecord {
  boardId: string;
  accessMode: PortalAccessMode;
  allowedDomains: string[];
  allowedEmails: string[];
  requireAuthToVote: boolean;
  requireAuthToComment: boolean;
  requireAuthToSubmit: boolean;
  allowAnonymousIdeas: boolean;
  customLogoUrl: string | null;
  customAccentColor: string | null;
  portalTitle: string | null;
  showVoteCount: boolean;
  showStatusFilter: boolean;
  showCategoryFilter: boolean;
  enableIdeaSubmission: boolean;
  enableCommenting: boolean;
  welcomeMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BoardSettingsRow {
  board_id: string;
  access_mode: PortalAccessMode;
  allowed_domains: string[];
  allowed_emails: string[];
  require_auth_to_vote: boolean;
  require_auth_to_comment: boolean;
  require_auth_to_submit: boolean;
  allow_anonymous_ideas: boolean;
  custom_logo_url: string | null;
  custom_accent_color: string | null;
  portal_title: string | null;
  show_vote_count: boolean;
  show_status_filter: boolean;
  show_category_filter: boolean;
  enable_idea_submission: boolean;
  enable_commenting: boolean;
  welcome_message: string | null;
  created_at: string;
  updated_at: string;
}

function mapBoardSettings(row: BoardSettingsRow): BoardSettingsRecord {
  return {
    boardId: row.board_id,
    accessMode: row.access_mode,
    allowedDomains: row.allowed_domains ?? [],
    allowedEmails: row.allowed_emails ?? [],
    requireAuthToVote: row.require_auth_to_vote,
    requireAuthToComment: row.require_auth_to_comment,
    requireAuthToSubmit: row.require_auth_to_submit,
    allowAnonymousIdeas: row.allow_anonymous_ideas,
    customLogoUrl: row.custom_logo_url,
    customAccentColor: row.custom_accent_color,
    portalTitle: row.portal_title,
    showVoteCount: row.show_vote_count,
    showStatusFilter: row.show_status_filter,
    showCategoryFilter: row.show_category_filter,
    enableIdeaSubmission: row.enable_idea_submission,
    enableCommenting: row.enable_commenting,
    welcomeMessage: row.welcome_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const defaultBoardSettings: BoardSettingsRecord = {
  boardId: '',
  accessMode: 'public',
  allowedDomains: [],
  allowedEmails: [],
  requireAuthToVote: false,
  requireAuthToComment: true,
  requireAuthToSubmit: true,
  allowAnonymousIdeas: false,
  customLogoUrl: null,
  customAccentColor: null,
  portalTitle: null,
  showVoteCount: true,
  showStatusFilter: true,
  showCategoryFilter: true,
  enableIdeaSubmission: true,
  enableCommenting: true,
  welcomeMessage: null,
  createdAt: '',
  updatedAt: '',
};

export async function getBoardSettings(boardId: string): Promise<BoardSettingsRecord> {
  const result = await query<BoardSettingsRow>(
    `SELECT * FROM board_settings WHERE board_id = $1 LIMIT 1`,
    [boardId],
  );

  if ((result.rowCount ?? 0) === 0) {
    return { ...defaultBoardSettings, boardId };
  }

  return mapBoardSettings(result.rows[0]);
}

export async function upsertBoardSettings(params: {
  boardId: string;
  accessMode?: PortalAccessMode;
  allowedDomains?: string[];
  allowedEmails?: string[];
  requireAuthToVote?: boolean;
  requireAuthToComment?: boolean;
  requireAuthToSubmit?: boolean;
  allowAnonymousIdeas?: boolean;
  customLogoUrl?: string | null;
  customAccentColor?: string | null;
  portalTitle?: string | null;
  showVoteCount?: boolean;
  showStatusFilter?: boolean;
  showCategoryFilter?: boolean;
  enableIdeaSubmission?: boolean;
  enableCommenting?: boolean;
  welcomeMessage?: string | null;
}): Promise<BoardSettingsRecord> {
  const result = await query<BoardSettingsRow>(
    `
      INSERT INTO board_settings (
        board_id, access_mode, allowed_domains, allowed_emails,
        require_auth_to_vote, require_auth_to_comment, require_auth_to_submit,
        allow_anonymous_ideas, custom_logo_url, custom_accent_color,
        portal_title, show_vote_count, show_status_filter, show_category_filter,
        enable_idea_submission, enable_commenting, welcome_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (board_id) DO UPDATE SET
        access_mode = COALESCE($2, board_settings.access_mode),
        allowed_domains = COALESCE($3, board_settings.allowed_domains),
        allowed_emails = COALESCE($4, board_settings.allowed_emails),
        require_auth_to_vote = COALESCE($5, board_settings.require_auth_to_vote),
        require_auth_to_comment = COALESCE($6, board_settings.require_auth_to_comment),
        require_auth_to_submit = COALESCE($7, board_settings.require_auth_to_submit),
        allow_anonymous_ideas = COALESCE($8, board_settings.allow_anonymous_ideas),
        custom_logo_url = COALESCE($9, board_settings.custom_logo_url),
        custom_accent_color = COALESCE($10, board_settings.custom_accent_color),
        portal_title = COALESCE($11, board_settings.portal_title),
        show_vote_count = COALESCE($12, board_settings.show_vote_count),
        show_status_filter = COALESCE($13, board_settings.show_status_filter),
        show_category_filter = COALESCE($14, board_settings.show_category_filter),
        enable_idea_submission = COALESCE($15, board_settings.enable_idea_submission),
        enable_commenting = COALESCE($16, board_settings.enable_commenting),
        welcome_message = COALESCE($17, board_settings.welcome_message),
        updated_at = NOW()
      RETURNING *
    `,
    [
      params.boardId,
      params.accessMode ?? 'public',
      params.allowedDomains ?? [],
      params.allowedEmails ?? [],
      params.requireAuthToVote ?? false,
      params.requireAuthToComment ?? true,
      params.requireAuthToSubmit ?? true,
      params.allowAnonymousIdeas ?? false,
      params.customLogoUrl ?? null,
      params.customAccentColor ?? null,
      params.portalTitle ?? null,
      params.showVoteCount ?? true,
      params.showStatusFilter ?? true,
      params.showCategoryFilter ?? true,
      params.enableIdeaSubmission ?? true,
      params.enableCommenting ?? true,
      params.welcomeMessage ?? null,
    ],
  );

  return mapBoardSettings(result.rows[0]);
}

/* ── Portal Users & Sessions ── */

export interface PortalUserRecord {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  authProvider: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PortalUserRow {
  id: string;
  email: string;
  display_name: string | null;
  password_hash: string | null;
  avatar_url: string | null;
  auth_provider: string;
  provider_id: string | null;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

function mapPortalUser(row: PortalUserRow): PortalUserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    authProvider: row.auth_provider,
    emailVerified: row.email_verified,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createPortalUser(params: {
  email: string;
  displayName?: string;
  passwordHash?: string;
  authProvider?: string;
  providerId?: string;
}): Promise<PortalUserRecord> {
  const id = uuidv4();
  const result = await query<PortalUserRow>(
    `
      INSERT INTO portal_users (id, email, display_name, password_hash, auth_provider, provider_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      id,
      params.email.toLowerCase().trim(),
      params.displayName ?? null,
      params.passwordHash ?? null,
      params.authProvider ?? 'email',
      params.providerId ?? null,
    ],
  );

  return mapPortalUser(result.rows[0]);
}

export async function findPortalUserByEmail(email: string): Promise<{
  user: PortalUserRecord;
  passwordHash: string | null;
} | null> {
  const result = await query<PortalUserRow>(
    `SELECT * FROM portal_users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase().trim()],
  );

  if ((result.rowCount ?? 0) === 0) return null;

  return {
    user: mapPortalUser(result.rows[0]),
    passwordHash: result.rows[0].password_hash,
  };
}

export async function findPortalUserById(userId: string): Promise<PortalUserRecord | null> {
  const result = await query<PortalUserRow>(
    `SELECT * FROM portal_users WHERE id = $1 LIMIT 1`,
    [userId],
  );

  if ((result.rowCount ?? 0) === 0) return null;
  return mapPortalUser(result.rows[0]);
}

export async function createPortalSession(params: {
  userId: string;
  expiresInHours?: number;
}): Promise<{ token: string; expiresAt: string }> {
  const id = uuidv4();
  const token = `ps_${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '')}`;
  const hours = params.expiresInHours ?? 24 * 30; // 30 days default
  const result = await query<{ token: string; expires_at: string }>(
    `
      INSERT INTO portal_sessions (id, user_id, token, expires_at)
      VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour' * $4)
      RETURNING token, expires_at
    `,
    [id, params.userId, token, hours],
  );

  return {
    token: result.rows[0].token,
    expiresAt: result.rows[0].expires_at,
  };
}

export async function findPortalUserByToken(token: string): Promise<PortalUserRecord | null> {
  const result = await query<PortalUserRow>(
    `
      SELECT pu.*
      FROM portal_sessions ps
      JOIN portal_users pu ON pu.id = ps.user_id
      WHERE ps.token = $1 AND ps.expires_at > NOW()
      LIMIT 1
    `,
    [token],
  );

  if ((result.rowCount ?? 0) === 0) return null;
  return mapPortalUser(result.rows[0]);
}

export async function deletePortalSession(token: string): Promise<void> {
  await query(`DELETE FROM portal_sessions WHERE token = $1`, [token]);
}

export async function createPublicIdeaComment(params: {
  workspaceId: string;
  ideaId: string;
  userId: string;
  userEmail: string;
  body: string;
}): Promise<IdeaCommentRecord> {
  // Check if comments are locked
  const ideaResult = await query<{ comments_locked: boolean }>(
    `SELECT comments_locked FROM ideas WHERE id = $1 AND workspace_id = $2`,
    [params.ideaId, params.workspaceId],
  );

  if ((ideaResult.rowCount ?? 0) === 0) {
    throw new Error('idea_not_found');
  }

  if (ideaResult.rows[0].comments_locked) {
    throw new Error('idea_comments_locked');
  }

  // Ensure user exists in the users table (needed for FK)
  await ensureUser({
    userId: params.userId,
    email: params.userEmail,
    displayName: params.userEmail.split('@')[0],
  });

  const id = uuidv4();
  const result = await query<IdeaCommentRow>(
    `
      INSERT INTO idea_comments (id, workspace_id, idea_id, user_id, body)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id, workspace_id, idea_id, user_id,
        (SELECT email FROM users WHERE id = $4) AS user_email,
        body, active, is_official, is_team_member, created_at, updated_at
    `,
    [id, params.workspaceId, params.ideaId, params.userId, params.body],
  );

  return mapIdeaComment(result.rows[0]);
}

/* ── Idea Subscriptions ── */

export async function subscribeToIdea(params: {
  ideaId: string;
  userId: string;
  notifyOn?: string[];
}): Promise<{ ideaId: string; userId: string; notifyOn: string[] }> {
  const notifyOn = params.notifyOn ?? ['status_change', 'official_response', 'new_comment'];
  const result = await query<{ idea_id: string; user_id: string; notify_on: string[] }>(
    `
      INSERT INTO idea_subscriptions (idea_id, user_id, notify_on)
      VALUES ($1, $2, $3)
      ON CONFLICT (idea_id, user_id) DO UPDATE SET notify_on = $3
      RETURNING idea_id, user_id, notify_on
    `,
    [params.ideaId, params.userId, notifyOn],
  );
  const row = result.rows[0];
  return { ideaId: row.idea_id, userId: row.user_id, notifyOn: row.notify_on };
}

export async function unsubscribeFromIdea(params: {
  ideaId: string;
  userId: string;
}): Promise<void> {
  await query(`DELETE FROM idea_subscriptions WHERE idea_id = $1 AND user_id = $2`, [
    params.ideaId,
    params.userId,
  ]);
}

export async function getIdeaSubscription(params: {
  ideaId: string;
  userId: string;
}): Promise<boolean> {
  const result = await query<{ idea_id: string }>(
    `SELECT idea_id FROM idea_subscriptions WHERE idea_id = $1 AND user_id = $2 LIMIT 1`,
    [params.ideaId, params.userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listUserSubscriptions(params: {
  userId: string;
  limit?: number;
  offset?: number;
}): Promise<string[]> {
  const limit = Math.max(1, Math.min(params.limit ?? 100, 200));
  const offset = Math.max(0, params.offset ?? 0);
  const result = await query<{ idea_id: string }>(
    `SELECT idea_id FROM idea_subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [params.userId, limit, offset],
  );
  return result.rows.map((r) => r.idea_id);
}

/* ── Idea Favorites ── */

export async function favoriteIdea(params: {
  ideaId: string;
  userId: string;
}): Promise<{ ideaId: string; userId: string }> {
  await query(
    `INSERT INTO idea_favorites (idea_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [params.ideaId, params.userId],
  );
  return { ideaId: params.ideaId, userId: params.userId };
}

export async function unfavoriteIdea(params: {
  ideaId: string;
  userId: string;
}): Promise<void> {
  await query(`DELETE FROM idea_favorites WHERE idea_id = $1 AND user_id = $2`, [
    params.ideaId,
    params.userId,
  ]);
}

export async function getIdeaFavorite(params: {
  ideaId: string;
  userId: string;
}): Promise<boolean> {
  const result = await query<{ idea_id: string }>(
    `SELECT idea_id FROM idea_favorites WHERE idea_id = $1 AND user_id = $2 LIMIT 1`,
    [params.ideaId, params.userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listUserFavorites(params: {
  userId: string;
  limit?: number;
  offset?: number;
}): Promise<string[]> {
  const limit = Math.max(1, Math.min(params.limit ?? 100, 200));
  const offset = Math.max(0, params.offset ?? 0);
  const result = await query<{ idea_id: string }>(
    `SELECT idea_id FROM idea_favorites WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [params.userId, limit, offset],
  );
  return result.rows.map((r) => r.idea_id);
}

/* ── User Profile & Activity ── */

export async function updatePortalUserProfile(params: {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
}): Promise<PortalUserRecord | null> {
  const result = await query<PortalUserRow>(
    `
      UPDATE portal_users
      SET
        display_name = COALESCE($2, display_name),
        avatar_url = COALESCE($3, avatar_url),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [params.userId, params.displayName ?? null, params.avatarUrl ?? null],
  );

  if ((result.rowCount ?? 0) === 0) return null;
  return mapPortalUser(result.rows[0]);
}

export async function listUserIdeas(params: {
  userId: string;
  limit?: number;
  offset?: number;
}): Promise<{ id: string; title: string; status: string; voteCount: number; createdAt: string }[]> {
  const limit = Math.max(1, Math.min(params.limit ?? 50, 200));
  const offset = Math.max(0, params.offset ?? 0);
  const result = await query<{
    id: string;
    title: string;
    status: string;
    vote_count: string | number;
    created_at: string;
  }>(
    `
      SELECT i.id, i.title, i.status,
        COALESCE((SELECT COUNT(*) FROM idea_votes iv WHERE iv.idea_id = i.id), 0)::int AS vote_count,
        i.created_at
      FROM ideas i
      WHERE i.created_by = $1 AND i.active = TRUE
      ORDER BY i.created_at DESC
      LIMIT $2 OFFSET $3
    `,
    [params.userId, limit, offset],
  );
  return result.rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    voteCount: Number(r.vote_count),
    createdAt: r.created_at,
  }));
}

export async function listUserVotedIdeas(params: {
  userId: string;
  limit?: number;
  offset?: number;
}): Promise<{ id: string; title: string; status: string; voteCount: number; createdAt: string }[]> {
  const limit = Math.max(1, Math.min(params.limit ?? 50, 200));
  const offset = Math.max(0, params.offset ?? 0);
  const result = await query<{
    id: string;
    title: string;
    status: string;
    vote_count: string | number;
    created_at: string;
  }>(
    `
      SELECT i.id, i.title, i.status,
        COALESCE((SELECT COUNT(*) FROM idea_votes iv WHERE iv.idea_id = i.id), 0)::int AS vote_count,
        i.created_at
      FROM ideas i
      JOIN idea_votes v ON v.idea_id = i.id AND v.user_id = $1
      WHERE i.active = TRUE
      ORDER BY v.created_at DESC
      LIMIT $2 OFFSET $3
    `,
    [params.userId, limit, offset],
  );
  return result.rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    voteCount: Number(r.vote_count),
    createdAt: r.created_at,
  }));
}

/* ── Changelog Entries ── */

export interface ChangelogEntryRecord {
  id: string;
  workspaceId: string;
  boardId: string | null;
  title: string;
  body: string;
  entryType: 'feature' | 'improvement' | 'bugfix' | 'announcement';
  relatedIdeaIds: string[];
  publishedAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface ChangelogEntryRow {
  id: string;
  workspace_id: string;
  board_id: string | null;
  title: string;
  body: string;
  entry_type: 'feature' | 'improvement' | 'bugfix' | 'announcement';
  related_idea_ids: string[];
  published_at: string | null;
  created_by: string | null;
  created_at: string;
}

function mapChangelogEntry(row: ChangelogEntryRow): ChangelogEntryRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    boardId: row.board_id,
    title: row.title,
    body: row.body,
    entryType: row.entry_type,
    relatedIdeaIds: row.related_idea_ids ?? [],
    publishedAt: row.published_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function createChangelogEntry(params: {
  workspaceId: string;
  boardId?: string;
  title: string;
  body: string;
  entryType: 'feature' | 'improvement' | 'bugfix' | 'announcement';
  relatedIdeaIds?: string[];
  publishedAt?: string;
  createdBy?: string;
}): Promise<ChangelogEntryRecord> {
  const id = uuidv4();
  const result = await query<ChangelogEntryRow>(
    `
      INSERT INTO changelog_entries (id, workspace_id, board_id, title, body, entry_type, related_idea_ids, published_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      id,
      params.workspaceId,
      params.boardId ?? null,
      params.title,
      params.body,
      params.entryType,
      params.relatedIdeaIds ?? [],
      params.publishedAt ?? new Date().toISOString(),
      params.createdBy ?? null,
    ],
  );
  return mapChangelogEntry(result.rows[0]);
}

export async function listChangelogEntries(params: {
  workspaceId: string;
  boardId?: string;
  limit?: number;
  offset?: number;
}): Promise<ChangelogEntryRecord[]> {
  const limit = Math.max(1, Math.min(params.limit ?? 50, 200));
  const offset = Math.max(0, params.offset ?? 0);
  const result = await query<ChangelogEntryRow>(
    `
      SELECT * FROM changelog_entries
      WHERE workspace_id = $1
        AND ($2::text IS NULL OR board_id = $2)
        AND published_at IS NOT NULL
      ORDER BY published_at DESC
      LIMIT $3 OFFSET $4
    `,
    [params.workspaceId, params.boardId ?? null, limit, offset],
  );
  return result.rows.map(mapChangelogEntry);
}

/* ── Threaded Comments ── */

export interface ThreadedCommentRecord {
  id: string;
  workspaceId: string;
  ideaId: string;
  userId: string;
  userEmail: string;
  body: string;
  active: boolean;
  isOfficial: boolean;
  isTeamMember: boolean;
  parentCommentId: string | null;
  upvoteCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ThreadedCommentRow {
  id: string;
  workspace_id: string;
  idea_id: string;
  user_id: string;
  user_email: string;
  body: string;
  active: boolean;
  is_official: boolean;
  is_team_member: boolean;
  parent_comment_id: string | null;
  upvote_count: number;
  created_at: string;
  updated_at: string;
}

function mapThreadedComment(row: ThreadedCommentRow): ThreadedCommentRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    ideaId: row.idea_id,
    userId: row.user_id,
    userEmail: row.user_email,
    body: row.body,
    active: row.active,
    isOfficial: row.is_official,
    isTeamMember: row.is_team_member,
    parentCommentId: row.parent_comment_id,
    upvoteCount: Number(row.upvote_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listThreadedComments(params: {
  workspaceId: string;
  ideaId: string;
}): Promise<ThreadedCommentRecord[]> {
  const result = await query<ThreadedCommentRow>(
    `
      SELECT
        c.id, c.workspace_id, c.idea_id, c.user_id,
        u.email AS user_email,
        c.body, c.active, c.is_official, c.is_team_member,
        c.parent_comment_id, c.upvote_count,
        c.created_at, c.updated_at
      FROM idea_comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.workspace_id = $1 AND c.idea_id = $2 AND c.active = TRUE
      ORDER BY c.created_at ASC
    `,
    [params.workspaceId, params.ideaId],
  );
  return result.rows.map(mapThreadedComment);
}

export async function createThreadedComment(params: {
  workspaceId: string;
  ideaId: string;
  userId: string;
  userEmail: string;
  body: string;
  parentCommentId?: string;
}): Promise<ThreadedCommentRecord> {
  // Check if comments are locked
  const ideaResult = await query<{ comments_locked: boolean }>(
    `SELECT comments_locked FROM ideas WHERE id = $1 AND workspace_id = $2`,
    [params.ideaId, params.workspaceId],
  );

  if ((ideaResult.rowCount ?? 0) === 0) {
    throw new Error('idea_not_found');
  }

  if (ideaResult.rows[0].comments_locked) {
    throw new Error('idea_comments_locked');
  }

  await ensureUser({
    userId: params.userId,
    email: params.userEmail,
    displayName: params.userEmail.split('@')[0],
  });

  const id = uuidv4();
  const result = await query<ThreadedCommentRow>(
    `
      INSERT INTO idea_comments (id, workspace_id, idea_id, user_id, body, parent_comment_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id, workspace_id, idea_id, user_id,
        (SELECT email FROM users WHERE id = $4) AS user_email,
        body, active, is_official, is_team_member, parent_comment_id, upvote_count,
        created_at, updated_at
    `,
    [id, params.workspaceId, params.ideaId, params.userId, params.body, params.parentCommentId ?? null],
  );

  return mapThreadedComment(result.rows[0]);
}

/* ── Comment Upvotes ── */

export async function upvoteComment(params: {
  commentId: string;
  userId: string;
}): Promise<{ commentId: string; upvoteCount: number }> {
  return withTransaction(async (client) => {
    await client.query(
      `INSERT INTO comment_upvotes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [params.commentId, params.userId],
    );
    const result = await client.query<{ upvote_count: number }>(
      `
        UPDATE idea_comments
        SET upvote_count = (SELECT COUNT(*) FROM comment_upvotes WHERE comment_id = $1)
        WHERE id = $1
        RETURNING upvote_count
      `,
      [params.commentId],
    );
    return {
      commentId: params.commentId,
      upvoteCount: Number(result.rows[0]?.upvote_count ?? 0),
    };
  });
}

export async function removeCommentUpvote(params: {
  commentId: string;
  userId: string;
}): Promise<{ commentId: string; upvoteCount: number }> {
  return withTransaction(async (client) => {
    await client.query(
      `DELETE FROM comment_upvotes WHERE comment_id = $1 AND user_id = $2`,
      [params.commentId, params.userId],
    );
    const result = await client.query<{ upvote_count: number }>(
      `
        UPDATE idea_comments
        SET upvote_count = (SELECT COUNT(*) FROM comment_upvotes WHERE comment_id = $1)
        WHERE id = $1
        RETURNING upvote_count
      `,
      [params.commentId],
    );
    return {
      commentId: params.commentId,
      upvoteCount: Number(result.rows[0]?.upvote_count ?? 0),
    };
  });
}

/* ── Password Reset ── */

export async function createPasswordResetToken(params: {
  userId: string;
  userEmail: string;
  expiresInMinutes?: number;
}): Promise<{ token: string; expiresAt: string }> {
  const id = uuidv4();
  const token = `prt_${uuidv4().replace(/-/g, '')}`;
  const minutes = params.expiresInMinutes ?? 60;
  const result = await query<{ token: string; expires_at: string }>(
    `
      INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
      VALUES ($1, $2, $3, NOW() + INTERVAL '1 minute' * $4)
      RETURNING token, expires_at
    `,
    [id, params.userId, token, minutes],
  );

  const portalAppUrl = process.env.VITE_APP_URL || 'http://localhost:3000/portal';
  const resetLink = `${portalAppUrl}/auth/reset-password?token=${token}`;

  await createNotificationJob({
    eventType: 'auth.reset_password',
    templateId: 'auth_reset_password_v1',
    payload: {
      userId: params.userId,
      resetLink,
    },
    recipients: [{ userId: params.userId, email: params.userEmail }],
  });
  return {
    token: result.rows[0].token,
    expiresAt: result.rows[0].expires_at,
  };
}

export async function findPasswordResetToken(token: string): Promise<{
  userId: string;
  expiresAt: string;
  used: boolean;
} | null> {
  const result = await query<{ user_id: string; expires_at: string; used: boolean }>(
    `SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = $1 LIMIT 1`,
    [token],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  return {
    userId: result.rows[0].user_id,
    expiresAt: result.rows[0].expires_at,
    used: result.rows[0].used,
  };
}

export async function markResetTokenUsed(token: string): Promise<void> {
  await query(`UPDATE password_reset_tokens SET used = true WHERE token = $1`, [token]);
}

export async function updatePortalUserPassword(params: {
  userId: string;
  passwordHash: string;
}): Promise<void> {
  await query(
    `UPDATE portal_users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [params.passwordHash, params.userId],
  );
}

/* ── Board Settings Extended (branding) ── */

export interface BoardSettingsExtendedRecord extends BoardSettingsRecord {
  customCss: string | null;
  faviconUrl: string | null;
  headerBgColor: string | null;
  fontFamily: string | null;
  hidePoweredBy: boolean;
}

export async function getBoardSettingsExtended(boardId: string): Promise<BoardSettingsExtendedRecord> {
  const result = await query<BoardSettingsRow & {
    custom_css: string | null;
    favicon_url: string | null;
    header_bg_color: string | null;
    font_family: string | null;
    hide_powered_by: boolean;
  }>(
    `SELECT * FROM board_settings WHERE board_id = $1 LIMIT 1`,
    [boardId],
  );

  if ((result.rowCount ?? 0) === 0) {
    return {
      ...defaultBoardSettings,
      boardId,
      customCss: null,
      faviconUrl: null,
      headerBgColor: null,
      fontFamily: null,
      hidePoweredBy: false,
    };
  }

  const row = result.rows[0];
  return {
    ...mapBoardSettings(row),
    customCss: row.custom_css ?? null,
    faviconUrl: row.favicon_url ?? null,
    headerBgColor: row.header_bg_color ?? null,
    fontFamily: row.font_family ?? null,
    hidePoweredBy: row.hide_powered_by ?? false,
  };
}

export async function updateBoardSettings(params: {
  boardId: string;
  customAccentColor?: string | null;
  customLogoUrl?: string | null;
  headerBgColor?: string | null;
  customCss?: string | null;
  fontFamily?: string | null;
  hidePoweredBy?: boolean;
}): Promise<BoardSettingsExtendedRecord> {
  let updateParts: string[] = [];
  let values: unknown[] = [params.boardId];
  let idx = 2;

  if (params.customAccentColor !== undefined) {
    updateParts.push(`custom_accent_color = $${idx++}`);
    values.push(params.customAccentColor);
  }
  if (params.customLogoUrl !== undefined) {
    updateParts.push(`custom_logo_url = $${idx++}`);
    values.push(params.customLogoUrl);
  }
  if (params.headerBgColor !== undefined) {
    updateParts.push(`header_bg_color = $${idx++}`);
    values.push(params.headerBgColor);
  }
  if (params.customCss !== undefined) {
    updateParts.push(`custom_css = $${idx++}`);
    values.push(params.customCss);
  }
  if (params.fontFamily !== undefined) {
    updateParts.push(`font_family = $${idx++}`);
    values.push(params.fontFamily);
  }
  if (params.hidePoweredBy !== undefined) {
    updateParts.push(`hide_powered_by = $${idx++}`);
    values.push(params.hidePoweredBy);
  }

  if (updateParts.length === 0) {
    return getBoardSettingsExtended(params.boardId);
  }

  const result = await query<BoardSettingsExtendedRecord>(
    `
      UPDATE board_settings
      SET ${updateParts.join(', ')}
      WHERE board_id = $1
      RETURNING
        board_id as "boardId",
        access_mode as "accessMode",
        require_auth_to_vote as "requireAuthToVote",
        require_auth_to_comment as "requireAuthToComment",
        require_auth_to_submit as "requireAuthToSubmit",
        allow_anonymous_ideas as "allowAnonymousIdeas",
        enable_idea_submission as "enableIdeaSubmission",
        enable_commenting as "enableCommenting",
        show_vote_count as "showVoteCount",
        show_status_filter as "showStatusFilter",
        show_category_filter as "showCategoryFilter",
        portal_title as "portalTitle",
        welcome_message as "welcomeMessage",
        custom_accent_color as "customAccentColor",
        custom_logo_url as "customLogoUrl",
        header_bg_color as "headerBgColor",
        custom_css as "customCss",
        font_family as "fontFamily",
        hide_powered_by as "hidePoweredBy"
    `,
    values
  );

  return result.rows[0];
}

/* ── Idea Attachments ── */
export interface IdeaAttachmentRecord {
  id: string;
  workspaceId: string;
  boardId: string;
  ideaId: string;
  fileName: string;
  fileUrl: string;
  contentType: string;
  sizeBytes: number;
  createdBy: string | null;
  createdAt: string;
}

export async function insertIdeaAttachment(params: {
  workspaceId: string;
  boardId: string;
  ideaId: string;
  fileName: string;
  fileUrl: string;
  contentType: string;
  sizeBytes: number;
  createdBy?: string;
}): Promise<IdeaAttachmentRecord> {
  const id = uuidv4();
  const result = await query(
    `
      INSERT INTO idea_attachments (
        id, workspace_id, board_id, idea_id, file_name, file_url, content_type, size_bytes, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      id,
      params.workspaceId,
      params.boardId,
      params.ideaId,
      params.fileName,
      params.fileUrl,
      params.contentType,
      params.sizeBytes,
      params.createdBy ?? null,
    ]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    boardId: row.board_id,
    ideaId: row.idea_id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function listIdeaAttachments(params: {
  workspaceId: string;
  ideaId: string;
}): Promise<IdeaAttachmentRecord[]> {
  const result = await query(
    `
      SELECT * FROM idea_attachments 
      WHERE workspace_id = $1 AND idea_id = $2
      ORDER BY created_at ASC
    `,
    [params.workspaceId, params.ideaId]
  );

  return result.rows.map(row => ({
    id: row.id,
    workspaceId: row.workspace_id,
    boardId: row.board_id,
    ideaId: row.idea_id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

/* ── Comment Attachments ── */
export interface CommentAttachmentRecord {
  id: string;
  workspaceId: string;
  boardId: string;
  ideaId: string;
  commentId: string;
  fileName: string;
  fileUrl: string;
  contentType: string;
  sizeBytes: number;
  createdBy: string | null;
  createdAt: string;
}

export async function insertCommentAttachment(params: {
  workspaceId: string;
  boardId: string;
  ideaId: string;
  commentId: string;
  fileName: string;
  fileUrl: string;
  contentType: string;
  sizeBytes: number;
  createdBy?: string;
}): Promise<CommentAttachmentRecord> {
  const id = uuidv4();
  const result = await query(
    `
      INSERT INTO comment_attachments (
        id, workspace_id, board_id, idea_id, comment_id, file_name, file_url, content_type, size_bytes, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [
      id,
      params.workspaceId,
      params.boardId,
      params.ideaId,
      params.commentId,
      params.fileName,
      params.fileUrl,
      params.contentType,
      params.sizeBytes,
      params.createdBy ?? null,
    ]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    boardId: row.board_id,
    ideaId: row.idea_id,
    commentId: row.comment_id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function listCommentAttachments(params: {
  workspaceId: string;
  commentId: string;
}): Promise<CommentAttachmentRecord[]> {
  const result = await query(
    `
      SELECT * FROM comment_attachments 
      WHERE workspace_id = $1 AND comment_id = $2
      ORDER BY created_at ASC
    `,
    [params.workspaceId, params.commentId]
  );

  return result.rows.map(row => ({
    id: row.id,
    workspaceId: row.workspace_id,
    boardId: row.board_id,
    ideaId: row.idea_id,
    commentId: row.comment_id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}
