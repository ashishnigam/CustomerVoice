# CustomerVoice

CustomerVoice is a multi-tenant feedback and product-delivery orchestration platform inspired by UserVoice and Microsoft Feedback Portal workflows.

Current implementation includes:
- Marketing website with routes for home, features, pricing, blog, and developer docs.
- Brand and design guideline documentation for future UI and marketing consistency.
- Workspace-aware feedback portal with boards, ideas, votes, comments, categories, and status transitions.
- Portal search/sort/filter flows plus moderation queue for spam, comment lock, duplicate merge, and bulk actions.
- Notification job pipeline for shipped-idea updates and analytics outreach emails.
- Internal analytics dashboard with RICE, revenue potential, contact audience, and CSV export.
- RBAC policy engine with workspace scope enforcement.
- Supabase JWT verification (or local mock mode).
- Audit event persistence for auth, moderation, notification, and analytics actions.

## Repository structure
- `/apps/web`: React marketing site plus portal, moderation, and analytics UX
- `/apps/api`: Node + Express API for feedback, moderation, analytics, membership, and audit
- `/apps/worker`: notification dispatcher worker (MailHog/SMTP locally)
- `/apps/mobile`: React Native (Expo) shell
- `/packages/*`: shared package stubs
- `/infra/docker`: local stack via Docker Compose
- `/infra/k8s`: baseline Kubernetes manifests
- `/infra/terraform`: cloud IaC starter
- `/docs`: PRD, architecture, ticket packs, QA/UAT artifacts

## V1 feature coverage (implemented)
- Auth + workspace context
  - Login state in web shell
  - Workspace switching
  - Unauthorized API response handling (`401/403` -> redirect to login)
- Public portal
  - Board list/create
  - Shareable board route by slug (`/app/boards/:slug`)
  - Idea list/detail/create
  - Upvote/unvote
  - Comments list/create
  - Status transitions with role gating
  - Search, status filter, category filter, and sort modes
  - Category taxonomy and idea tagging
- Internal moderation
  - Moderation queue
  - Mark spam / restore
  - Lock / unlock comments
  - Merge duplicate ideas while preserving votes/comments lineage
  - Bulk moderation actions
- Internal analytics
  - RICE input + scoring
  - Revenue potential input and ranking
  - Audience contact list from upvoters/commenters
  - CSV export
  - Outreach job enqueue
- Notifications
  - Notification jobs and recipients persisted in DB
  - Worker dispatch to SMTP / MailHog
  - Automatic enqueue when idea status changes to `completed`
- Platform services
  - Workspace membership APIs
  - Audit event APIs
  - CI pipeline with unit/integration + DB-backed integration suite

## Tech stack
- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript + Postgres
- Worker: Node.js + TypeScript + Nodemailer
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

3. Start local infra:
```bash
pnpm infra:up
```

4. Start the product stack:
```bash
pnpm dev
```

`pnpm dev` now starts the core product stack only: `api`, `web`, and `worker`.

Use `pnpm dev:all` if you also want Expo mobile running.

Node services automatically load env values from workspace-root `.env` and per-app `.env` files.

Default local URLs:
- Website: `http://localhost:3333`
- Web app: `http://localhost:3333/app`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`
- MailHog UI: `http://localhost:8025`

If port `3333` is already occupied, Vite will automatically move the web app to the next free port, typically `3334`.

If local port `5432` is already in use, use `55432` for Docker Postgres:
```bash
POSTGRES_PORT=55432 pnpm infra:up
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/customervoice pnpm dev:api
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/customervoice pnpm dev:worker
```

For the full operational runbook, see `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-Local-Runbook.md`.

## Auth modes
### `AUTH_MODE=mock` (local default)
API accepts actor headers from web shell. Use seeded values:
- `workspace_id`: `22222222-2222-2222-2222-222222222222`
- `user_id`: `33333333-3333-3333-3333-333333333333`
- `role`: `workspace_admin`
- `email`: `admin@customervoice.local`

Additional seeded memberships used in tests:
- contributor `44444444-4444-4444-4444-444444444444`
- viewer `55555555-5555-5555-5555-555555555555`

### `AUTH_MODE=supabase`
Configure these env vars in `apps/api/.env`:
- `SUPABASE_URL`
- `SUPABASE_ISSUER` (optional override)
- `SUPABASE_JWT_AUDIENCE` (optional)
- `SUPABASE_JWKS_URL` (optional override)

In this mode, API validates bearer tokens and resolves role from `workspace_memberships`.

## Worker / email configuration
Local worker defaults in `/Users/ashishnigam/Startups/CustomerVoice/apps/worker/.env.example`:
- `DATABASE_URL=postgresql://postgres:postgres@localhost:55432/customervoice`
- `SMTP_HOST=localhost`
- `SMTP_PORT=1025`
- `WORKER_FROM_EMAIL=notifications@customervoice.local`
- `NOTIFICATION_POLL_INTERVAL_MS=5000`

Docker Compose already points worker SMTP to `mailhog:1025`.

## Common commands
```bash
pnpm infra:up
pnpm infra:down
pnpm dev:api
pnpm dev:web
pnpm dev:worker
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @customervoice/api test:integration
pnpm --filter @customervoice/api test:integration:db
```

## DB-backed integration tests
The DB-backed suite requires a Postgres instance in `DATABASE_URL`.

Example isolated run:
```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/customervoice pnpm --filter @customervoice/api db:migrate
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/customervoice pnpm --filter @customervoice/api test:integration:db
```

## Manual test flow
1. Open `http://localhost:3333` for the marketing website or `http://localhost:3333/app` for the application shell.
2. Use the API health check on the sign-in screen if the backend looks unavailable.
3. Sign in with the seeded mock admin values in the app shell.
4. Create a board and confirm the app moves to `/app/boards/:slug`.
5. Create categories.
6. Create ideas and tag them.
7. Verify search, status filter, category filter, and sort modes.
8. Upvote/comment as contributor.
9. Use `Moderation Ops` to lock comments or merge duplicates.
10. Use `Insights` to save RICE/revenue inputs, export CSV, and enqueue outreach.
11. Move an idea to `completed` and check MailHog for notification delivery.

## API surface (current)
See `/Users/ashishnigam/Startups/CustomerVoice/apps/api/openapi/openapi.yaml`.

Major endpoint groups:
- Boards
  - `GET /api/v1/workspaces/:workspaceId/boards`
  - `POST /api/v1/workspaces/:workspaceId/boards`
- Categories
  - `GET /api/v1/workspaces/:workspaceId/categories`
  - `POST /api/v1/workspaces/:workspaceId/categories`
  - `PATCH /api/v1/workspaces/:workspaceId/categories/:categoryId`
- Ideas
  - `GET /api/v1/workspaces/:workspaceId/boards/:boardId/ideas`
  - `POST /api/v1/workspaces/:workspaceId/boards/:boardId/ideas`
  - `PUT /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/categories`
  - `PATCH /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/status`
- Votes / comments
  - `POST|DELETE /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/votes`
  - `GET|POST /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/comments`
- Moderation
  - `GET /api/v1/workspaces/:workspaceId/moderation/ideas`
  - `POST /api/v1/workspaces/:workspaceId/moderation/ideas/merge`
  - `PATCH /api/v1/workspaces/:workspaceId/moderation/ideas/:ideaId/spam`
  - `PATCH /api/v1/workspaces/:workspaceId/moderation/ideas/:ideaId/comments-lock`
  - `POST /api/v1/workspaces/:workspaceId/moderation/ideas/bulk`
- Analytics
  - `GET /api/v1/workspaces/:workspaceId/analytics/ideas`
  - `PUT /api/v1/workspaces/:workspaceId/analytics/ideas/:ideaId/input`
  - `POST /api/v1/workspaces/:workspaceId/analytics/ideas/:ideaId/outreach`
- Membership / audit
  - `GET /api/v1/workspaces/:workspaceId/members`
  - `POST /api/v1/workspaces/:workspaceId/members/invite`
  - `GET /api/v1/workspaces/:workspaceId/audit-events`

## QA artifacts
- Sprint-1 checklist: `/Users/ashishnigam/Startups/CustomerVoice/docs/CV-011-QA-UAT-Checklist.md`
- V1 parity checklist: `/Users/ashishnigam/Startups/CustomerVoice/docs/CV-023-V1-Parity-QA-UAT-Checklist.md`
- V1 parity map: `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-V1-Parity-Mapping.md`
- Live working context: `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-Live-Working-Context.md`
- Execution tracker: `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-Execution-Tracker.md`
- Brand guideline source: `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-Brand-Guidelines.md`
- UX/copy handoff: `/Users/ashishnigam/Startups/CustomerVoice/docs/CV-010-UX-Copy-Spec.md`

## CI
GitHub Actions workflow: `/.github/workflows/ci.yml`
- Install dependencies
- Lint
- Typecheck
- Unit/integration tests
- DB-backed integration tests against ephemeral Postgres service

## Next planned scopes
- V2: beta cohorts, white-label custom domain/branded email, GoodHealth/GoodWealth SSO embed
- V3: AI delivery pipeline with gate approvals and private model routing
