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
- Public board identity must be unambiguous inside a tenant. Internal board slugs may remain workspace-scoped, but every publicly addressable board must also have a tenant-wide unique `public_board_key`.

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
- Protect tenant stability against noisy neighbors.

Required changes:

- Enforce restricted-board access consistently across all public routes, including settings and stream endpoints.
- Fix public auth and SSO callback flows so they work end-to-end with deterministic tenant resolution.
- Make enterprise login entry points explicit in the portal UX.
- Introduce tenant-aware rate limiting (API, Webhooks, SSE) bucketed by `tenant_id` to prevent single-tenant disruptions.
- Add regression tests for restricted-board access and tenant resolution behavior.

### Workstream 1: Tenant and Domain Foundation

Goal:

- Make tenant ownership and domain ownership explicit in the data model.

Required changes:

- Extend `tenants` with tenant type, lifecycle state, and basic feature flags capability.
- Introduce verified domain ownership records.
- Explicitly separate Identity Domains (used for SSO/routing) from Routing Domains (CNAMEs, e.g., feedback.acmecorp.com). If Custom Routing Domains are not in Phase 7 scope, explicitly defer to Phase 8.
- Mark public email provider domains as personal-tenant resolvers rather than enterprise-tenant resolvers.
- Add tenant-scoped indexes and lookup paths for domain, workspace, board, and SSO resolution.

### Workstream 2: Tenant-Aware Identity and Session Model

Goal:

- Remove global public identity behavior and make both internal and public sessions tenant-aware while supporting cross-tenant access.

Required changes:

- Introduce one persisted actor model for product activity. Public ideas, votes, comments, subscriptions, favorites, and visitor actions must resolve to a tenant-scoped actor record rather than continuing to write through ad hoc `users(id)` fallbacks.
- The actor model must cover `internal_user`, `portal_user`, `visitor`, and `system` actor types so internal/team-authored public content uses the same tenant-safe persistence model as portal traffic.
- Introduce a junction table (e.g., `portal_tenant_profiles`) to link globally unique `portal_users` to specific tenants, allowing a user to maintain tenant-specific profiles instead of enforcing strict tenant-scoped email uniqueness (which forces multiple passwords).
- Clearly define cross-tenant guest identity flow (how a user from a personal tenant authenticates to vote/comment on an enterprise board).
- Replace the current global anonymous fallback with tenant-scoped visitor identities and sessions. No anonymous action may rely on a shared cross-tenant visitor ID.
- Define visitor lifecycle explicitly: visitor sessions are tenant-scoped, renewable, expiring, and revocable; duplicate-action protection and abuse controls must bind to this lifecycle rather than to a permanent raw header value.
- Add tenant context to public user records and sessions.
- Add tenant context to internal auth context and authorization middleware.
- Keep `users` as a global identity table; tenant participation must be modeled through memberships rather than a direct `users.tenant_id` home-tenant column.
- Ensure an internal workspace actor cannot cross tenant boundaries even if they know another workspace ID.

### Workstream 3: Tenant-Aware Public Routing and Board Access

Goal:

- Make every public request resolve through a tenant before board lookup.

Required changes:

- Replace global board-slug lookup with tenant-aware lookup.
- Add tenant-aware public route structure using a tenant-wide unique `public_board_key` rather than raw workspace-scoped board slugs.
- Preserve backward compatibility through redirects or transitional lookup only during migration.
- Make public SSE, comments, votes, subscriptions, favorites, and changelog endpoints tenant-aware.
- Tenant-key cache keys, SSE channels, background fanout topics, and object-storage paths so delivery and retrieval cannot cross tenant boundaries.

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
- Migrate public users into tenant-aware records, including multi-tenant profile backfill for users who already have activity across more than one tenant.
- Migrate persisted public activity authoring so every historical idea, vote, comment, subscription, and favorite has a valid tenant-scoped actor reference.
- Run dual-read or dual-write compatibility until cutover is complete.
- Add redirects from old public routes to tenant-aware routes during the transition window, but only for routes that resolve unambiguously after collision audit and alias mapping.

### Workstream 6: Quality Gate and Release Cutover

Goal:

- Prove tenant boundaries cannot be bypassed.

Required changes:

- Integration coverage for cross-tenant access denial.
- E2E coverage for enterprise-domain signup and SSO resolution.
- E2E coverage for personal-tenant signup with public email providers.
- Regression coverage for guest access into enterprise tenants.
- Release checklist for session invalidation, redirect readiness, and post-cutover cleanup.
  - Implemented in `docs/CustomerVoice-Phase7-Cutover-Runbook.md` with the matching automated audit in `apps/api/src/db/phase7-cutover-audit-cli.ts`.

## 5. Concrete Schema Changes

Phase 7 should be implemented as additive migrations first, then constraint tightening after backfill.

### 5.1 Migration 014: tenant_domain_foundation

Changes:

- Alter `tenants` to add:
  - `tenant_key` immutable, unique, system-generated, URL-safe external identifier (Stripe-style prefixed base62, for example `tnt_3xT9bK1VpQz`)
  - `tenant_type` (`enterprise`, `personal`)
  - `status` (`active`, `pending_setup`, `suspended`)
  - `primary_domain` nullable
  - `features` JSONB DEFAULT '{}'
  - `updated_at`
- Keep tenant display naming separate from identity:
  - mutable `name` or `display_name` for UI
  - domains and routing aliases remain references, not primary identifiers
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
- Add unique index on `tenant_key`.

### 5.2 Migration 015: tenant_scope_backfill_columns

Changes:

- Add `tenant_id` (with `ON DELETE CASCADE` referencing `tenants(id)`) to tenant-owned tables that are frequently resolved or audited:
  - `workspaces`
  - `workspace_memberships`
  - `workspace_role_permissions`
  - `audit_events`
  - `boards`
  - `board_settings`
  - `ideas`
  - `idea_comments`
  - `idea_votes`
  - `idea_categories`
  - `idea_tags`
  - `idea_tag_links`
  - `changelog_entries`
  - `idea_attachments`
  - `comment_attachments`
  - `webhooks`
  - `notification_jobs`
  - `notification_job_recipients`
  - `sso_connections`
- Add `public_board_key` to `boards`, backfilled and unique per tenant.
- Backfill `tenant_id` from existing workspace ownership.
- Add tenant-scoped indexes for high-volume lookup paths.
- For any remaining dependent table that keeps only a parent foreign key, define and test a join-based tenant isolation policy before cutover. No persisted product data may remain without an explicit tenant isolation path.

### 5.3 Migration 016: public_identity_multitenant

Changes:

- Retain global uniqueness for `email` in `portal_users` but introduce tenant profiles.
- Create `tenant_actors` as the persisted author/subject table for public product activity:
  - `id`
  - `tenant_id` ON DELETE CASCADE
  - `actor_type` (`internal_user`, `portal_user`, `visitor`, `system`)
  - `internal_user_id` nullable ON DELETE CASCADE
  - `portal_user_id` nullable ON DELETE CASCADE
  - `visitor_id` nullable ON DELETE CASCADE
  - `display_name`
  - `email` nullable
  - `created_at`
  - actor rows store references to source identities rather than duplicating full user objects
  - UNIQUE(`tenant_id`, `internal_user_id`) WHERE `internal_user_id` IS NOT NULL
  - UNIQUE(`tenant_id`, `portal_user_id`) WHERE `portal_user_id` IS NOT NULL
  - UNIQUE(`tenant_id`, `visitor_id`) WHERE `visitor_id` IS NOT NULL
- Create `portal_tenant_profiles`:
  - `id`
  - `tenant_id` ON DELETE CASCADE
  - `portal_user_id` ON DELETE CASCADE
  - `account_type` (`personal_owner`, `enterprise_member`, `guest`)
  - `home_domain`
  - UNIQUE(`tenant_id`, `portal_user_id`)
- Create `tenant_visitors`:
  - `id`
  - `tenant_id` ON DELETE CASCADE
  - `visitor_key`
  - `session_token`
  - `expires_at`
  - `revoked_at`
  - `first_seen_at`
  - `last_seen_at`
  - UNIQUE(`tenant_id`, `visitor_key`)
- Alter `portal_sessions`:
  - add `tenant_id` ON DELETE CASCADE
  - add optional `workspace_id` ON DELETE CASCADE
  - add index on `(tenant_id, token)`
- Alter persisted public-activity tables to reference `tenant_actors` for public authorship and engagement, replacing implicit reliance on internal `users` records for portal traffic.
- Alter `idea_subscriptions` and `idea_favorites`:
  - add `tenant_id` ON DELETE CASCADE
  - backfill from related idea or user

### 5.4 Migration 017: internal_tenant_membership_hardening

Changes:

- Create `tenant_memberships`:
  - `tenant_id`
  - `user_id`
  - `role` (`tenant_admin`, `tenant_member`, `tenant_guest`)
  - `status`
  - `invited_by`
  - `created_at`
- `users` remains globally unique and tenant-agnostic; `tenant_memberships` becomes the only tenant-level authority for internal actors.
- Global support/admin roles live outside `tenant_memberships` in a separate global-operator authority source (for example IdP claim mapping and/or a dedicated global admin assignment table). They enter tenant context only through audited impersonation sessions.
- Tighten `workspace_memberships` validation so workspace tenant and user tenant cannot diverge.

### 5.5 Migration 018: tenant_public_routing_support

Changes:

- Use `tenants.tenant_key` as the one canonical tenant-facing lookup key for public routes, SSO callbacks, and tenant-resolution responses.
- `tenant_key` is immutable after creation. Domains, custom routing domains, and display names may change without changing the canonical key.
- Ensure public boards can be resolved by `(tenant_id, public_board_key)` instead of global slug or workspace-scoped board slug.
- Remove reliance on global `slug LIKE ...` board fallback after migration.
- Add tenant-aware storage key conventions for idea/comment attachments and any generated public assets.

## 6. Concrete API Changes

### 6.1 New tenant-resolution APIs

Add:

- `POST /public/tenant/resolve`
  - input: email or domain
  - output: tenant resolution result, login options, personal-tenant fallback
- `GET /public/tenant/:tenantKey`
  - `tenantKey` is the immutable `tenants.tenant_key`
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
- if one global portal user belongs to multiple tenants, login must return a tenant-selection or tenant-resolution step rather than silently picking one
- sessions return tenant context, not just user context
- anonymous board access, where allowed, uses a tenant-scoped visitor session and never a global fallback identity
- all public writes read and persist through a tenant-scoped actor resolution step before business logic runs

### 6.4 Public portal route changes

Replace global public routes such as:

- `/public/boards/:boardSlug`

With tenant-aware routes such as:

- `/public/t/:tenantKey/boards/:boardPublicKey`
- `/public/t/:tenantKey/boards/:boardPublicKey/ideas`
- `/public/t/:tenantKey/boards/:boardPublicKey/stream`

Transitional support:

- run a pre-cutover collision audit for legacy board slugs
- create explicit legacy route aliases only for boards that can be mapped deterministically
- old routes redirect or resolve temporarily through a compatibility layer only when alias resolution is unambiguous
- ambiguous legacy routes must fail closed with an explicit resolution page or be retired, never silently mapped to the wrong board
- final cutover removes global board lookup

### 6.5 SSO API changes

Change:

- move SSO connection administration from workspace scope to tenant scope
- change login resolution from raw domain lookup to tenant-owned verified domain lookup
- successful domain resolution yields a canonical `tenant_key`, and the rest of the login/callback flow runs against that tenant context

Target endpoints:

- `GET /auth/sso/login?tenant=:tenantKey`
- `ALL /auth/sso/callback?tenant=:tenantKey`
- `GET /tenants/:tenantId/sso-connections`
- `POST /tenants/:tenantId/sso-connections`
- `PATCH /tenants/:tenantId/sso-connections/:connectionId`

### 6.6 Internal API enforcement changes

Keep existing workspace routes if desired, but add tenant enforcement:

- Implement hard Database Query Isolation using a **raw-SQL scoped repository contract** as the primary mechanism:
  - every repository function touching tenant-owned tables must accept `tenantId` directly or derive it from an already-validated tenant-owned parent record
  - shared-table queries must filter on `tenant_id` or on a join path that is guaranteed to resolve to one tenant
  - the base SQL helper layer must expose tenant-aware query helpers and reject unsafe call sites in CI/linting where feasible
- Add database-level defense in depth for high-risk query surfaces:
  - use parameterized security-barrier views or equivalent restricted SQL envelopes for ad hoc, reporting, search, or AI-generated query paths
  - RLS may be used selectively for especially sensitive tables, but it is not the primary isolation mechanism for the whole app
- **Support/Admin Operator Spanning:** Support operators _are_ allowed to span tenants, but strictly via an explicit "Impersonation/Switch Tenant" flow. They should not have explicit `tenant_memberships` in customer tenants; instead, global admins receive a temporary tenant-scoped session context, and all actions are aggressively audited with the operator's real identity.
- request actor must carry `tenantId`
- middleware must reject cross-tenant workspace access before permission checks run
- board, webhook, changelog, moderation, and analytics routes must verify workspace tenant ownership consistently
- **Multi-Tenant Observability**: Injected `tenant_id` must be present in the root context of application loggers and APM/Error Trackers (e.g., Sentry) early in the middleware so every log line or exception carries the tenant's context.
- **Background Worker Execution Context**: Any asynchronous workers processing tasks (e.g., webhooks, imported data, fanout queues) must explicitly hydrate the `tenant_id` state _before_ executing application logic to ensure adherence to RLS/Global Scope policies.

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
   - populate `tenant_id` across workspaces, boards, ideas, comments, votes, categories, webhooks, changelogs, notifications, attachments, and other tenant-owned assets
   - generate one immutable `tenant_key` for every existing tenant and verify uniqueness before public route cutover
   - generate a unique `public_board_key` for every existing board and detect collisions before route cutover

4. Backfill public identity.
   - keep each `portal_user` as one global identity
   - create a personal tenant for each public-email user where needed
   - create one `portal_tenant_profile` per tenant inferred from that user's historical activity, invites, or enterprise ownership
   - if a user has activity in multiple tenants, backfill multiple tenant profiles rather than forcing a single tenant assignment
   - create or backfill one `tenant_actor` per portal profile and visitor identity
   - attach existing sessions, subscriptions, favorites, comments, votes, ideas, and anonymous visitor records to the correct tenant context and actor context

5. Backfill internal identity.
   - create `tenant_memberships`
   - derive memberships from existing workspace ownership and admin relationships
   - create or backfill `tenant_actor` rows for internal users who authored public-facing comments or other public-visible activity
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
   - remove global anonymous visitor fallback behavior
   - remove legacy public-write paths that depend on internal `users(id)` fallback behavior
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
8. Anonymous visitor actions, if enabled, are isolated by tenant-scoped visitor identity.
9. Attachments, cache keys, SSE channels, and generated assets are tenant-isolated.
10. Public writes persist through tenant-scoped actor records rather than implicit internal-user fallbacks.
11. Documentation and operator UX clearly reflect the new tenant model.

## 10. Core Architectural Recommendations

Based on the tenancy requirements for Phase 7, here are the explicit recommendations for the core technical decisions:

### 10.1 `tenantKey` Format

**Recommendation:** Use a **Stripe-style prefixed base62 string** (e.g., `tnt_3xT9bK1VpQz`).

- **Why:** Google Identity Platform describes tenants as having a unique identifier, separate users, identity providers, auditing, and quota boundaries. Google AIP guidance also distinguishes immutable identifiers from mutable display fields: resource identifiers should be unique within the API, documented if system-generated, and kept separate from mutable `display_name`-style fields. In this plan, `tenant_key` is the canonical immutable external identifier; domains and display names are mutable references layered on top.

### 10.2 Primary Isolation Mechanism

**Recommendation:** Use a **hybrid raw-SQL model**:

- primary isolation = explicit tenant-scoped repository/query contracts on every shared-table access
- defense in depth = DB-level restricted query envelopes for high-risk surfaces
- **Why:** Google’s shared-table multi-tenant guidance emphasizes putting `tenant ID` directly into the shared-row model and scoping reads to a single partition or tenant boundary. For this codebase, which uses hand-written SQL rather than an ORM, the reliable implementation is a repository contract that always carries `tenantId` into shared-table queries. For untrusted or ad hoc SQL-like paths, Google’s AlloyDB guidance on parameterized secure views with `WITH (security_barrier)` provides the right additional guardrail.

### 10.3 Support/Admin Operator Spanning

**Recommendation:** **Yes, support/admin operators should be allowed to span tenants, but strictly via an explicit "Impersonation" flow rather than standard memberships.**

- **Why:** Creating actual `tenant_memberships` for your internal support staff inside every customer's tenant pollutes customer data, skews analytics, and creates security nightmares for staff offboarding. Instead, maintain a global base role outside tenant memberships, sourced from IdP claim mapping and/or a dedicated global admin assignment table. When operators need access to a tenant, they explicitly "Switch to Tenant", which generates a temporary, tenant-scoped session context for their global identity. Every action taken during this session MUST be written to `audit_events`, logging _both_ the operator's real global `user_id` and the impersonated `tenant_id`.

### 10.4 Public/Internal Actor Persistence

**Recommendation:** Use a single tenant-scoped actor table that stores references to source identities (`internal_user`, `portal_user`, `visitor`, `system`) instead of duplicating user objects or continuing to persist public actions against internal-only `users(id)` rows.

- **Why:** Google API guidance recommends referencing other owned resources by resource name or ID rather than embedding the source object. The same principle applies here: `tenant_actors` should be the stable tenant-scoped author/subject layer for persisted activity, while internal users, portal users, and visitors remain their own source-of-truth identity records.

### 10.5 Trace And Observability Metadata

**Recommendation:** Attach `tenant_id`, `tenant_key`, and impersonation/operator metadata to traces, logs, and worker execution context at the start of each request or job.

- **Why:** OpenAI’s Agents tracing docs explicitly support trace metadata and recommend carrying workflow-level metadata through runs. The same pattern should be used here so tenant context is visible in traces, logs, and support investigations without relying on inference after the fact.

## 11. Official References

- [Google Cloud Identity Platform multi-tenancy](https://docs.cloud.google.com/identity-platform/docs/multi-tenancy)
- [Google Cloud Spanner multi-tenancy row pattern](https://docs.cloud.google.com/spanner/docs/implement-multi-tenancy)
- [Google Cloud Datastore multitenancy and partition-scoped queries](https://docs.cloud.google.com/datastore/docs/concepts/multitenancy)
- [Google Cloud AlloyDB parameterized secure views](https://docs.cloud.google.com/alloydb/docs/parameterized-secure-views-overview)
- [Google AIP-122 Resource names](https://google.aip.dev/122)
- [Google AIP-148 Standard fields](https://google.aip.dev/148)
- [Google AIP-203 Field behavior documentation](https://google.aip.dev/203)
- [Google AIP-2713 One team owns each type](https://google.aip.dev/apps/2713)
- [OpenAI Agents SDK tracing](https://openai.github.io/openai-agents-python/tracing/)
- [OpenAI Agents SDK running agents and trace metadata](https://openai.github.io/openai-agents-python/running_agents/)
