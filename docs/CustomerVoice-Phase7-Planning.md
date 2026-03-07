# CustomerVoice Phase 7 Plan (Locked)

Last updated: 2026-03-08

## 1. Decision Locked
Phase 7 is now dedicated to one outcome only: make CustomerVoice a true multi-tenant product.

That means:
1. Enterprise tenants are resolved by verified company domain.
2. Public email providers such as Gmail, Outlook, and Yahoo do not become shared tenants.
3. A public-email user gets an individual personal tenant by default.
4. Workspaces remain a child boundary inside a tenant, not the primary tenancy boundary.
5. All other previously discussed Phase 7 feature work moves to Phase 8.

Phase 7 also absorbs the immediate correctness issues that directly block tenant hardening:
- restricted-board enforcement gaps
- public auth and SSO callback correctness
- enterprise access UX gaps around login entry and tenant resolution

## 2. Target Operating Model
CustomerVoice will operate with the following tenancy rules:

### 2.1 Enterprise tenant
- One tenant owns one or more verified company domains.
- The external resolver is the verified domain, but the internal system key remains an immutable `tenant_id`.
- Multiple domains may belong to one tenant for alias, acquisition, or regional cases.
- SSO configuration belongs to the tenant, not to a single workspace.

### 2.2 Personal tenant
- If a user signs up with a public email provider, the system creates a dedicated personal tenant for that user.
- Personal tenants are single-owner by default.
- Personal-tenant users may still be invited into enterprise tenants as guests.

### 2.3 Workspace model
- A tenant can own one or more workspaces.
- Workspace authorization always sits inside an already-resolved tenant context.
- Public board lookup, SSO lookup, and session lookup must all resolve the tenant before workspace or board access is granted.

## 3. Current Structural Gaps
The current codebase is tenant-capable in schema shape but not tenant-hard in runtime behavior.

Key gaps:
1. Public identity is global today (`portal_users`, `portal_sessions`) instead of tenant-aware.
2. Internal auth carries `workspaceId` but not `tenantId`.
3. Public boards are looked up globally by slug.
4. SSO connections are looked up globally by domain.
5. Public-route access rules are board-aware, but not yet part of a tenant-first identity model.

## 4. Phase 7 Scope
Phase 7 is split into six concrete workstreams.

### Workstream 0: Correctness Gate
Goal:
- Close the correctness gaps that would make tenant hardening unsafe.

Required changes:
- Enforce restricted-board access consistently across all public routes, including settings and stream endpoints.
- Fix public auth and SSO callback flows so they work end-to-end with deterministic tenant resolution.
- Make enterprise login entry points explicit in the portal UX.
- Add regression tests for restricted-board access and tenant resolution behavior.

### Workstream 1: Tenant and Domain Foundation
Goal:
- Make tenant ownership and domain ownership explicit in the data model.

Required changes:
- Extend `tenants` with tenant type and lifecycle state.
- Introduce verified domain ownership records.
- Mark public email provider domains as personal-tenant resolvers rather than enterprise-tenant resolvers.
- Add tenant-scoped indexes and lookup paths for domain, workspace, board, and SSO resolution.

### Workstream 2: Tenant-Aware Identity and Session Model
Goal:
- Remove global public identity behavior and make both internal and public sessions tenant-aware.

Required changes:
- Add tenant context to public user records and sessions.
- Add tenant context to internal auth context and authorization middleware.
- Ensure a portal user belongs to exactly one home tenant, while still allowing guest access into enterprise tenants where needed.
- Ensure internal workspace actors cannot cross tenant boundaries even if they know another workspace ID.

### Workstream 3: Tenant-Aware Public Routing and Board Access
Goal:
- Make every public request resolve through a tenant before board lookup.

Required changes:
- Replace global board-slug lookup with tenant-aware lookup.
- Add tenant-aware public route structure.
- Preserve backward compatibility through redirects or transitional lookup only during migration.
- Make public SSE, comments, votes, subscriptions, favorites, and changelog endpoints tenant-aware.

### Workstream 4: Enterprise Domain and SSO Administration
Goal:
- Give enterprise tenants a usable control plane for identity ownership.

Required changes:
- Add domain claim and verification flow.
- Move SSO configuration ownership from workspace-scoped administration to tenant-scoped administration.
- Support invite and guest behavior for users whose email domain does not match the enterprise tenant.
- Add tenant admin UX for domain ownership, verification status, and SSO readiness.

### Workstream 5: Data Migration and Backward Compatibility
Goal:
- Move existing data safely without breaking current boards or sessions.

Required changes:
- Backfill every existing workspace into an explicit tenant model.
- Backfill board and SSO ownership into tenant-scoped structures.
- Migrate public users into tenant-aware records.
- Run dual-read or dual-write compatibility until cutover is complete.
- Add redirects from old public routes to tenant-aware routes during the transition window.

### Workstream 6: Quality Gate and Release Cutover
Goal:
- Prove tenant boundaries cannot be bypassed.

Required changes:
- Integration coverage for cross-tenant access denial.
- E2E coverage for enterprise-domain signup and SSO resolution.
- E2E coverage for personal-tenant signup with public email providers.
- Regression coverage for guest access into enterprise tenants.
- Release checklist for session invalidation, redirect readiness, and post-cutover cleanup.

## 5. Concrete Schema Changes
Phase 7 should be implemented as additive migrations first, then constraint tightening after backfill.

### 5.1 Migration 014: tenant_domain_foundation
Changes:
- Alter `tenants` to add:
  - `tenant_type` (`enterprise`, `personal`)
  - `status` (`active`, `pending_setup`, `suspended`)
  - `primary_domain` nullable
  - `updated_at`
- Create `tenant_domains`:
  - `id`
  - `tenant_id`
  - `domain`
  - `is_primary`
  - `domain_kind` (`enterprise`, `public_email_provider`, `alias`)
  - `verification_status` (`pending`, `verified`, `failed`, `blocked`)
  - `verification_method` (`dns_txt`, `email`, `manual`, `system`)
  - `verification_token`
  - `verified_at`
  - `active`
- Add unique index on normalized `domain`.

### 5.2 Migration 015: tenant_scope_backfill_columns
Changes:
- Add `tenant_id` to tenant-owned tables that are frequently resolved or audited:
  - `workspaces`
  - `boards`
  - `ideas`
  - `idea_comments`
  - `idea_votes`
  - `idea_categories`
  - `changelog_entries`
  - `webhooks`
  - `notification_jobs`
  - `notification_job_recipients`
  - `sso_connections`
- Backfill `tenant_id` from existing workspace ownership.
- Add tenant-scoped indexes for high-volume lookup paths.

### 5.3 Migration 016: public_identity_multitenant
Changes:
- Alter `portal_users`:
  - add `tenant_id`
  - add `account_type` (`personal_owner`, `enterprise_member`, `guest`)
  - add `home_domain`
  - replace global unique email with tenant-scoped uniqueness
- Alter `portal_sessions`:
  - add `tenant_id`
  - add optional `workspace_id`
  - add index on `(tenant_id, token)`
- Alter `idea_subscriptions` and `idea_favorites`:
  - add `tenant_id`
  - backfill from related idea or user

### 5.4 Migration 017: internal_tenant_membership_hardening
Changes:
- Add `tenant_id` to `users`.
- Create `tenant_memberships`:
  - `tenant_id`
  - `user_id`
  - `role` (`tenant_admin`, `tenant_member`, `tenant_guest`)
  - `status`
  - `invited_by`
  - `created_at`
- Tighten `workspace_memberships` validation so workspace tenant and user tenant cannot diverge.

### 5.5 Migration 018: tenant_public_routing_support
Changes:
- Add a tenant-facing lookup key if needed for public routes, such as `tenant_slug` or `tenant_public_key`.
- Ensure public boards can be resolved by `(tenant_id, board_slug)` instead of global slug.
- Remove reliance on global `slug LIKE ...` board fallback after migration.

## 6. Concrete API Changes

### 6.1 New tenant-resolution APIs
Add:
- `POST /public/tenant/resolve`
  - input: email or domain
  - output: tenant resolution result, login options, personal-tenant fallback
- `GET /public/tenant/:tenantKey`
  - returns public tenant metadata required for login and public board routing

### 6.2 New tenant domain administration APIs
Add:
- `GET /tenants/:tenantId/domains`
- `POST /tenants/:tenantId/domains`
- `POST /tenants/:tenantId/domains/:domainId/verify`
- `PATCH /tenants/:tenantId/domains/:domainId`
- `DELETE /tenants/:tenantId/domains/:domainId`

These endpoints own:
- domain claim
- verification status
- alias management
- public-email-provider blocking rules

### 6.3 Public auth API changes
Change:
- `POST /public/auth/register`
- `POST /public/auth/login`
- `GET /public/auth/me`
- `POST /public/auth/logout`

New behavior:
- registration resolves the tenant first
- public-domain emails create a personal tenant if none exists
- enterprise emails resolve to a verified enterprise tenant or fail into an explicit invite/setup path
- sessions return tenant context, not just user context

### 6.4 Public portal route changes
Replace global public routes such as:
- `/public/boards/:boardSlug`

With tenant-aware routes such as:
- `/public/t/:tenantKey/boards/:boardSlug`
- `/public/t/:tenantKey/boards/:boardSlug/ideas`
- `/public/t/:tenantKey/boards/:boardSlug/stream`

Transitional support:
- old routes redirect or resolve temporarily through a compatibility layer
- final cutover removes global board lookup

### 6.5 SSO API changes
Change:
- move SSO connection administration from workspace scope to tenant scope
- change login resolution from raw domain lookup to tenant-owned verified domain lookup

Target endpoints:
- `GET /auth/sso/login?tenant=:tenantKey`
- `ALL /auth/sso/callback?tenant=:tenantKey`
- `GET /tenants/:tenantId/sso-connections`
- `POST /tenants/:tenantId/sso-connections`
- `PATCH /tenants/:tenantId/sso-connections/:connectionId`

### 6.6 Internal API enforcement changes
Keep existing workspace routes if desired, but add tenant enforcement:
- request actor must carry `tenantId`
- middleware must reject cross-tenant workspace access before permission checks run
- board, webhook, changelog, moderation, and analytics routes must verify workspace tenant ownership consistently

## 7. Migration Order
The safest migration order is:

1. Ship additive schema only.
   - add new columns, new tables, and new indexes
   - do not remove old constraints yet

2. Backfill tenant metadata.
   - classify existing tenants as `enterprise`
   - create `tenant_domains` from existing SSO domains, board access rules, and known seed data
   - mark public email provider domains as reserved non-enterprise domains

3. Backfill tenant ownership onto existing records.
   - populate `tenant_id` across workspaces, boards, ideas, comments, votes, categories, webhooks, changelogs, and notifications

4. Backfill public identity.
   - resolve each `portal_user` into a tenant
   - create personal tenants for public-email users
   - attach existing sessions, subscriptions, and favorites to the new tenant context

5. Backfill internal identity.
   - attach `users` to tenant ownership
   - create `tenant_memberships`
   - validate that every workspace membership is internally consistent

6. Ship dual-read and dual-write compatibility.
   - write both legacy and new tenant-aware fields
   - read from tenant-aware paths first, fall back only where necessary

7. Switch public routes and SSO resolution.
   - release tenant-aware public URLs
   - redirect legacy URLs
   - move SSO lookup to tenant-owned domain resolution only

8. Tighten constraints and remove legacy behavior.
   - enforce tenant-scoped uniqueness rules
   - remove global board lookup
   - remove global SSO domain lookup
   - invalidate legacy sessions that do not carry tenant context

## 8. Phase 8 Scope (Moved Out)
All non-tenancy roadmap work now moves to Phase 8.

That includes:
- Stripe billing and subscriptions
- plans, entitlements, and commercial packaging
- CI/CD expansion and broader production automation polish
- full-text search and SEO work
- richer prioritization formulas and scenario modeling
- advanced analytics and success reporting
- white-label package depth beyond minimum tenant/domain ownership
- beta cohort targeting and invite workflows
- embed-specific productization for GoodHealth.ai and GoodWealth.ai
- AI workflow pipeline work that was previously sitting in later buckets

## 9. Phase 7 Exit Criteria
Phase 7 is complete only when all of the following are true:
1. Every public request resolves to exactly one tenant before board access is evaluated.
2. Enterprise users are mapped through verified tenant domain ownership.
3. Public-email users receive individual personal tenants automatically.
4. SSO lookup cannot resolve outside the owning tenant.
5. Internal workspace routes reject all cross-tenant access attempts.
6. Restricted-board coverage exists for list, detail, settings, and stream paths.
7. Legacy public routes are redirected or retired without breaking active boards.
8. Documentation and operator UX clearly reflect the new tenant model.
