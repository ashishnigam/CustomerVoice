# CustomerVoice Phase 7 Cutover Runbook

Use this runbook before enabling final tenant-only routing and after the production backfill is complete.

## 1. Preconditions

- Phase 7 runtime changes are deployed to API, web, and worker.
- Additive migrations through tenant hardening have been applied.
- Bootstrap or production tenant/domain backfill is complete.
- The automated suites below are green:
  - `pnpm --filter @customervoice/api typecheck`
  - `pnpm --filter @customervoice/api test:integration`
  - `DATABASE_URL=... pnpm --filter @customervoice/api test:integration:db`
  - `pnpm --filter @customervoice/web typecheck`
  - `pnpm --filter @customervoice/worker typecheck`
  - `pnpm --filter @customervoice/e2e typecheck`
  - `DATABASE_URL=... JWT_SECRET=... AUTH_MODE=mock pnpm --filter @customervoice/e2e test:e2e`

## 2. Automated Cutover Audit

Run the Phase 7 audit against the target database:

```bash
DATABASE_URL=postgresql://... pnpm --filter @customervoice/api phase7:cutover:audit
```

The audit must be fully clean before cutover. It checks:

- active boards missing `tenant_id` or `public_board_key`
- legacy board slug collisions across tenants
- active portal sessions missing `tenant_id`
- active SSO connections missing `tenant_id`
- tenant-owned tables with missing `tenant_id`
- persisted public activity missing `tenant_actor_id`

## 3. Redirect Readiness

- Review the audit output for legacy slug collisions.
- Do not rely on legacy `/portal/boards/:slug` or `/public/boards/:slug` compatibility for any slug that resolves to more than one tenant.
- Confirm canonical URLs exist for every active public board:
  - `/portal/t/:tenantKey/boards/:publicBoardKey`
  - `/public/t/:tenantKey/boards/:publicBoardKey`

## 4. Session Invalidation

- Invalidate or revoke any remaining public sessions that do not carry tenant context.
- Verify support/admin impersonation sessions are time-bounded and revocable.
- Verify `/public/auth/logout` clears both portal auth sessions and tenant visitor sessions.

## 5. Cutover Sequence

1. Run migrations and backfill on the target environment.
2. Run the automated cutover audit and resolve any failures.
3. Deploy API, worker, and web together.
4. Smoke-test:
   - enterprise-domain resolution
   - public-email personal tenant registration
   - tenant-aware SSO login
   - legacy portal redirect to canonical tenant route
   - guest access into an enterprise tenant
   - support-admin switch-tenant flow
5. If smoke tests are clean, keep canonical tenant routes as the primary entry path and limit legacy compatibility to unambiguous slugs only.

## 6. Post-Cutover Cleanup

- Review audit events for impersonation, domain verification, and webhook administration.
- Monitor request logs for tenant context and any cross-tenant access denials.
- Monitor worker logs for tenant-scoped webhook dispatch and notification jobs.
- Remove any temporary legacy-route exceptions once collision-free tenant routing is confirmed.

## 7. Rollback Notes

- If the cutover audit fails, do not proceed.
- If runtime regressions appear after deploy, keep additive schema changes in place and roll traffic back to the previous app version rather than attempting destructive schema rollback.
- Re-run the audit after rollback remediation before attempting the cutover again.
