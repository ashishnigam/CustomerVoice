import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from './client.js';

function boolFromEnv(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

export async function runBootstrapSeed(): Promise<void> {
  if (!boolFromEnv(process.env.ENABLE_BOOTSTRAP_SEED, false)) {
    return;
  }

  const tenantId = process.env.SEED_TENANT_ID ?? uuidv4();
  const workspaceId = process.env.SEED_WORKSPACE_ID ?? uuidv4();
  const userId = process.env.SEED_USER_ID ?? uuidv4();
  const userEmail = process.env.SEED_USER_EMAIL ?? 'admin@customervoice.local';
  const tenantSlug = process.env.SEED_TENANT_SLUG ?? 'customervoice-demo';
  const workspaceSlug = process.env.SEED_WORKSPACE_SLUG ?? 'default';

  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO tenants (id, name, slug)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
      `,
      [tenantId, 'CustomerVoice Demo Tenant', tenantSlug],
    );

    await client.query(
      `
        INSERT INTO workspaces (id, tenant_id, name, slug, residency_zone, active)
        VALUES ($1, $2, $3, $4, 'US', TRUE)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, active = TRUE
      `,
      [workspaceId, tenantId, 'Default Workspace', workspaceSlug],
    );

    await client.query(
      `
        INSERT INTO users (id, email, display_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()
      `,
      [userId, userEmail, 'Bootstrap Admin'],
    );

    await client.query(
      `
        INSERT INTO workspace_memberships (workspace_id, user_id, role, active, invited_by)
        VALUES ($1, $2, 'workspace_admin', TRUE, $2)
        ON CONFLICT (workspace_id, user_id)
        DO UPDATE SET role = EXCLUDED.role, active = TRUE, updated_at = NOW()
      `,
      [workspaceId, userId],
    );
  });

  console.log(
    `[seed] bootstrap workspace ready workspace_id=${workspaceId} user_id=${userId} email=${userEmail}`,
  );
}
