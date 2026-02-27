# CustomerVoice Engineering Backlog (v1)

## 1. Delivery model
- Sprint cadence: 2 weeks.
- Planning horizon: 12 sprints (~6 months).
- Team: 2 backend, 1 frontend, 1 PM/designer, 1 founder/co-founder.
- Method: milestone-driven Scrum with weekly architecture and risk review.

## 2. Roles and ownership
1. Backend A:
- feedback domain, prioritization domain, integrations core.
2. Backend B:
- workflow engine, approval policy engine, AI orchestration, audit.
3. Frontend:
- portal UI, dashboard UI, brand theme UI, timeline UX.
4. PM/Designer:
- requirements, UX specs, copy, testing scripts, acceptance checks.
5. Founder:
- discovery calls, GTM alignment, UAT sign-off, pilot operations.

## 3. Epic map
1. E1 Platform foundation.
2. E2 Public feedback portal.
3. E3 Internal triage and prioritization.
4. E4 Workflow engine and approvals.
5. E5 AI discovery and planning drafts.
6. E6 Integrations (GitHub, Jira, Linear beta, Figma, Google Docs).
7. E7 Notifications and beta groups.
8. E8 White-label theme/logo.
9. E9 Security, compliance, observability hardening.
10. E10 GoodHealth/GoodWealth SSO embed and launch readiness.

## 4. Sprint-by-sprint backlog
## Sprint 1
Goals:
- Workspace and auth foundation.

Stories:
1. Create tenant/workspace schema and RBAC seed.
2. Implement Supabase auth integration.
3. Create gateway auth middleware and role checks.
4. Set up service skeleton and shared config packages.

Definition of done:
1. User can authenticate and access workspace-scoped APIs.
2. Base audit event emitted for auth and membership actions.

## Sprint 2
Goals:
- Public board and idea creation flow.

Stories:
1. Board CRUD and visibility model.
2. Idea create/list/search endpoints.
3. React portal board list/detail pages.
4. Basic moderation and rate-limit hooks.

Definition of done:
1. Public users can submit and browse ideas.
2. Search and pagination stable under load test baseline.

## Sprint 3
Goals:
- Votes, comments, statuses.

Stories:
1. Vote and unvote APIs with consistency checks.
2. Comment threads and status transitions.
3. Portal UI for vote/comment/status.
4. Activity timeline base model.

Definition of done:
1. Vote counts update reliably.
2. Comment and status actions appear in timeline.

## Sprint 4
Goals:
- Internal triage and dedupe.

Stories:
1. Internal queue UI with filters.
2. Merge duplicate ideas workflow.
3. Tagging and status bulk actions.
4. Audit entries for merge and moderation actions.

Definition of done:
1. PM can manage queue and dedupe noise.
2. Merge does not lose vote/comment lineage.

## Sprint 5
Goals:
- RICE and revenue potential dashboard.

Stories:
1. RICE input model and scoring service.
2. Revenue potential model and account impact views.
3. Dashboard ranking UI and segment filters.
4. CSV export for outreach lists.

Definition of done:
1. Ranked list generated with reproducible scoring.
2. Revenue and account impact visible per idea.

## Sprint 6
Goals:
- Workflow engine and gate approvals.

Stories:
1. Stage machine implementation.
2. Policy model for approver lists and quorum.
3. Approval request/decision APIs.
4. UI for gate status and approval actions.

Definition of done:
1. Stage changes blocked unless policy conditions pass.
2. Approval history fully auditable.

## Sprint 7
Goals:
- AI discovery and PRD draft generation.

Stories:
1. AI job queue and model routing.
2. PRD template engine and output schemas.
3. Discovery trigger from accepted ideas.
4. PRD editor with version history.

Definition of done:
1. AI generates editable PRD draft from accepted idea.
2. Prompt/output metadata stored with traceability.

## Sprint 8
Goals:
- Research and implementation/test plan drafts.

Stories:
1. Market research summary generator.
2. Implementation plan generator.
3. Test plan generator.
4. Approval gate integration for generated artifacts.

Definition of done:
1. Plan draft supports backend/frontend/ops breakdown.
2. Test plan includes unit/integration/e2e sections.

## Sprint 9
Goals:
- GitHub and Jira integrations.

Stories:
1. GitHub app connection and repo linking.
2. PR/branch status sync into feature timeline.
3. Jira issue creation and status sync.
4. Connector retry and error dashboard.

Definition of done:
1. Tasks from approved plans can be pushed to Jira.
2. GitHub PR status visible on feature detail page.

## Sprint 10
Goals:
- Linear beta + Figma + Google Docs integration.

Stories:
1. Linear beta connector with feature toggle.
2. Figma artifact link and metadata sync.
3. Google Docs artifact creation/link support.
4. Integration observability and alerting rules.

Definition of done:
1. Workspace can choose Jira or Linear beta path.
2. Design/docs links visible in timeline with metadata.

## Sprint 11
Goals:
- Notifications, beta groups, white-label theme/logo.

Stories:
1. Release notification audience resolver.
2. Email templates for shipped feature updates.
3. Beta tester cohort model and invite flow.
4. White-label theme/logo admin and preview.

Definition of done:
1. Feature release triggers notifications to upvoters/commenters.
2. Tenant brand theme/logo applied in portal.

## Sprint 12
Goals:
- Security hardening, SLO validation, launch readiness.

Stories:
1. Security scanning and remediation pass.
2. Observability SLO dashboards and alert runbooks.
3. GoodHealth/GoodWealth SSO embed rollout.
4. UAT, bug bash, and release sign-off checklist.

Definition of done:
1. No open P0/P1 defects.
2. End-to-end workflow validated in both sister companies.

## 5. Backlog sizing (rough)
1. E1 Platform foundation: 24 points.
2. E2 Public portal: 28 points.
3. E3 Triage/prioritization: 26 points.
4. E4 Workflow/approvals: 24 points.
5. E5 AI drafts: 30 points.
6. E6 Integrations: 36 points.
7. E7 Notifications/beta groups: 18 points.
8. E8 White-label v1: 10 points.
9. E9 Security/compliance hardening: 20 points.
10. E10 Launch rollout: 12 points.

Total rough scope: 228 points.

## 6. Critical dependencies
1. Auth and workspace model before portal and dashboard scopes.
2. Workflow engine before AI generation features.
3. Approval policy before connector write actions.
4. Audit/event framework before compliance-hardening sprint.
5. Integration foundation before notification and release-loop automation.

## 7. Quality gates
1. Unit tests required for core domain services.
2. Integration tests required for each connector adapter.
3. E2E tests for:
- public idea flow.
- approval flow.
- release notification flow.
4. Security gate:
- dependency scan, secret scan, container scan must pass.
5. Performance gate:
- load test on idea list, vote endpoint, and dashboard summary endpoint.

## 8. Release checklist
1. Product checklist:
- all v1 mandatory features accepted.
2. Engineering checklist:
- migrations verified.
- rollback plans validated.
- monitoring alerts active.
3. Security checklist:
- no critical vulnerabilities.
- secret rotation completed for production.
4. Operations checklist:
- support runbook and incident on-call rotation active.

## 9. Risks and fallback plans
1. Connector API changes:
- fallback: adapter versioning and circuit breaker policy.
2. AI quality inconsistency:
- fallback: stricter template schema and lower-temperature defaults.
3. Scope pressure:
- fallback: keep integration depth, cut non-critical UI polish.
4. Team bandwidth:
- fallback: reserve one sprint buffer or move Linear beta to late-beta if needed.

## 10. Monetization transition backlog
When 50 external active logos is reached:
1. enable billing module feature flags.
2. configure 30-day transition policy default.
3. add workspace-level transition override.
4. launch in-app pricing notices and admin comms workflow.

## 11. Data residency rollout backlog
1. Implement residency-zone config model with `US` enabled by default.
2. Add admin controls to enable `EU` or `India` zones explicitly.
3. Add tenant pinning to one active residency zone.
4. Add migration workflow and audit requirements for cross-zone moves.
5. Add `new-zone` rollout checklist for regions outside US/EU/India.
