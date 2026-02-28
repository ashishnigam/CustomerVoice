import { Router } from 'express';
import { z } from 'zod';
import {
  createIdea,
  createIdeaComment,
  findBoard,
  findIdea,
  listIdeaComments,
  listIdeas,
  unvoteIdea,
  updateIdeaStatus,
  voteIdea,
} from '../db/repositories.js';
import { asyncHandler } from '../lib/async-handler.js';
import { emitAudit } from '../lib/audit.js';
import { ideaStatusSchema } from '../lib/types.js';
import { enforceWorkspaceScope, requirePermission, type RequestWithActor } from '../middleware/auth.js';

const createIdeaSchema = z.object({
  title: z.string().min(4).max(180),
  description: z.string().min(8).max(8000),
});

const ideaListQuerySchema = z.object({
  status: ideaStatusSchema.optional(),
  search: z.string().max(120).optional(),
  includeInactive: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const statusUpdateSchema = z.object({
  status: ideaStatusSchema,
});

const commentCreateSchema = z.object({
  body: z.string().trim().min(2).max(4000),
});

const commentListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(300).optional(),
});

export const ideasRouter = Router();

ideasRouter.use(enforceWorkspaceScope);

ideasRouter.get(
  '/workspaces/:workspaceId/boards/:boardId/ideas',
  requirePermission('idea:read'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.params.workspaceId);
    const boardId = String(req.params.boardId);
    const actor = (req as RequestWithActor).actor;

    const board = await findBoard({ workspaceId, boardId });
    if (!board || !board.active) {
      res.status(404).json({ error: 'board_not_found' });
      return;
    }

    const parsed = ideaListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
      return;
    }

    const items = await listIdeas({
      workspaceId,
      boardId,
      status: parsed.data.status,
      search: parsed.data.search,
      includeInactive: parsed.data.includeInactive,
      limit: parsed.data.limit,
      viewerId: actor?.userId,
    });

    res.status(200).json({ items });
  }),
);

ideasRouter.post(
  '/workspaces/:workspaceId/boards/:boardId/ideas',
  requirePermission('idea:write'),
  asyncHandler(async (req, res) => {
    const parsed = createIdeaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const workspaceId = String(req.params.workspaceId);
    const boardId = String(req.params.boardId);
    const actor = (req as RequestWithActor).actor;

    if (!actor) {
      res.status(401).json({ error: 'actor_required' });
      return;
    }

    const board = await findBoard({ workspaceId, boardId });
    if (!board || !board.active) {
      res.status(404).json({ error: 'board_not_found' });
      return;
    }

    const idea = await createIdea({
      workspaceId,
      boardId,
      title: parsed.data.title.trim(),
      description: parsed.data.description.trim(),
      createdBy: actor.userId,
    });

    await emitAudit(req, 'idea.create', {
      boardId,
      ideaId: idea.id,
      status: idea.status,
    });

    res.status(201).json(idea);
  }),
);

ideasRouter.get(
  '/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId',
  requirePermission('idea:read'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.params.workspaceId);
    const boardId = String(req.params.boardId);
    const ideaId = String(req.params.ideaId);
    const actor = (req as RequestWithActor).actor;

    const idea = await findIdea({
      workspaceId,
      boardId,
      ideaId,
      viewerId: actor?.userId,
    });

    if (!idea) {
      res.status(404).json({ error: 'idea_not_found' });
      return;
    }

    res.status(200).json(idea);
  }),
);

ideasRouter.patch(
  '/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/status',
  requirePermission('idea:status:write'),
  asyncHandler(async (req, res) => {
    const parsed = statusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const workspaceId = String(req.params.workspaceId);
    const boardId = String(req.params.boardId);
    const ideaId = String(req.params.ideaId);
    const actor = (req as RequestWithActor).actor;

    if (!actor) {
      res.status(401).json({ error: 'actor_required' });
      return;
    }

    const updated = await updateIdeaStatus({
      workspaceId,
      boardId,
      ideaId,
      status: parsed.data.status,
      updatedBy: actor.userId,
      viewerId: actor.userId,
    });

    if (!updated) {
      res.status(404).json({ error: 'idea_not_found' });
      return;
    }

    await emitAudit(req, 'idea.status.update', {
      boardId,
      ideaId,
      status: parsed.data.status,
    });

    res.status(200).json(updated);
  }),
);

ideasRouter.post(
  '/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/votes',
  requirePermission('vote:write'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.params.workspaceId);
    const boardId = String(req.params.boardId);
    const ideaId = String(req.params.ideaId);
    const actor = (req as RequestWithActor).actor;

    if (!actor) {
      res.status(401).json({ error: 'actor_required' });
      return;
    }

    const idea = await findIdea({ workspaceId, boardId, ideaId });
    if (!idea) {
      res.status(404).json({ error: 'idea_not_found' });
      return;
    }

    const vote = await voteIdea({
      workspaceId,
      ideaId,
      userId: actor.userId,
    });

    await emitAudit(req, 'idea.vote', {
      boardId,
      ideaId,
      hasVoted: vote.hasVoted,
    });

    res.status(200).json(vote);
  }),
);

ideasRouter.delete(
  '/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/votes',
  requirePermission('vote:write'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.params.workspaceId);
    const boardId = String(req.params.boardId);
    const ideaId = String(req.params.ideaId);
    const actor = (req as RequestWithActor).actor;

    if (!actor) {
      res.status(401).json({ error: 'actor_required' });
      return;
    }

    const idea = await findIdea({ workspaceId, boardId, ideaId });
    if (!idea) {
      res.status(404).json({ error: 'idea_not_found' });
      return;
    }

    const vote = await unvoteIdea({
      workspaceId,
      ideaId,
      userId: actor.userId,
    });

    await emitAudit(req, 'idea.unvote', {
      boardId,
      ideaId,
      hasVoted: vote.hasVoted,
    });

    res.status(200).json(vote);
  }),
);

ideasRouter.get(
  '/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/comments',
  requirePermission('idea:read'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.params.workspaceId);
    const boardId = String(req.params.boardId);
    const ideaId = String(req.params.ideaId);

    const parsed = commentListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
      return;
    }

    const idea = await findIdea({ workspaceId, boardId, ideaId });
    if (!idea) {
      res.status(404).json({ error: 'idea_not_found' });
      return;
    }

    const items = await listIdeaComments({
      workspaceId,
      ideaId,
      limit: parsed.data.limit,
    });

    res.status(200).json({ items });
  }),
);

ideasRouter.post(
  '/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/comments',
  requirePermission('comment:write'),
  asyncHandler(async (req, res) => {
    const parsed = commentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const workspaceId = String(req.params.workspaceId);
    const boardId = String(req.params.boardId);
    const ideaId = String(req.params.ideaId);
    const actor = (req as RequestWithActor).actor;

    if (!actor) {
      res.status(401).json({ error: 'actor_required' });
      return;
    }

    const idea = await findIdea({ workspaceId, boardId, ideaId });
    if (!idea) {
      res.status(404).json({ error: 'idea_not_found' });
      return;
    }

    const comment = await createIdeaComment({
      workspaceId,
      ideaId,
      userId: actor.userId,
      body: parsed.data.body,
    });

    await emitAudit(req, 'idea.comment.create', {
      boardId,
      ideaId,
      commentId: comment.id,
    });

    res.status(201).json(comment);
  }),
);
