export type ResidencyZone = 'US' | 'EU' | 'IN';

export interface WorkspaceRef {
  tenantId: string;
  workspaceId: string;
}

export interface ActorContext extends WorkspaceRef {
  userId: string;
  role:
    | 'tenant_admin'
    | 'workspace_admin'
    | 'product_manager'
    | 'engineering_manager'
    | 'contributor'
    | 'viewer';
}
