# CustomerVoice Live Working Context

## 1. Purpose
This is the single working context file for founders, team members, and AI agents. Update it whenever ticket status, scope, architecture, or operating decisions change.

## 2. Product summary
CustomerVoice is a multi-tenant feedback and product decision platform inspired by UserVoice and the Microsoft Feedback Portal pattern.

Core V1 thesis:
1. Publicly collect demand through boards, ideas, votes, comments, statuses, and search/filter flows.
2. Give product and engineering teams an internal cockpit for moderation, prioritization, and customer outreach.
3. Close the loop with notifications when ideas ship.

## 3. Locked business decisions
1. Prioritization driver: external B2B SaaS commercialization first. GoodHealth.ai and GoodWealth.ai remain valuable internal references, but they are not the primary forcing function for roadmap order.
2. Region posture: global from day 1.
3. GTM: hybrid, with strong SEO/content for self-serve acquisition and sales-led support for larger accounts.
4. Pricing: free beta until 50 external logos, then configurable 30-day transition before paid rollout.
5. Compliance posture: no certification claim yet, but architecture should stay ready for SOC 2, HIPAA, GDPR, and ISO 27001. Extend to additional compliance only as target-market demand requires.
6. AI model posture: support both third-party LLM APIs and private model or VPC options for enterprise customers.
7. Approval posture: default human approval at every gate; customer-configurable later.
8. Cloud posture: stay cloud-agnostic; AWS or GCP possible, GCP is tie-breaker only if a provider-specific choice is needed.
9. Local run target: Docker Compose.
10. Cloud runtime target: Kubernetes.
11. Sequencing rule: continue focusing on the current feedback product. AI workflow platform work is post-stability, post-correctness, and post-commercialization foundation.

## 4. Scope map by phase
### V1
1. Microsoft-style public feedback portal UX baseline.
2. Internal moderation workflows.
3. Internal analytics dashboard with RICE, revenue potential, and outreach.
4. Completion notification workflow.
5. White-label foundation with theme/logo direction only.

### V2
1. Beta tester cohort management and targeting.
2. White-label custom domain and branded email.
3. GoodHealth.ai and GoodWealth.ai SSO plus embedded portal view.
4. Single-tenant or VPC deployment profile.

### V3
1. AI delivery pipeline for research, PRD, design, development, release, and production validation gates.

## 5. Current repository map
1. `/Users/ashishnigam/Startups/CustomerVoice/apps/web`: React web app.
2. `/Users/ashishnigam/Startups/CustomerVoice/apps/api`: Node and Express API.
3. `/Users/ashishnigam/Startups/CustomerVoice/apps/worker`: notification worker.
4. `/Users/ashishnigam/Startups/CustomerVoice/apps/mobile`: React Native shell.
5. `/Users/ashishnigam/Startups/CustomerVoice/infra/docker`: local Docker Compose stack.
6. `/Users/ashishnigam/Startups/CustomerVoice/infra/k8s`: cloud deployment baseline.
7. `/Users/ashishnigam/Startups/CustomerVoice/infra/terraform`: infrastructure-as-code starter.
8. `/Users/ashishnigam/Startups/CustomerVoice/docs`: product, architecture, QA, and backlog documents.

## 6. Delivered ticket status
### Sprint 1 and foundation
| Ticket | Status | Delivered outcome |
|---|---|---|
| CV-001 | Completed | Monorepo skeleton, workspace tooling, baseline README. |
| CV-002 | Completed | Tenant, workspace, membership, role, and RBAC schema foundation. |
| CV-003 | Completed | Supabase JWT verification path and auth handling. |
| CV-004 | Completed | Workspace membership APIs. |
| CV-005 | Completed | Policy engine and permission enforcement. |
| CV-006 | Completed | Web auth shell, workspace switching, unauthorized redirect. |
| CV-007 | Completed | Docker Compose baseline for local stack. |
| CV-008 | Completed | Audit event framework foundation. |
| CV-009 | Completed | CI baseline. |
| CV-010 | Completed | UX and copy spec artifact. |
| CV-011 | Completed | QA and UAT checklist artifact plus integration coverage. |
| CV-012 | Completed | Board CRUD API and persistence foundation. |
| CV-013 | Completed | Web board list wired to live APIs. |

### V1 parity completion block
| Ticket | Status | Delivered outcome |
|---|---|---|
| CV-014 | Completed | Ideas query API with search, sort, and filters. |
| CV-015 | Completed | Category taxonomy and idea tagging model. |
| CV-016 | Completed | Portal search, sort, filter, and category UX. |
| CV-017 | Completed | Moderation APIs for spam, restore, comment lock, and duplicate merge. |
| CV-018 | Completed | Moderation queue UX with bulk actions. |
| CV-019 | Completed | Notification event model and audience resolution. |
| CV-020 | Completed | Worker dispatch for shipped idea notifications. |
| CV-021 | Completed | Analytics scoring engine for RICE and revenue potential. |
| CV-022 | Completed | Internal analytics dashboard and outreach UX. |
| CV-023 | Completed | V1 parity QA and UAT checklist. |

## 7. Current readiness statement
1. CustomerVoice is ready for manual UAT for the agreed V1 scope.
2. This is scoped parity with the discussed Microsoft-style feedback portal model, not a claim of full Microsoft platform duplication.
3. The detailed readiness basis lives in `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-V1-Parity-Mapping.md`.

## 8. What is live in the codebase now
1. Marketing website routes at `/`, `/features`, `/pricing`, `/blog`, `/docs`, `/docs/api`, and `/docs/integrations`.
2. Brand summary route at `/docs/brand`.
3. Web application route at `/app` plus shareable board routes at `/app/boards/:slug`.
4. Public portal workflows for boards, ideas, votes, comments, statuses, search, sort, category filtering, roadmap, and changelog.
5. Public-user capabilities for register/login/logout, password reset, profile read/update, follow, favorite, threaded comments, comment upvotes, and attachments.
6. Widget mode and embeddable widget script for the public portal.
7. Internal moderation workflows for spam, restore, comment lock, duplicate merge, internal notes, and bulk actions.
8. Internal analytics for RICE, revenue potential, audience discovery, CSV export, outreach enqueue, and MRR-backed impact sorting.
9. Board admin capabilities for settings, branding, access controls, changelog publishing, and webhook configuration.
10. Notification worker for shipped idea emails and webhook dispatch.
11. Mock auth and Supabase auth modes plus baseline SSO login/callback and SSO connection management APIs.
12. Product UX split between board setup and customer-facing board preview.

## 9. Remaining work by phase
### Phase 7 planning block (locked)
1. Phase 7 is now the true multi-tenant foundation phase.
2. Scope includes enterprise-domain tenant resolution, personal tenants for public-email users, tenant-aware auth/session handling, tenant-aware public routing, SSO/domain administration, and migration/cutover.
3. Correctness fixes for restricted boards, auth callbacks, and enterprise access UX are included because they are part of the tenant-hardening path.
4. All previously discussed non-tenancy feature work moves to Phase 8; see `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-Phase7-Planning.md`.

### Phase 8 backlog
1. CV-024: beta tester cohort domain model and APIs.
2. CV-025: beta tester targeting UX and invite workflow.
3. CV-026: white-label v2 backend for custom domain and branded email config.
4. CV-027: white-label v2 admin UX and preview.
5. CV-028: GoodHealth and GoodWealth SSO federation backend.
6. CV-029: embedded portal SDK and view-only integration flow.
7. CV-030: V2 integration hardening and launch checklist.
8. AI delivery pipeline stages and approval-gate orchestration.

## 10. Local execution runbook
1. Install dependencies:
```bash
pnpm install
```
2. Copy env files:
```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/mobile/.env.example apps/mobile/.env
```
3. Start local infrastructure:
```bash
POSTGRES_PORT=55432 docker compose -f infra/docker/docker-compose.yml up -d postgres redis mailhog minio
```
4. Run migrations:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/customervoice pnpm --filter @customervoice/api db:migrate
```
5. Start apps:
```bash
pnpm dev
```

## 11. Local URLs
1. Website and web app shell: `http://localhost:3333`
2. Direct application route: `http://localhost:3333/app`
3. API: `http://localhost:4000`
4. Redis: `redis://localhost:6379`
5. MailHog SMTP: `localhost:1025`
6. MailHog UI: `http://localhost:8025`
7. MinIO API: `http://localhost:9000`
8. MinIO UI: `http://localhost:9001`
9. Local Postgres host port: `55432` by default.

## 12. Test commands
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @customervoice/api test:integration:db
```

## 13. Manual UAT references
1. V1 parity checklist: `/Users/ashishnigam/Startups/CustomerVoice/docs/CV-023-V1-Parity-QA-UAT-Checklist.md`
2. V1 scoped parity map: `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-V1-Parity-Mapping.md`
3. UX and copy reference: `/Users/ashishnigam/Startups/CustomerVoice/docs/CV-010-UX-Copy-Spec.md`
4. Brand guideline source: `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-Brand-Guidelines.md`
5. Current execution tracker: `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-Execution-Tracker.md`

## 14. Source-of-truth planning docs
1. `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-Master-Execution-Pack-v1.md`
2. `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-Architecture-Spec-v1.md`
3. `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-PRD-v1-Detailed.md`
4. `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-Engineering-Backlog-v1.md`
5. `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-Phase2-Ticket-Pack-CV014-Plus.md`

## 15. Working rules for humans and AI agents
1. Do not rely on chat history as the primary source of product context.
2. Update this file when scope, ticket status, readiness, or operational commands change.
3. Reference exact docs and exact file paths for any claim about implementation.
4. Distinguish clearly between implemented features, planned features, and deferred roadmap work.
5. Preserve the V1, V2, and V3 scope boundaries unless the founder explicitly changes them.
