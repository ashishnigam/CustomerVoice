# CustomerVoice Product Requirements Document (v2)

Last updated: 2026-03-07

## 1. Product Vision
CustomerVoice is a multi-tenant feedback and roadmap platform for B2B software teams. The product is designed to collect customer demand in a public portal, help product teams moderate and prioritize that demand internally, and close the loop through roadmap visibility, changelog publishing, and outbound notifications.

Current product focus is the feedback platform itself. AI workflow orchestration remains part of the longer-term company vision, but it is intentionally deferred until the current feedback product is more stable and commercially ready.

## 2. Product Positioning (Current)
CustomerVoice currently competes as a modern feedback operations product in the same broad category as UserVoice, Canny, Frill, and Productboard portal workflows.

Positioning emphasis:
- Transparent public intake: ideas, votes, comments, roadmap, changelog.
- Internal operator leverage: moderation, dedupe, scoring, outreach, and analytics.
- Enterprise baseline: SSO connection APIs, policy controls, auditability, widget support, and white-label foundation.
- External SaaS commercialization first: roadmap priority is driven by hosted SaaS readiness before sister-company-specific embed or AI workflow expansion.

## 3. Shipped Product Scope (Actual Current State)

### 3.1 Public Portal
- Board portal by slug under `/portal/boards/:slug`.
- Idea submission, voting, commenting, status visibility, search, sort, and category filtering.
- Roadmap tab and changelog tab.
- Threaded comments, comment upvotes, markdown rendering, and attachments.
- User account flows: register, login, logout, `me`, forgot password, reset password.
- Profile update, favorites, follows/subscriptions, and deep-linked idea detail views.
- Widget mode (`?widget=true`) plus embeddable widget script.
- SSE live updates for vote and comment activity.
- Board access modes including public, private, link-only, and domain-restricted.

### 3.2 Internal Product Operations
- Internal workspace shell under `/app`.
- Board creation and board route management.
- Category creation and management.
- Idea status management and portal preview.
- Moderation queue for spam, restore, comment lock/unlock, duplicate merge, and bulk actions.
- Internal analytics for RICE, revenue potential, audience contact discovery, CSV export, and outreach enqueue.
- MRR-backed impact scoring and `highest_impact` sorting support.

### 3.3 Board Administration
- Board-scoped admin surface under `/admin/boards/:slug`.
- Portal branding controls: logo, accent color, header color, title, welcome copy, powered-by toggle.
- Access controls: board access mode, auth requirements, and domain/email allowlists for restricted boards.
- Changelog publishing UI with markdown editor.
- Webhook CRUD UI and delivery configuration.

### 3.4 Platform Services
- Worker-driven email notification processing.
- Webhook dispatch from worker jobs.
- Workspace membership APIs and RBAC enforcement.
- Audit event persistence.
- Mock auth mode and Supabase JWT validation path.
- Baseline SSO login/callback flow and SSO connection management APIs.
- Playwright E2E baseline and DB-backed integration coverage.

## 4. Actual Architecture Overview

### 4.1 Monorepo Structure
- `apps/api`: Node.js + Express + TypeScript + PostgreSQL.
- `apps/web`: React + Vite + TypeScript.
- `apps/worker`: Node.js + TypeScript notification and webhook dispatcher.
- `apps/mobile`: React Native shell placeholder.
- `apps/e2e`: Playwright test project.
- `packages/*`: shared package stubs and shared types/config.

### 4.2 Implementation Notes
- Public routes are served from `/api/v1/public/*`.
- Authenticated workspace routes are served from `/api/v1/workspaces/:workspaceId/*`.
- Validation is primarily Zod-based in the API route layer.
- Persistence currently centers on repository functions in `apps/api/src/db/repositories.ts`.
- Local infrastructure uses Docker Compose with Postgres, Redis, MailHog, and MinIO.

## 5. Current Product Boundaries

### 5.1 Included Now
- Feedback portal and internal moderation/prioritization product.
- Public roadmap and changelog communication loop.
- Operator analytics and outreach workflows.
- Enterprise baseline features needed for hosted SaaS evolution.

### 5.2 Explicitly Not Complete Yet
- Stripe billing, plan entitlements, and commercial enforcement.
- Full-text or semantic search beyond current keyword search.
- Rich prioritization model editor beyond current RICE/revenue/MRR signals.
- Full enterprise identity hardening such as multi-IdP lifecycle admin and SCIM-like provisioning.
- Full white-label package including custom domains and branded email delivery.
- GoodHealth.ai and GoodWealth.ai embed-specific productization.
- AI workflow pipeline for PRD/design/dev/test/release orchestration.

## 6. Roadmap Position

### 6.1 Immediate Priority
Before larger roadmap expansion, CustomerVoice should continue hardening the current feedback product for external SaaS commercialization. Immediate correctness work includes auth callback handling, restricted-board enforcement, and enterprise access UX.

### 6.2 Phase 7 Candidate Scope
Phase 7 is now treated as a consolidated planning bucket with three candidate workstreams:
1. Stability and production-readiness hardening.
2. Billing, entitlements, and commercialization controls.
3. Search, prioritization, and operator analytics depth.

The exact split between Phase 7 and Phase 8 is still open.

### 6.3 Deferred Strategic Work
AI workflow orchestration remains strategically important, but it is not the current implementation target. It should resume only after the feedback product has stronger stability, enterprise correctness, and commercialization foundations.

## 7. Success Criteria For The Current Product Stage
- Hosted SaaS onboarding feels coherent for external customers.
- Restricted boards and enterprise access controls behave correctly end-to-end.
- Moderation and prioritization workflows support manual customer-facing operations without obvious gaps.
- The roadmap/changelog/notification loop works reliably enough for beta-to-paid transition planning.
- Documentation accurately reflects shipped behavior and near-term roadmap decisions.
