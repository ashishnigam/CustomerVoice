import { Router } from 'express';
import { z } from 'zod';
import { createBoard, findBoard, listBoards, updateBoard, workspaceExists } from '../db/repositories.js';
import { asyncHandler } from '../lib/async-handler.js';
import { emitAudit } from '../lib/audit.js';
import { enforceWorkspaceScope, requirePermission, type RequestWithActor } from '../middleware/auth.js';

const visibilitySchema = z.enum(['public', 'private']);

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

const listQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional(),
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
