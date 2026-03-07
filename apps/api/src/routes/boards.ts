import { Router } from 'express';
import { z } from 'zod';
import { createBoard, findBoard, listBoards, updateBoard, workspaceExists, updateBoardSettings } from '../db/repositories.js';
import { asyncHandler } from '../lib/async-handler.js';
import { emitAudit } from '../lib/audit.js';
import { booleanQueryParam } from '../lib/query-schemas.js';
import { enforceWorkspaceScope, requirePermission, type RequestWithActor } from '../middleware/auth.js';

const visibilitySchema = z.enum(['public', 'private']);
const portalAccessModeSchema = z.enum(['public', 'link_only', 'private', 'domain_restricted']);

const createBoardSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  visibility: visibilitySchema.default('public'),
});

const updateBoardSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    visibility: visibilitySchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'at least one field is required',
  });

const updateBoardSettingsSchema = z
  .object({
    accessMode: portalAccessModeSchema.optional(),
    allowedDomains: z.array(z.string().trim().min(1)).max(50).optional(),
    allowedEmails: z.array(z.string().email()).max(200).optional(),
    requireAuthToVote: z.boolean().optional(),
    requireAuthToComment: z.boolean().optional(),
    requireAuthToSubmit: z.boolean().optional(),
    allowAnonymousIdeas: z.boolean().optional(),
    portalTitle: z.string().max(180).nullable().optional(),
    showVoteCount: z.boolean().optional(),
    showStatusFilter: z.boolean().optional(),
    showCategoryFilter: z.boolean().optional(),
    enableIdeaSubmission: z.boolean().optional(),
    enableCommenting: z.boolean().optional(),
    welcomeMessage: z.string().max(4000).nullable().optional(),
    customAccentColor: z.string().nullable().optional(),
    customLogoUrl: z.string().nullable().optional(),
    headerBgColor: z.string().nullable().optional(),
    customCss: z.string().nullable().optional(),
    fontFamily: z.string().nullable().optional(),
    hidePoweredBy: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'at least one field is required',
  });

const listQuerySchema = z.object({
  includeInactive: booleanQueryParam.optional(),
});

const createChangelogSchema = z.object({
  title: z.string().min(3).max(180),
  body: z.string().min(5).max(8000),
  entryType: z.enum(['feature', 'improvement', 'bugfix']),
  publishedAt: z.string().datetime().optional()
});

export const boardsRouter = Router();

boardsRouter.use(enforceWorkspaceScope);

boardsRouter.get(
  '/workspaces/:workspaceId/boards',
  requirePermission('board:read'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.params.workspaceId);
    if (!(await workspaceExists(workspaceId))) {
      res.status(404).json({ error: 'workspace_not_found' });
      return;
    }

    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
      return;
    }

    const items = await listBoards({
      workspaceId,
      includeInactive: parsed.data.includeInactive ?? false,
    });
    res.status(200).json({ items });
  }),
);

boardsRouter.get(
  '/workspaces/:workspaceId/boards/:boardId',
  requirePermission('board:read'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.params.workspaceId);
    const boardId = String(req.params.boardId);
    const board = await findBoard({ workspaceId, boardId });

    if (!board) {
      res.status(404).json({ error: 'board_not_found' });
      return;
    }

    res.status(200).json(board);
  }),
);

boardsRouter.post(
  '/workspaces/:workspaceId/boards',
  requirePermission('board:write'),
  asyncHandler(async (req, res) => {
    const parsed = createBoardSchema.safeParse(req.body);
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

    const board = await createBoard({
      workspaceId,
      name: parsed.data.name,
      description: parsed.data.description,
      visibility: parsed.data.visibility,
      createdBy: actor.userId,
    });

    await emitAudit(req, 'board.create', {
      boardId: board.id,
      visibility: board.visibility,
    });

    res.status(201).json(board);
  }),
);

boardsRouter.patch(
  '/workspaces/:workspaceId/boards/:boardId',
  requirePermission('board:write'),
  asyncHandler(async (req, res) => {
    const parsed = updateBoardSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const workspaceId = String(req.params.workspaceId);
    const boardId = String(req.params.boardId);
    const updated = await updateBoard({
      workspaceId,
      boardId,
      name: parsed.data.name,
      description: parsed.data.description,
      visibility: parsed.data.visibility,
      active: parsed.data.active,
    });

    if (!updated) {
      res.status(404).json({ error: 'board_not_found' });
      return;
    }

    await emitAudit(req, 'board.update', {
      boardId: updated.id,
      fields: Object.keys(parsed.data),
    });

    res.status(200).json(updated);
  }),
);

boardsRouter.patch(
  '/workspaces/:workspaceId/boards/:boardId/settings',
  requirePermission('board:write'),
  asyncHandler(async (req, res) => {
    const parsed = updateBoardSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const boardId = String(req.params.boardId);
    // Note: workspaceId must match the board, verify the board actually exists in this workspace
    const workspaceId = String(req.params.workspaceId);
    const board = await findBoard({ workspaceId, boardId });
    if (!board) {
      res.status(404).json({ error: 'board_not_found' });
      return;
    }

    const updatedSettings = await updateBoardSettings({
      boardId,
      accessMode: parsed.data.accessMode,
      allowedDomains: parsed.data.allowedDomains,
      allowedEmails: parsed.data.allowedEmails,
      requireAuthToVote: parsed.data.requireAuthToVote,
      requireAuthToComment: parsed.data.requireAuthToComment,
      requireAuthToSubmit: parsed.data.requireAuthToSubmit,
      allowAnonymousIdeas: parsed.data.allowAnonymousIdeas,
      portalTitle: parsed.data.portalTitle,
      showVoteCount: parsed.data.showVoteCount,
      showStatusFilter: parsed.data.showStatusFilter,
      showCategoryFilter: parsed.data.showCategoryFilter,
      enableIdeaSubmission: parsed.data.enableIdeaSubmission,
      enableCommenting: parsed.data.enableCommenting,
      welcomeMessage: parsed.data.welcomeMessage,
      customAccentColor: parsed.data.customAccentColor,
      customLogoUrl: parsed.data.customLogoUrl,
      headerBgColor: parsed.data.headerBgColor,
      customCss: parsed.data.customCss,
      fontFamily: parsed.data.fontFamily,
      hidePoweredBy: parsed.data.hidePoweredBy,
    });

    await emitAudit(req, 'board.settings.update', {
      boardId,
      fields: Object.keys(parsed.data),
    });

    res.status(200).json(updatedSettings);
  }),
);

boardsRouter.post(
  '/workspaces/:workspaceId/boards/:boardId/changelogs',
  requirePermission('board:write'), // Admin right for boards covers changelogs
  asyncHandler(async (req, res) => {
    const parsed = createChangelogSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const { createChangelogEntry } = await import('../db/repositories.js');

    const workspaceId = String(req.params.workspaceId);
    const boardId = String(req.params.boardId);

    // Make sure actor exists
    const actor = (req as RequestWithActor).actor;
    if (!actor) {
      res.status(401).json({ error: 'actor_required' });
      return;
    }

    const board = await findBoard({ workspaceId, boardId });
    if (!board) {
      res.status(404).json({ error: 'board_not_found' });
      return;
    }

    const entry = await createChangelogEntry({
      workspaceId,
      boardId,
      title: parsed.data.title,
      body: parsed.data.body,
      entryType: parsed.data.entryType,
      createdBy: actor.userId,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt).toISOString() : new Date().toISOString()
    });

    await emitAudit(req, 'board.changelog.create', {
      boardId,
      entryId: entry.id,
    });

    res.status(201).json(entry);
  })
);
