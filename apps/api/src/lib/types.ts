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
  'membership:read',
  'membership:write',
  'audit:read',
  'policy:read',
  'policy:write',
] as const;

export type Role = (typeof roleValues)[number];
export type Permission = (typeof permissionValues)[number];
export type PermissionEffect = 'allow' | 'deny';

export const roleSchema = z.enum(roleValues);
export const permissionSchema = z.enum(permissionValues);
