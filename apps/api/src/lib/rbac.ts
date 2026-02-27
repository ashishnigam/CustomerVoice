import { getPermissionOverride } from '../db/repositories.js';
import type { Permission, Role } from './types.js';

const defaultPermissions: Record<Role, Permission[]> = {
  tenant_admin: ['membership:read', 'membership:write', 'audit:read', 'policy:read', 'policy:write'],
  workspace_admin: ['membership:read', 'membership:write', 'audit:read', 'policy:read'],
  product_manager: ['membership:read', 'audit:read'],
  engineering_manager: ['membership:read', 'audit:read'],
  contributor: ['membership:read'],
  viewer: ['membership:read'],
};

export async function can(params: {
  workspaceId: string;
  role: Role;
  permission: Permission;
}): Promise<boolean> {
  const override = await getPermissionOverride({
    workspaceId: params.workspaceId,
    role: params.role,
    permission: params.permission,
  });

  if (override === 'deny') {
    return false;
  }

  if (override === 'allow') {
    return true;
  }

  return defaultPermissions[params.role]?.includes(params.permission) ?? false;
}
