# CustomerVoice

CustomerVoice is a multi-tenant feedback and product-delivery orchestration platform inspired by UserVoice and Microsoft Feedback Portal workflows.

Current implementation includes:
- Workspace-aware feedback portal (`boards`, `ideas`, `votes`, `comments`, `status`).
- RBAC policy engine with workspace scope enforcement.
- Supabase JWT verification (or local mock mode).
- Audit event persistence for auth/admin/product actions.
- Monorepo scaffold for web, api, worker, and mobile apps.

## Repository structure
- `/apps/web`: React web portal shell (v1 feedback UX)
- `/apps/api`: Node + Express API (RBAC + feedback domain)
- `/apps/worker`: async worker scaffold
- `/apps/mobile`: React Native (Expo) shell
- `/packages/*`: shared package stubs
- `/infra/docker`: local stack via Docker Compose
- `/infra/k8s`: baseline k8s manifests
- `/infra/terraform`: cloud IaC starter
- `/docs`: PRD, architecture, ticket packs, QA artifacts

## Core v1 feature coverage
- Auth + workspace context
  - Login state in web shell
  - Workspace switching
  - Unauthorized API response handling (`401/403` -> redirect to login)
- Portal baseline
  - Board list/create
  - Idea list/detail/create
  - Upvote/unvote
  - Comments list/create
  - Status transitions with role gating
- Foundation services
  - Workspace membership APIs
  - Audit event APIs
  - CI pipeline with unit/integration + DB-backed integration suite

## Tech stack
- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript + Postgres
- Auth: Supabase JWT verification (plus local mock mode)
- Tooling: pnpm workspaces + Turbo + Vitest + ESLint
- Local infra: Docker Compose (postgres, redis, mailhog, minio)

## Prerequisites
- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

## Local setup
1. Install dependencies:
```bash
pnpm install
```

2. Copy env templates:
```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/mobile/.env.example apps/mobile/.env
```

3. Start baseline infra:
```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres redis mailhog minio
```

4. Run migrations:
```bash
pnpm --filter @customervoice/api db:migrate
```

5. Start apps:
```bash
pnpm dev
```

Default local URLs:
- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`

## Auth modes
### `AUTH_MODE=mock` (local default)
API accepts actor headers from web shell. Use seeded values:
- `workspace_id`: `22222222-2222-2222-2222-222222222222`
- `user_id`: `33333333-3333-3333-3333-333333333333`
- `role`: `workspace_admin`

### `AUTH_MODE=supabase`
Configure these env vars in `apps/api/.env`:
- `SUPABASE_URL`
- `SUPABASE_ISSUER` (optional override)
- `SUPABASE_JWT_AUDIENCE` (optional)
- `SUPABASE_JWKS_URL` (optional override)

In this mode, API validates bearer tokens and resolves role from `workspace_memberships`.

## Common commands
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @customervoice/api test:integration
pnpm --filter @customervoice/api test:integration:db
```

## DB-backed integration tests
The DB-backed suite requires a Postgres instance in `DATABASE_URL`.

Example (isolated local run):
```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/customervoice pnpm --filter @customervoice/api db:migrate
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/customervoice pnpm --filter @customervoice/api test:integration:db
```

## API surface (v1 implemented)
See `/apps/api/openapi/openapi.yaml`.

Main endpoints:
- Boards
  - `GET /api/v1/workspaces/:workspaceId/boards`
  - `POST /api/v1/workspaces/:workspaceId/boards`
- Ideas
  - `GET /api/v1/workspaces/:workspaceId/boards/:boardId/ideas`
  - `POST /api/v1/workspaces/:workspaceId/boards/:boardId/ideas`
  - `GET /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId`
  - `PATCH /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/status`
- Votes
  - `POST /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/votes`
  - `DELETE /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/votes`
- Comments
  - `GET /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/comments`
  - `POST /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/comments`
- Membership
  - `GET /api/v1/workspaces/:workspaceId/members`
  - `POST /api/v1/workspaces/:workspaceId/members/invite`
  - `PATCH /api/v1/workspaces/:workspaceId/members/:userId/role`
  - `DELETE /api/v1/workspaces/:workspaceId/members/:userId`
- Audit
  - `GET /api/v1/workspaces/:workspaceId/audit-events`

## Sprint-1 status (current)
- CV-001 to CV-013 implemented, including:
  - CV-006: auth state + workspace switcher + unauthorized redirect flow in web shell.
  - CV-010: UX/copy/route-map artifact in `/docs/CV-010-UX-Copy-Spec.md`.
  - CV-011: QA/UAT artifacts and integration test baseline.
  - CV-012/CV-013: board CRUD + board view wiring.

## CI
GitHub Actions workflow: `/.github/workflows/ci.yml`
- Install dependencies
- Lint
- Typecheck
- Unit/integration tests
- DB-backed integration tests against ephemeral Postgres service

## Roadmap after current implementation
- Deploy orchestration and release automation (planned v2)
- Enterprise white-label extensions (custom domain and branded emails)
- Single-tenant/VPC deployment mode
- SSO for GoodHealth.ai / GoodWealth.ai embedded integration
- Payment/pricing transition after free-beta threshold
