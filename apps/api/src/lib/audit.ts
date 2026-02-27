import type { Request } from 'express';
import { createAuditEvent } from '../db/repositories.js';
import type { RequestWithActor } from '../middleware/auth.js';

export async function emitAudit(
  req: Request,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const request = req as RequestWithActor;
  const workspaceValue =
    request.actor?.workspaceId ??
    (typeof req.params.workspaceId === 'string' ? req.params.workspaceId : null);
  const actorId = request.actor?.userId ?? null;

  if (!workspaceValue || !actorId) {
    return;
  }

  await createAuditEvent({
    workspaceId: workspaceValue,
    actorId,
    action,
    metadata,
  });
}
