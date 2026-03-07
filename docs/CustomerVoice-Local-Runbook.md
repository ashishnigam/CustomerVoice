# CustomerVoice Local Runbook

## Purpose
Use this runbook for starting, stopping, and debugging the local CustomerVoice product stack.

## What Runs Where
- Marketing site: `http://localhost:3333`
- Operator shell: `http://localhost:3333/app`
- Customer board route: `http://localhost:3333/app/boards/:slug`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`
- Redis: `redis://localhost:6379`
- MailHog SMTP: `localhost:1025`
- MailHog UI: `http://localhost:8025`
- MinIO API: `http://localhost:9000`
- MinIO UI: `http://localhost:9001`
- Postgres: `localhost:55432`

If `3333` is already occupied, Vite will move the web app to the next free port, usually `3334`.

## Quick Start / Stop (Single Command)

**Start everything** (Docker infra + API + web + worker):
```bash
pnpm start
```

**Stop everything** (Docker infra):
```bash
pnpm stop
```
Then press `Ctrl+C` in the terminal running `pnpm start` to kill the dev servers.

| Command | What it does |
|---------|-------------|
| `pnpm start` | `pnpm infra:up && pnpm dev` — starts Postgres, Redis, MailHog, MinIO, then API + web + worker |
| `pnpm stop` | `pnpm infra:down` — stops all Docker containers |
| `pnpm dev` | Starts only the dev servers (API + web + worker), assumes Docker infra is already running |
| `pnpm dev:all` | Starts dev servers including Expo mobile |

## Local Startup (Step by Step)
1. Install dependencies:
```bash
pnpm install
```

2. Copy local env files (first time only):
```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/mobile/.env.example apps/mobile/.env
```

3. Start Docker dependencies:
```bash
pnpm infra:up
```

4. Start the product stack:
```bash
pnpm dev
```

`pnpm dev` starts `api`, `web`, and `worker`.

If you also want Expo mobile running:
```bash
pnpm dev:all
```

## When Postgres `55432` Is Busy
If another local database is already bound to `55432`, stop that DB or map PostgreSQL to a different port by overriding `POSTGRES_PORT`.
```bash
POSTGRES_PORT=55432 pnpm infra:up
```

Then update `DATABASE_URL` in `.env`, `apps/api/.env`, and `apps/worker/.env` to:
```bash
postgresql://postgres:postgres@localhost:55432/customervoice
```

You can also override per command instead of editing files:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/customervoice pnpm dev:api
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/customervoice pnpm dev:worker
```

## Stop Commands
- Stop host-side dev servers: press `Ctrl+C` in the terminal running `pnpm dev`, `pnpm dev:api`, `pnpm dev:web`, or `pnpm dev:worker`
- Stop Docker dependencies:
```bash
pnpm infra:down
```

- If you need to inspect a port before stopping it:
```bash
lsof -nP -iTCP:3333 -sTCP:LISTEN
lsof -nP -iTCP:4000 -sTCP:LISTEN
```

- Then stop the process explicitly:
```bash
kill <pid>
```

## Debugging Commands
- API health:
```bash
curl -s http://localhost:4000/health
```

- Run API only:
```bash
pnpm dev:api
```

- Run web only:
```bash
pnpm dev:web
```

- Run worker only:
```bash
pnpm dev:worker
```

- Re-run migrations:
```bash
pnpm --filter @customervoice/api db:migrate
```

- Tail Docker service logs:
```bash
pnpm infra:logs
```

- Build and typecheck before handoff:
```bash
pnpm build
pnpm typecheck
```

## Default Local Auth
Local `.env.example` files default to:
- `AUTH_MODE=mock`
- `ENABLE_BOOTSTRAP_SEED=true`
- `SEED_WORKSPACE_ID=22222222-2222-2222-2222-222222222222`
- `SEED_USER_ID=33333333-3333-3333-3333-333333333333`
- `SEED_USER_EMAIL=admin@customervoice.local`

Use these values on the `/app` sign-in screen unless you are explicitly testing Supabase JWT mode.

## Interface Logic
- `/` is the marketing site.
- `/app` is the operator shell for setup, moderation, and analytics.
- `/app/boards/:slug` is the customer-facing board route and should be the main shared URL.
- `Customer Board` is the public experience preview and setup surface.
- `Moderation Ops` is internal-only and should never be treated as the customer-facing workflow.
- `Insights` is internal-only for RICE scoring, revenue inputs, CSV export, and outreach jobs.
- The sign-in screen includes an API health check so operators can validate the backend before they try to work inside the dashboard.

## Recommended Smoke Test
1. Start the stack.
2. Open `http://localhost:3333/app`.
3. Sign in with the seeded mock admin.
4. Create a board and confirm the app moves to `/app/boards/:slug`.
5. Create categories and submit ideas.
6. Upvote or comment on an idea.
7. Move to `Moderation Ops` and test lock or merge flows.
8. Move to `Insights`, save RICE input, export CSV, and enqueue outreach.
9. Mark an idea `completed` and confirm MailHog receives the notification.
