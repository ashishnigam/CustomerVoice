import { z } from 'zod';

export const roleValues = [
  'tenant_admin',
  'workspace_admin',
  'product_manager',
  'engineering_manager',
  'contributor',
  'viewer',
] as const;

export const permissionValues = [
  'board:read',
  'board:write',
  'idea:read',
  'idea:write',
  'idea:status:write',
  'vote:write',
  'comment:write',
  'category:read',
  'category:write',
  'moderation:write',
  'analytics:read',
  'analytics:write',
  'membership:read',
  'membership:write',
  'audit:read',
  'policy:read',
  'policy:write',
] as const;

export const ideaStatusValues = [
  'new',
  'under_review',
  'accepted',
  'planned',
  'in_progress',
  'completed',
  'declined',
] as const;

export const ideaModerationStateValues = ['normal', 'spam', 'merged'] as const;

export type Role = (typeof roleValues)[number];
export type Permission = (typeof permissionValues)[number];
export type PermissionEffect = 'allow' | 'deny';
export type IdeaStatus = (typeof ideaStatusValues)[number];
export type IdeaModerationState = (typeof ideaModerationStateValues)[number];

export const roleSchema = z.enum(roleValues);
export const permissionSchema = z.enum(permissionValues);
export const ideaStatusSchema = z.enum(ideaStatusValues);
export const ideaModerationStateSchema = z.enum(ideaModerationStateValues);
