# CustomerVoice Agent Continuity Checklist

## Context
Use this file as the quick handoff checkpoint before making code changes.

Roadmap source of truth is:
1. `docs/summary.md`
2. `docs/CustomerVoice-Phases.md`

## Current baseline
- Monorepo: Turborepo (`apps/web`, `apps/api`, `apps/worker`, `apps/e2e`, `apps/mobile`).
- Frontend: React + Vite (`apps/web`).
- Backend: Node + Express + Postgres (`apps/api`), with repository-layer SQL.
- Worker: notification dispatcher + webhook forwarding (`apps/worker`).

## Phase status
- Phases 1-5: implemented in codebase.
- Phase 6: baseline features implemented (SSE live updates, widget mode, MRR impact data path, SSO routes, Playwright scaffold).
- Pre-Phase-7 gate: close Phase 6 gaps and stabilize quality before new improvements.

## Pre-Phase-7 gate checklist (must pass)
- [x] Phase 6 functional gaps fixed (MRR impact sort exposed, SSO setup flow usable, internal comment behavior consistent).
- [x] E2E stabilized:
  - [x] Ports aligned to current defaults (`web:3333`, `api:4000`).
  - [x] Seed data deterministic for E2E assumptions.
  - [x] Happy-path coverage includes register/login, submit idea, vote, and comment.
- [x] Docs aligned with implemented state:
  - [x] `docs/summary.md`
  - [x] `apps/web/src/MarketingSite.tsx` docs messaging
  - [x] This continuity checklist
- [ ] DB-backed integration suite stabilized (`pnpm --filter @customervoice/api test:integration:db` currently failing).
- [ ] API/Web lint baseline cleaned (`pnpm --filter @customervoice/api lint`, `pnpm --filter @customervoice/web lint` currently failing).

## Phase 7 planning preparation
- [x] Build competitor gap analysis (UserVoice, Canny, Productboard, Frill) from current public feature surfaces.
- [x] Propose Phase 7 options and sequencing without locking priority yet.
- [x] Update `docs/summary.md` with:
  - Current gate status
  - Planning references
  - Any open risks

## Local run commands
```bash
cd /Users/ashishnigam/Startups/CustomerVoice
pnpm install
pnpm infra:up
pnpm dev
```

## Validation commands
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @customervoice/api test:integration:db
pnpm --filter @customervoice/e2e test:e2e
```
