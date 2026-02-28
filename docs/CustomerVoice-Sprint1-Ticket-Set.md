# CustomerVoice Sprint 1 Ticket Set (Ready to import)

## Sprint goal
Deliver workspace/auth foundation and baseline service scaffolding required for all v1 features.

## Team capacity assumption
- 2 backend engineers.
- 1 frontend engineer.
- 1 PM/designer.
- 1 founder support.

## Ticket format
- ID
- Title
- Owner
- Estimate (story points)
- Dependencies
- Description
- Acceptance criteria

## Tickets

### CV-001
- Title: Create monorepo skeleton and workspace tooling
- Owner: Backend A
- Estimate: 3
- Dependencies: none
- Description:
Set up repo structure for apps/packages/infra/docs with pnpm workspace and shared scripts.
- Acceptance criteria:
1. Root workspace supports `pnpm -r lint`, `pnpm -r test`, `pnpm -r build`.
2. App placeholders exist for `web`, `api`, `worker`, `mobile`.
3. Base README with local startup instructions exists.

### CV-002
- Title: Define tenant/workspace RBAC schema
- Owner: Backend B
- Estimate: 5
- Dependencies: CV-001
- Description:
Create core schema for tenant, workspace, membership, role, and policy tables.
- Acceptance criteria:
1. Migrations apply cleanly to local DB.
2. Seed creates sample tenant/workspace/admin user.
3. Role model includes `tenant_admin`, `workspace_admin`, `product_manager`, `engineering_manager`, `contributor`, `viewer`.

### CV-003
- Title: Integrate Supabase auth with API
- Owner: Backend B
- Estimate: 5
- Dependencies: CV-002
- Description:
Validate Supabase tokens in API gateway and map to internal membership records.
- Acceptance criteria:
1. Authenticated requests resolve user identity and workspace context.
2. Unauthorized requests return standard error format.
3. Auth events are logged in audit stream.

### CV-004
- Title: Implement workspace membership APIs
- Owner: Backend A
- Estimate: 5
- Dependencies: CV-002, CV-003
- Description:
Create APIs for invite, list members, role update, and deactivate membership.
- Acceptance criteria:
1. Only allowed roles can invite/update users.
2. Membership changes emit audit events.
3. API contract documented in OpenAPI.

### CV-005
- Title: Build policy engine v1 (read-only enforcement)
- Owner: Backend B
- Estimate: 5
- Dependencies: CV-002, CV-003
- Description:
Implement middleware to enforce role-to-action permissions for workspace APIs.
- Acceptance criteria:
1. Protected endpoints enforce role matrix.
2. Denied actions return `403` with stable error code.
3. Permission checks are unit tested.

### CV-006
- Title: Scaffold React web shell with auth state and workspace switcher
- Owner: Frontend
- Estimate: 5
- Dependencies: CV-003, CV-004
- Status: Completed (implemented in `apps/web/src/App.tsx`)
- Description:
Set up initial web shell with login state, workspace context, and navigation.
- Acceptance criteria:
1. User can sign in and see current workspace.
2. Workspace switch updates API context.
3. Unauthorized state redirects to login.

### CV-007
- Title: Docker Compose local stack baseline
- Owner: Backend A
- Estimate: 3
- Dependencies: CV-001
- Description:
Create compose stack for postgres, redis, mailhog, api, web, worker.
- Acceptance criteria:
1. `docker compose up` starts all required baseline services.
2. Health checks pass for api/web.
3. Local env example file documented.

### CV-008
- Title: Audit event framework foundation
- Owner: Backend B
- Estimate: 5
- Dependencies: CV-002
- Description:
Create standard event envelope and persistence for auth/admin actions.
- Acceptance criteria:
1. Events include actor, workspace, action, timestamp, metadata.
2. Query endpoint exists for latest audit events.
3. Sensitive fields are masked.

### CV-009
- Title: CI baseline pipeline
- Owner: Backend A
- Estimate: 3
- Dependencies: CV-001
- Description:
Add CI jobs for install, lint, typecheck, test.
- Acceptance criteria:
1. Pipeline runs on pull requests.
2. Build fails on lint/type/test errors.
3. Status badges or checks visible in PR.

### CV-010
- Title: UX and copy spec for portal and dashboard foundation
- Owner: PM/Designer
- Estimate: 3
- Dependencies: none
- Status: Completed (artifact `docs/CV-010-UX-Copy-Spec.md`)
- Description:
Provide v1 IA, route map, and low-fidelity wireframes for foundational screens.
- Acceptance criteria:
1. Route map approved for auth/workspace/board shell.
2. Core UX copy guidelines defined.
3. Handoff notes posted for engineering.

### CV-011
- Title: Sprint 1 QA/UAT checklist
- Owner: Founder + PM/Designer
- Estimate: 2
- Dependencies: CV-003, CV-004, CV-006, CV-007, CV-008
- Description:
Create and run checklist validating auth, membership, role enforcement, and local startup.
- Acceptance criteria:
1. Checklist documented and executed.
2. Blocking defects triaged with severity.
3. Sprint review demo script prepared.

## Stretch tickets (only if capacity remains)

### CV-012
- Title: Bootstrap board CRUD API and data model
- Owner: Backend A
- Estimate: 5
- Dependencies: CV-002, CV-003
- Status: Completed (`apps/api/src/routes/boards.ts` + DB-backed tests)
- Description:
Add first board domain model and create/list endpoints.
- Acceptance criteria:
1. Board create/list endpoints are protected by workspace scope.
2. Basic tests pass.

### CV-013
- Title: Web board list placeholder view
- Owner: Frontend
- Estimate: 3
- Dependencies: CV-006, CV-012
- Status: Completed (`apps/web/src/App.tsx` board list wired to live API)
- Description:
Render board list page using API.
- Acceptance criteria:
1. Board list appears for current workspace.
2. Empty state and error states implemented.

## Sprint 1 done criteria
1. All non-stretch tickets accepted.
2. CI green.
3. Local setup reproducible by all team members in <30 minutes.
4. No P1 security defects open in completed scope.
