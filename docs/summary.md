# CustomerVoice Summary & Context

## Project Overview
CustomerVoice is a modern, transparent, and highly responsive feedback portal bridging the gap between organizations and their users. It empowers companies to easily collect feature requests, prioritize ideas based on customer upvotes (and business value/MRR), share public visual roadmaps, and publish regular changelogs.

The platform differentiates through a polished public portal UX, internal moderation/analytics operations, integration surfaces (webhooks/widget), and enterprise readiness tracks (SSO, governance, testing).

## Technology Stack
- **Monorepo Strategy**: Turborepo (managing `apps/web`, `apps/api`, `apps/worker` and shared packages).
- **Backend (`apps/api`)**: Node.js + Express + PostgreSQL with repository-layer SQL.
- **Frontend (`apps/web`)**: React 18 + Vite + TypeScript with vanilla CSS.
- **Background Jobs (`apps/worker`)**: Independent service handling email dispatch (Nodemailer/SMTP), notifications, and webhook forwarding.
- **E2E (`apps/e2e`)**: Playwright browser/API flow validation.

## Current Project State
CustomerVoice has progressed through **Phase 6** in the roadmap model defined in `docs/CustomerVoice-Phases.md`.

Phase 6 implementation exists in code (SSE live updates, widget mode, MRR data path, SSO flow scaffolding, E2E scaffolding).  
Current focus is a **pre-Phase-7 gate**: close remaining Phase 6 gaps/bugs and stabilize end-to-end quality before new feature expansion.

Phase 7 planning is being prepared with competitor gap analysis and scope options, then priority selection will follow.

### Gate Status Snapshot (2026-03-07)
- Functional Phase 6 gap fixes shipped:
  - `highest_impact` sorting in public idea listing.
  - Internal-comment handling aligned for threaded flows (including public filtering).
  - Board settings update coverage expanded for access/auth/visibility toggles.
  - SSO connection management APIs added for workspace operators.
- Validation status:
  - ✅ `pnpm --filter @customervoice/api typecheck`
  - ✅ `pnpm --filter @customervoice/web typecheck`
  - ✅ `pnpm --filter @customervoice/e2e typecheck`
  - ✅ `pnpm --filter @customervoice/api test:integration`
  - ✅ `pnpm --filter @customervoice/e2e test:e2e`
  - ❌ `pnpm --filter @customervoice/api test:integration:db` (deadlock, duplicate seed key, merge-flow 500 in existing DB suite)
  - ❌ API/Web lint still have unresolved pre-existing errors

Open pre-Phase-7 blockers are DB-backed integration suite stability and lint baseline cleanup.

### Key References
- **`docs/CustomerVoice-Phases.md`**: A detailed outline of all historical and current development phases.
- **`docs/implementation_plan.md.resolved`**: Portal enhancement plan reference (feature-level detail).
- **`docs/CustomerVoice-Phase7-Planning.md`**: Competitor gap analysis and Phase 7 planning options.
- **`docs/CustomerVoice-Agent-Continuity-Checklist.md`**: Immediate context when continuing active work.
