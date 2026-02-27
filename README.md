# CustomerVoice Monorepo (Sprint 1 Scaffold)

This repository is scaffolded for Sprint 1 execution.

## Workspace Layout
- `apps/web`: React web app shell
- `apps/api`: Node.js API service scaffold
- `apps/worker`: async worker scaffold
- `apps/mobile`: React Native (Expo) shell
- `packages/*`: shared code packages
- `infra/*`: docker, kubernetes, and terraform stubs
- `docs/*`: product, architecture, and execution docs

## Quick Start
1. Install dependencies:
```bash
pnpm install
```
2. Start infra:
```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres redis mailhog minio
```
3. Start apps:
```bash
pnpm dev
```

## API Auth Modes
- `AUTH_MODE=supabase` (default): verifies JWT using Supabase JWKS and resolves role from DB membership.
- `AUTH_MODE=mock` (local only): accepts `x-user-id`, `x-workspace-id`, `x-role`, `x-user-email` headers.

Local Docker Compose runs API in `mock` mode with seeded workspace:
- `workspace_id`: `22222222-2222-2222-2222-222222222222`
- `user_id`: `33333333-3333-3333-3333-333333333333`

## Sprint 1 Scope (Scaffolded)
- Monorepo and workspace tooling
- Tenant/workspace/auth API skeleton
- Membership API skeleton
- RBAC and audit event foundation
- Docker Compose local baseline
