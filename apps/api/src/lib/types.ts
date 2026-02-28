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

export type Role = (typeof roleValues)[number];
export type Permission = (typeof permissionValues)[number];
export type PermissionEffect = 'allow' | 'deny';
export type IdeaStatus = (typeof ideaStatusValues)[number];

export const roleSchema = z.enum(roleValues);
export const permissionSchema = z.enum(permissionValues);
export const ideaStatusSchema = z.enum(ideaStatusValues);
