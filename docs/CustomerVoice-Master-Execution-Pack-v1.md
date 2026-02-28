# CustomerVoice Master Execution Pack (v1)

## 1. Purpose
Single reference file to execute CustomerVoice v1 from decision lock to build start.

## 2. Locked business and product decisions
1. ICP: GoodHealth.ai and GoodWealth.ai first, external B2B SaaS in parallel.
2. Region strategy: global product posture from day 1.
3. GTM: hybrid, SEO-heavy self-serve plus sales motion.
4. Pricing: free beta until 50 active external logos.
5. Paid transition: configurable, default 30-day rollout window.
6. v1 issue tracker: Jira primary + Linear beta.
7. White-label depth: v1 theme/logo only; v2 adds custom domain + branded email.
8. Cloud policy: cloud-agnostic; choose provider by startup credits; GCP tie-breaker if required.
9. Data residency:
- US zone enabled by default.
- EU and India supported but disabled until explicit enablement.
- Any other region enabled only via deliberate new-zone rollout.

## 3. v1 mandatory feature contract
1. Public Microsoft-style feedback portal:
- idea submission, votes, comments, status visibility, search.
2. Internal dashboard:
- dedupe/merge, RICE, revenue potential, customer impact and outreach.
3. Enterprise white-label foundation:
- theme/logo.
4. Workflow completion:
- notify voters/commenters when feature ships.
- moderation UX with merge/spam/lock actions.

## 4. Architecture baseline
1. Stack:
- Node.js backend services.
- React web app.
- React Native mobile app.
2. Runtime:
- local: Docker Compose.
- cloud: Kubernetes.
3. Tenant model:
- v1 multi-tenant.
- phase 2 single-tenant/VPC profile.
4. Integrations:
- GitHub, Jira, Linear beta, Figma, Google Docs.
5. Identity:
- Supabase auth + Google + enterprise SSO.

## 5. Release phases (6 months)
1. Phase 0 (Weeks 1-4): auth/workspace/board foundation.
2. Phase 1 (Weeks 5-10): portal polish + moderation + notifications + internal analytics (RICE/revenue/outreach).
3. Phase 2 (Weeks 11-16): beta cohorts + white-label v2 (custom domain/branded email) + GoodHealth/GoodWealth SSO embed.
4. Phase 3 (Weeks 17-24): AI delivery pipeline (PRD/research/design/dev/release gates) with human approvals by default.

## 6. Engineering operating system
1. Sprint length: 2 weeks.
2. Core ceremonies:
- sprint planning.
- architecture review.
- security/compliance check.
- product/metrics review.
3. Quality gates:
- lint/typecheck/tests/security scans.
- e2e tests on core workflows.
4. Release gates:
- no P0/P1 defects.
- sister-company end-to-end validation.

## 7. KPI dashboard targets
1. Activation:
- >=60% create first board in 24h.
- >=40% move one idea to discovery in 14 days.
2. Customer footprint:
- GoodHealth + GoodWealth live.
- 8-12 external design partners in beta.
3. Workflow outcomes:
- median time to first PRD draft.
- median time from approved PRD to issue sync.

## 8. Risk controls
1. Connector risk:
- adapter boundaries, retries, DLQ, feature flags.
2. AI quality risk:
- structured templates, schema validation, human gate approvals.
3. Compliance risk:
- evidence and audit from day 1.
4. Scope risk:
- keep integration depth; defer non-critical surfaces.

## 9. Immediate execution order (next 10 working days)
1. Initialize/attach GitHub repository and monorepo skeleton.
2. Stand up local stack via Docker Compose.
3. Implement auth + tenant/workspace + role model.
4. Build board + idea create/list/search.
5. Implement vote/comment/status and timeline events.
6. Add internal triage queue and dedupe merge.
7. Create baseline audit event framework.

## 10. Artifact map
1. Founding blueprint:
- `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-Founding-Blueprint-v1.md`
2. Architecture spec:
- `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-Architecture-Spec-v1.md`
3. Detailed PRD:
- `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-PRD-v1-Detailed.md`
4. Engineering backlog:
- `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-Engineering-Backlog-v1.md`
5. Command plan:
- `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-Implementation-Command-Plan.md`
6. CV-014+ ticket pack:
- `/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-Phase2-Ticket-Pack-CV014-Plus.md`

## 11. Final remaining strategic choice
1. Select first cloud provider once startup program approvals are known.
