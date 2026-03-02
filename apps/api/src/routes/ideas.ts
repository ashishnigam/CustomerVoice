import { Router } from 'express';
import { z } from 'zod';
import {
  createIdea,
  createIdeaCategory,
  createIdeaComment,
  createNotificationJob,
  findBoard,
  findIdea,
  findIdeaById,
  listIdeaAnalytics,
  listIdeaCategories,
  listIdeaComments,
  listIdeas,
  listModerationIdeas,
  mergeIdeas,
  resolveIdeaAudience,
  setIdeaCategories,
  setIdeaCommentsLocked,
  setIdeaModerationState,
  unvoteIdea,
  updateIdeaCategory,
  updateIdeaStatus,
  upsertIdeaScoringInput,
  voteIdea,
} from '../db/repositories.js';
import { asyncHandler } from '../lib/async-handler.js';
import { emitAudit } from '../lib/audit.js';
import {
  ideaModerationStateSchema,
  ideaStatusSchema,
} from '../lib/types.js';
import { enforceWorkspaceScope, requirePermission, type RequestWithActor } from '../middleware/auth.js';

const ideaSortSchema = z.enum(['top_voted', 'most_commented', 'newest']);

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#?[0-9a-fA-F]{6}$/)
  .transform((value) => (value.startsWith('#') ? value.toUpperCase() : `#${value.toUpperCase()}`));

const createIdeaSchema = z.object({
  title: z.string().min(4).max(180),
  description: z.string().min(8).max(8000),
  categoryIds: z.array(z.string().min(1)).max(20).optional(),
});

const ideaListQuerySchema = z.object({
  status: ideaStatusSchema.optional(),
  moderationState: ideaModerationStateSchema.optional(),
  search: z.string().max(120).optional(),
  includeInactive: z.coerce.boolean().optional(),
  includeModerated: z.coerce.boolean().optional(),
  categoryIds: z.string().max(1200).optional(),
  sort: ideaSortSchema.optional(),
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

const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  colorHex: hexColorSchema.optional(),
});

const updateCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    colorHex: hexColorSchema.nullish(),
    active: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'at least one field is required',
  });

const categoryListQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional(),
});

const setIdeaCategoriesSchema = z.object({
  categoryIds: z.array(z.string().min(1)).max(20),
});

const moderationListQuerySchema = z.object({
  boardId: z.string().optional(),
  moderationState: ideaModerationStateSchema.optional(),
  search: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(300).optional(),
});

const mergeIdeasSchema = z.object({
  sourceIdeaId: z.string().min(1),
  targetIdeaId: z.string().min(1),
});

const markSpamSchema = z.object({
  isSpam: z.boolean(),
});

const lockCommentsSchema = z.object({
  locked: z.boolean(),
});

const moderationBulkSchema = z.object({
  ideaIds: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(['mark_spam', 'restore', 'lock_comments', 'unlock_comments']),
});

const analyticsListQuerySchema = z.object({
  boardId: z.string().optional(),
  status: ideaStatusSchema.optional(),
  customerSegment: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(400).optional(),
  format: z.enum(['json', 'csv']).optional(),
});

const analyticsInputSchema = z.object({
  reach: z.number().min(0).max(10_000_000),
  impact: z.number().min(0).max(1000),
  confidence: z.number().min(0).max(1),
  effort: z.number().min(0.1).max(10000),
  revenuePotentialUsd: z.number().min(0).max(1_000_000_000),
  customerSegment: z.string().max(120).optional(),
  customerCount: z.number().int().min(0).max(10_000_000).optional(),
});

const analyticsOutreachSchema = z.object({
  subject: z.string().trim().min(3).max(180),
  message: z.string().trim().min(5).max(5000),
});

function parseCategoryIds(value?: string): string[] | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  const ids = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return ids.length > 0 ? ids : undefined;
}

function toCsv(items: Array<Record<string, unknown>>): string {
  if (items.length === 0) {
    return '';
  }

  const headers = Array.from(
    new Set(items.flatMap((item) => Object.keys(item))),
  );

  const escapeValue = (value: unknown): string => {
    const text =
      value === null || value === undefined
        ? ''
        : Array.isArray(value)
          ? value.join(';')
          : String(value);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };

  const rows = [headers.join(',')];
  for (const item of items) {
    rows.push(headers.map((header) => escapeValue(item[header])).join(','));
  }

  return rows.join('\n');
}

export const ideasRouter = Router();

ideasRouter.use(enforceWorkspaceScope);

ideasRouter.get(
  '/workspaces/:workspaceId/categories',
  requirePermission('category:read'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.params.workspaceId);
    const parsed = categoryListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
      return;
    }

    const items = await listIdeaCategories({
      workspaceId,
      includeInactive: parsed.data.includeInactive,
    });

    res.status(200).json({ items });
  }),
);

ideasRouter.post(
  '/workspaces/:workspaceId/categories',
  requirePermission('category:write'),
  asyncHandler(async (req, res) => {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const workspaceId = String(req.params.workspaceId);
    const actor = (req as RequestWithActor).actor;
    if (!actor) {
      res.status(401).json({ error: 'actor_required' });
      return;
    }

    const category = await createIdeaCategory({
      workspaceId,
      name: parsed.data.name,
      colorHex: parsed.data.colorHex,
      createdBy: actor.userId,
    });

    await emitAudit(req, 'idea.category.create', {
      categoryId: category.id,
      categoryName: category.name,
    });

    res.status(201).json(category);
  }),
);

ideasRouter.patch(
  '/workspaces/:workspaceId/categories/:categoryId',
  requirePermission('category:write'),
  asyncHandler(async (req, res) => {
    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const workspaceId = String(req.params.workspaceId);
    const categoryId = String(req.params.categoryId);

    const updated = await updateIdeaCategory({
      workspaceId,
      categoryId,
      name: parsed.data.name,
      colorHex: parsed.data.colorHex,
      active: parsed.data.active,
    });

    if (!updated) {
      res.status(404).json({ error: 'category_not_found' });
      return;
    }

    await emitAudit(req, 'idea.category.update', {
      categoryId,
      fields: Object.keys(parsed.data),
    });

    res.status(200).json(updated);
  }),
);

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
      moderationState: parsed.data.moderationState,
      search: parsed.data.search,
      includeInactive: parsed.data.includeInactive,
      includeModerated: parsed.data.includeModerated,
      categoryIds: parseCategoryIds(parsed.data.categoryIds),
      sort: parsed.data.sort,
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
      categoryIds: parsed.data.categoryIds,
      createdBy: actor.userId,
    });

    await emitAudit(req, 'idea.create', {
      boardId,
      ideaId: idea.id,
      status: idea.status,
      categoryIds: idea.categoryIds,
    });

    res.status(201).json(idea);
  }),
);

ideasRouter.put(
  '/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/categories',
  requirePermission('idea:write'),
  asyncHandler(async (req, res) => {
    const parsed = setIdeaCategoriesSchema.safeParse(req.body);
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

    const existing = await findIdea({
      workspaceId,
      boardId,
      ideaId,
      viewerId: actor.userId,
    });

    if (!existing) {
      res.status(404).json({ error: 'idea_not_found' });
      return;
    }

    await setIdeaCategories({
      workspaceId,
      ideaId,
      categoryIds: parsed.data.categoryIds,
    });

    const updated = await findIdea({
      workspaceId,
      boardId,
      ideaId,
      viewerId: actor.userId,
    });

    await emitAudit(req, 'idea.categories.update', {
      boardId,
      ideaId,
      categoryIds: parsed.data.categoryIds,
    });

    res.status(200).json(updated);
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

    const before = await findIdea({
      workspaceId,
      boardId,
      ideaId,
      viewerId: actor.userId,
    });
    if (!before) {
      res.status(404).json({ error: 'idea_not_found' });
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

    let recipientCount = 0;
    if (before.status !== 'completed' && parsed.data.status === 'completed') {
      const audience = await resolveIdeaAudience({ workspaceId, ideaId });
      recipientCount = audience.length;

      await createNotificationJob({
        workspaceId,
        boardId,
        ideaId,
        eventType: 'idea.completed',
        templateId: 'idea_completed_v1',
        createdBy: actor.userId,
        recipients: audience,
        payload: {
          ideaTitle: updated.title,
          boardId,
          status: updated.status,
          triggeredBy: actor.userId,
        },
      });
    }

    await emitAudit(req, 'idea.status.update', {
      boardId,
      ideaId,
      status: parsed.data.status,
      recipientCount,
      templateId: parsed.data.status === 'completed' ? 'idea_completed_v1' : null,
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

    try {
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
    } catch (error) {
      if (error instanceof Error && error.message === 'idea_comments_locked') {
        res.status(409).json({ error: 'idea_comments_locked' });
        return;
      }

      throw error;
    }
  }),
);

ideasRouter.get(
  '/workspaces/:workspaceId/moderation/ideas',
  requirePermission('moderation:write'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.params.workspaceId);
    const parsed = moderationListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
      return;
    }

    const items = await listModerationIdeas({
      workspaceId,
      boardId: parsed.data.boardId,
      moderationState: parsed.data.moderationState,
      search: parsed.data.search,
      limit: parsed.data.limit,
    });

    res.status(200).json({ items });
  }),
);

ideasRouter.post(
  '/workspaces/:workspaceId/moderation/ideas/merge',
  requirePermission('moderation:write'),
  asyncHandler(async (req, res) => {
    const parsed = mergeIdeasSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const workspaceId = String(req.params.workspaceId);
    const actor = (req as RequestWithActor).actor;
    if (!actor) {
      res.status(401).json({ error: 'actor_required' });
      return;
    }

    try {
      const merged = await mergeIdeas({
        workspaceId,
        sourceIdeaId: parsed.data.sourceIdeaId,
        targetIdeaId: parsed.data.targetIdeaId,
        updatedBy: actor.userId,
      });

      if (!merged) {
        res.status(404).json({ error: 'idea_not_found' });
        return;
      }

      await emitAudit(req, 'idea.moderation.merge', {
        sourceIdeaId: parsed.data.sourceIdeaId,
        targetIdeaId: parsed.data.targetIdeaId,
      });

      res.status(200).json(merged);
    } catch (error) {
      if (error instanceof Error && error.message === 'merge_requires_same_board') {
        res.status(400).json({ error: 'merge_requires_same_board' });
        return;
      }
      if (error instanceof Error && error.message === 'merge_target_must_differ') {
        res.status(400).json({ error: 'merge_target_must_differ' });
        return;
      }
      throw error;
    }
  }),
);

ideasRouter.patch(
  '/workspaces/:workspaceId/moderation/ideas/:ideaId/spam',
  requirePermission('moderation:write'),
  asyncHandler(async (req, res) => {
    const parsed = markSpamSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const workspaceId = String(req.params.workspaceId);
    const ideaId = String(req.params.ideaId);
    const actor = (req as RequestWithActor).actor;
    if (!actor) {
      res.status(401).json({ error: 'actor_required' });
      return;
    }

    const idea = await findIdeaById({ workspaceId, ideaId, viewerId: actor.userId });
    if (!idea) {
      res.status(404).json({ error: 'idea_not_found' });
      return;
    }

    const updated = await setIdeaModerationState({
      workspaceId,
      boardId: idea.boardId,
      ideaId,
      moderationState: parsed.data.isSpam ? 'spam' : 'normal',
      active: parsed.data.isSpam ? false : true,
      updatedBy: actor.userId,
    });

    await emitAudit(req, 'idea.moderation.spam', {
      ideaId,
      isSpam: parsed.data.isSpam,
    });

    res.status(200).json(updated);
  }),
);

ideasRouter.patch(
  '/workspaces/:workspaceId/moderation/ideas/:ideaId/comments-lock',
  requirePermission('moderation:write'),
  asyncHandler(async (req, res) => {
    const parsed = lockCommentsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const workspaceId = String(req.params.workspaceId);
    const ideaId = String(req.params.ideaId);
    const actor = (req as RequestWithActor).actor;
    if (!actor) {
      res.status(401).json({ error: 'actor_required' });
      return;
    }

    const idea = await findIdeaById({ workspaceId, ideaId, viewerId: actor.userId });
    if (!idea) {
      res.status(404).json({ error: 'idea_not_found' });
      return;
    }

    const updated = await setIdeaCommentsLocked({
      workspaceId,
      boardId: idea.boardId,
      ideaId,
      commentsLocked: parsed.data.locked,
      updatedBy: actor.userId,
    });

    await emitAudit(req, 'idea.moderation.comments_lock', {
      ideaId,
      locked: parsed.data.locked,
    });

    res.status(200).json(updated);
  }),
);

ideasRouter.post(
  '/workspaces/:workspaceId/moderation/ideas/bulk',
  requirePermission('moderation:write'),
  asyncHandler(async (req, res) => {
    const parsed = moderationBulkSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const workspaceId = String(req.params.workspaceId);
    const actor = (req as RequestWithActor).actor;
    if (!actor) {
      res.status(401).json({ error: 'actor_required' });
      return;
    }

    const processed: string[] = [];
    const skipped: Array<{ ideaId: string; reason: string }> = [];

    for (const ideaId of parsed.data.ideaIds) {
      const idea = await findIdeaById({ workspaceId, ideaId, viewerId: actor.userId });
      if (!idea) {
        skipped.push({ ideaId, reason: 'idea_not_found' });
        continue;
      }

      switch (parsed.data.action) {
        case 'mark_spam':
          await setIdeaModerationState({
            workspaceId,
            boardId: idea.boardId,
            ideaId,
            moderationState: 'spam',
            active: false,
            updatedBy: actor.userId,
          });
          break;
        case 'restore':
          await setIdeaModerationState({
            workspaceId,
            boardId: idea.boardId,
            ideaId,
            moderationState: 'normal',
            active: true,
            updatedBy: actor.userId,
          });
          break;
        case 'lock_comments':
          await setIdeaCommentsLocked({
            workspaceId,
            boardId: idea.boardId,
            ideaId,
            commentsLocked: true,
            updatedBy: actor.userId,
          });
          break;
        case 'unlock_comments':
          await setIdeaCommentsLocked({
            workspaceId,
            boardId: idea.boardId,
            ideaId,
            commentsLocked: false,
            updatedBy: actor.userId,
          });
          break;
        default:
          skipped.push({ ideaId, reason: 'unsupported_action' });
          continue;
      }

      processed.push(ideaId);
    }

    await emitAudit(req, 'idea.moderation.bulk', {
      action: parsed.data.action,
      processedCount: processed.length,
      skippedCount: skipped.length,
    });

    res.status(200).json({
      action: parsed.data.action,
      processed,
      skipped,
    });
  }),
);

ideasRouter.get(
  '/workspaces/:workspaceId/analytics/ideas',
  requirePermission('analytics:read'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.params.workspaceId);
    const parsed = analyticsListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
      return;
    }

    const items = await listIdeaAnalytics({
      workspaceId,
      boardId: parsed.data.boardId,
      status: parsed.data.status,
      customerSegment: parsed.data.customerSegment,
      limit: parsed.data.limit,
    });

    if (parsed.data.format === 'csv') {
      const csv = toCsv(
        items.map((item) => ({
          ideaId: item.ideaId,
          boardId: item.boardId,
          title: item.title,
          status: item.status,
          moderationState: item.moderationState,
          voteCount: item.voteCount,
          commentCount: item.commentCount,
          reach: item.reach,
          impact: item.impact,
          confidence: item.confidence,
          effort: item.effort,
          riceScore: item.riceScore,
          revenuePotentialUsd: item.revenuePotentialUsd,
          customerSegment: item.customerSegment,
          customerCount: item.customerCount,
          contactEmails: item.contactEmails,
        })),
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="idea-analytics.csv"');
      res.status(200).send(csv);
      return;
    }

    res.status(200).json({ items });
  }),
);

ideasRouter.put(
  '/workspaces/:workspaceId/analytics/ideas/:ideaId/input',
  requirePermission('analytics:write'),
  asyncHandler(async (req, res) => {
    const parsed = analyticsInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const workspaceId = String(req.params.workspaceId);
    const ideaId = String(req.params.ideaId);
    const actor = (req as RequestWithActor).actor;
    if (!actor) {
      res.status(401).json({ error: 'actor_required' });
      return;
    }

    const idea = await findIdeaById({ workspaceId, ideaId, viewerId: actor.userId });
    if (!idea) {
      res.status(404).json({ error: 'idea_not_found' });
      return;
    }

    await upsertIdeaScoringInput({
      workspaceId,
      ideaId,
      updatedBy: actor.userId,
      reach: parsed.data.reach,
      impact: parsed.data.impact,
      confidence: parsed.data.confidence,
      effort: parsed.data.effort,
      revenuePotentialUsd: parsed.data.revenuePotentialUsd,
      customerSegment: parsed.data.customerSegment,
      customerCount: parsed.data.customerCount,
    });

    await emitAudit(req, 'idea.analytics.input.upsert', {
      ideaId,
      boardId: idea.boardId,
    });

    res.status(204).send();
  }),
);

ideasRouter.post(
  '/workspaces/:workspaceId/analytics/ideas/:ideaId/outreach',
  requirePermission('analytics:write'),
  asyncHandler(async (req, res) => {
    const parsed = analyticsOutreachSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }

    const workspaceId = String(req.params.workspaceId);
    const ideaId = String(req.params.ideaId);
    const actor = (req as RequestWithActor).actor;
    if (!actor) {
      res.status(401).json({ error: 'actor_required' });
      return;
    }

    const idea = await findIdeaById({ workspaceId, ideaId, viewerId: actor.userId });
    if (!idea) {
      res.status(404).json({ error: 'idea_not_found' });
      return;
    }

    const audience = await resolveIdeaAudience({ workspaceId, ideaId });
    const job = await createNotificationJob({
      workspaceId,
      boardId: idea.boardId,
      ideaId,
      eventType: 'analytics.outreach',
      templateId: 'analytics_outreach_v1',
      createdBy: actor.userId,
      recipients: audience,
      payload: {
        subject: parsed.data.subject,
        message: parsed.data.message,
        ideaTitle: idea.title,
      },
    });

    await emitAudit(req, 'idea.analytics.outreach.enqueue', {
      ideaId,
      boardId: idea.boardId,
      recipientCount: audience.length,
      notificationJobId: job.id,
    });

    res.status(201).json({
      notificationJobId: job.id,
      recipientCount: audience.length,
    });
  }),
);
