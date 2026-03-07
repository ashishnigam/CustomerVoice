# CustomerVoice Summary and Phase Snapshot

Last updated: 2026-03-07

## Project Overview
CustomerVoice is a feedback and roadmap platform with:
- Public idea intake (submit, vote, discuss)
- Internal moderation and prioritization operations
- Public roadmap/changelog communication
- Enterprise controls (SSO baseline, policy configuration)
- Notification and integration surfaces (worker + webhooks)

## Technology Stack
- Monorepo: Turborepo
- Backend: Node.js + Express + PostgreSQL (`apps/api`)
- Frontend: React + Vite + TypeScript (`apps/web`)
- Worker: Node notification and webhook dispatcher (`apps/worker`)
- E2E: Playwright (`apps/e2e`)

## Phases 1-6 Summary

### Phase 1: Core Portal
- Delivered: board portal view, auth (register/login/me/logout), idea submission, voting, commenting, board access rules.
- Status: Complete.

### Phase 2: Enhanced UX and Retention
- Delivered: profile updates, follow/subscription, favorites, official/team comment metadata, paginated idea browsing.
- Status: Complete.

### Phase 3: Platform Excellence
- Delivered: roadmap tab, changelog feed, threaded comments, comment upvotes, markdown rendering, branding controls.
- Status: Complete.

### Phase 4: Admin, Auth, Notifications
- Delivered: admin board operations, changelog publishing UI, password reset flow, social auth mock flow, worker-based notifications, idea/comment attachments.
- Status: Complete (OAuth is mock-baseline, not full provider handshake).

### Phase 5: Moderation and Integrations
- Delivered: merge, spam, comments lock, bulk moderation, internal comments, webhook CRUD + dispatch, internal analytics/outreach operations.
- Status: Complete.

### Phase 6: Real-Time and Enterprise Scale
- Delivered: SSE live updates, widget mode UX (`?widget=true`), MRR impact scoring + `highest_impact` sort, SSO login/callback baseline, SSO connection management APIs, Playwright core E2E gate.
- Status: Complete baseline (enterprise hardening beyond baseline is post-Phase-6 work).

## Current Quality Gate Snapshot
- `@customervoice/api`: typecheck, lint, integration tests, DB integration tests passing.
- `@customervoice/web`: typecheck and lint passing.
- `@customervoice/e2e`: typecheck and Playwright tests passing.

## Current Roadmap Position
- Source of truth: `docs/summary.md` and `docs/CustomerVoice-Phases.md`.
- Phases 1-6: complete baseline in code.
- External SaaS commercialization now drives prioritization ahead of sister-company SSO/embed work.
- AI workflow platform work is explicitly deferred until the current feedback product is more stable.
- Immediate correctness gate before larger roadmap picks: callback auth, enterprise access UX, and restricted-board access enforcement.
- Next planning focus: consolidated Phase 7 planning in `docs/CustomerVoice-Phase7-Planning.md`, with final Phase 7 vs Phase 8 split still open.

## Key References
- `docs/CustomerVoice-Phases.md`
- `docs/implementation_plan.md.resolved`
- `docs/CustomerVoice-Phase7-Planning.md`
- `docs/CustomerVoice-Agent-Continuity-Checklist.md`
