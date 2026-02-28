# CustomerVoice Ticket Pack (CV-014 onward)

## 1. Scope lock and sequencing
1. **V1 completion before Phase-2 start (must ship first):**
- Public portal polish (search/sort/filter/category + richer moderation UX).
- Notification workflow (email upvoters/commenters on implemented status).
- Internal analytics dashboard (RICE + revenue potential + customer outreach).
2. **Phase-2 / V2:**
- Beta tester cohort management and targeting.
- White-label v2 (custom domain + branded email).
- SSO/embed integration for GoodHealth.ai and GoodWealth.ai.
3. **Phase-3 / V3:**
- AI delivery pipeline (PRD/research/design/dev/release gates).

## 2. Capacity and owner mapping
- Backend A: core product APIs, notifications, integration adapters.
- Backend B: moderation, scoring/analytics, policy/workflow services.
- Frontend: portal UX, dashboard UX, admin UX.
- PM/Designer: UX specs, copy, acceptance scripts, UAT ownership.
- Founder: pilot operations, external validation, release sign-off.

## 3. Ticket format
- ID
- Title
- Release target
- Owner
- Estimate (story points)
- Dependencies
- Description
- Acceptance criteria

## 4. Tickets

### CV-014
- Title: Extend ideas query API with search/sort/filter primitives
- Release target: V1
- Owner: Backend A
- Estimate: 5
- Dependencies: CV-012, CV-013
- Description:
Add server-side query support for status, category, keyword search, and sort modes (`top_voted`, `most_commented`, `newest`).
- Acceptance criteria:
1. `GET /ideas` supports stable query params for status/category/search/sort.
2. Sorting is deterministic and index-backed.
3. Integration tests cover each query path and workspace scoping.

### CV-015
- Title: Add idea category taxonomy and tagging model
- Release target: V1
- Owner: Backend B
- Estimate: 5
- Dependencies: CV-014
- Description:
Introduce workspace-level categories and idea-category linkage for portal filtering and triage.
- Acceptance criteria:
1. Migration adds category tables and relation indexes.
2. API supports category CRUD (workspace admin/PM roles).
3. Idea create/update can attach categories.

### CV-016
- Title: Ship portal search/sort/filter UX parity
- Release target: V1
- Owner: Frontend
- Estimate: 5
- Dependencies: CV-014, CV-015
- Description:
Implement search, status chips, category filter, and sort selector in board/idea listing UX.
- Acceptance criteria:
1. URL/state reflects active filters for shareable view state.
2. Empty/error/loading states are implemented for each filter path.
3. Viewer role can fully browse/filter without write controls.

### CV-017
- Title: Moderation action APIs (merge duplicate, mark spam, lock comments)
- Release target: V1
- Owner: Backend B
- Estimate: 8
- Dependencies: CV-015
- Description:
Add moderation command endpoints and audit events for portal hygiene and PM triage operations.
- Acceptance criteria:
1. Duplicate merge preserves vote/comment lineage.
2. Spam/lock actions are role-gated and reversible.
3. Every moderation action emits auditable metadata.

### CV-018
- Title: Moderation queue UX with bulk actions
- Release target: V1
- Owner: Frontend
- Estimate: 5
- Dependencies: CV-017
- Description:
Create internal moderation panel for filtering noisy ideas and executing moderation actions.
- Acceptance criteria:
1. Moderation queue supports status/category/search filters.
2. Bulk actions work for at least 20 selected ideas.
3. UI surfaces action history and failure reasons.

### CV-019
- Title: Notification event model and audience resolver
- Release target: V1
- Owner: Backend A
- Estimate: 5
- Dependencies: CV-017
- Description:
Define event model for idea status transition notifications and resolve audiences (upvoters + commenters).
- Acceptance criteria:
1. Status transition to `completed` creates a notification job payload.
2. Audience resolver deduplicates recipients across votes/comments.
3. Audit records capture recipient count and template id.

### CV-020
- Title: Email templates and worker dispatch for shipped ideas
- Release target: V1
- Owner: Backend A
- Estimate: 5
- Dependencies: CV-019
- Description:
Implement worker job for outbound email notifications on shipped ideas with retry and dead-letter handling.
- Acceptance criteria:
1. Email sent when status changes to `completed`.
2. Retry and DLQ path exist for SMTP/provider failures.
3. Template includes idea link, board context, and status summary.

### CV-021
- Title: Build analytics scoring engine (RICE + revenue potential)
- Release target: V1
- Owner: Backend B
- Estimate: 8
- Dependencies: CV-014, CV-015
- Description:
Create analytics service to compute RICE and revenue potential metrics per idea using workspace inputs.
- Acceptance criteria:
1. API returns reproducible RICE score breakdown per idea.
2. Revenue model supports customer segment weighting.
3. Unit tests cover scoring edge cases and normalization.

### CV-022
- Title: Internal analytics dashboard and outreach panel UX
- Release target: V1
- Owner: Frontend
- Estimate: 8
- Dependencies: CV-021
- Description:
Implement internal dashboard showing ranked ideas, revenue impact, and customer contacts for outreach.
- Acceptance criteria:
1. Dashboard supports filters by board, segment, and status.
2. Outreach list includes contact export and direct mail trigger action.
3. Role gating applied for internal-only analytics surfaces.

### CV-023
- Title: V1 parity QA/UAT and release hardening pass
- Release target: V1
- Owner: PM/Designer + Founder
- Estimate: 3
- Dependencies: CV-016, CV-018, CV-020, CV-022
- Description:
Run full UAT for new v1 parity scope and produce go/no-go checklist.
- Acceptance criteria:
1. UAT checklist executed with evidence links.
2. All P0/P1 defects closed or explicitly waived by founder.
3. Demo script validated across mock and Supabase auth modes.

### CV-024
- Title: Beta tester cohort domain model and APIs
- Release target: V2
- Owner: Backend A
- Estimate: 5
- Dependencies: CV-023
- Description:
Create cohort model, membership rules, invite state, and assignment APIs.
- Acceptance criteria:
1. Workspace can create named beta cohorts.
2. Idea or feature can target specific cohort(s).
3. Cohort membership changes are auditable.

### CV-025
- Title: Beta tester targeting UX and invite workflow
- Release target: V2
- Owner: Frontend
- Estimate: 5
- Dependencies: CV-024
- Description:
Add admin UX for cohort management, member assignment, and invite/send actions.
- Acceptance criteria:
1. Admin can create/edit/delete cohort and manage members.
2. Invite workflow supports preview + confirmation.
3. Cohort filters integrate with release communication UI.

### CV-026
- Title: White-label v2 backend (custom domain + branded email config)
- Release target: V2
- Owner: Backend B
- Estimate: 8
- Dependencies: CV-023
- Description:
Implement custom domain mapping, domain verification state model, and branded sender config APIs.
- Acceptance criteria:
1. Tenant can register custom domain and verification tokens.
2. Branded sender config supports SPF/DKIM validation state.
3. Fallback to default domain/sender on verification failure.

### CV-027
- Title: White-label v2 admin UX and preview
- Release target: V2
- Owner: Frontend
- Estimate: 5
- Dependencies: CV-026
- Description:
Deliver tenant admin UX for custom domain onboarding and branded email preview.
- Acceptance criteria:
1. Domain verification status is visible with remediation guidance.
2. Brand preview renders for portal and notification templates.
3. Tenant-scoped settings cannot leak cross-workspace.

### CV-028
- Title: GoodHealth/GoodWealth SSO federation backend
- Release target: V2
- Owner: Backend A
- Estimate: 8
- Dependencies: CV-023
- Description:
Add SSO trust setup and token-to-workspace mapping for sister-company integration.
- Acceptance criteria:
1. SSO login maps users to correct tenant/workspace roles.
2. Provisioning flow handles first-login membership creation.
3. Auth failures are logged with actionable error codes.

### CV-029
- Title: Embedded portal SDK and view-only integration flow
- Release target: V2
- Owner: Frontend
- Estimate: 5
- Dependencies: CV-028
- Description:
Implement embeddable portal shell and secure view-only session flow post-login.
- Acceptance criteria:
1. GoodHealth/GoodWealth can embed board/idea view with SSO session.
2. View-only users cannot perform write actions.
3. Embed mode has responsive desktop/mobile behavior.

### CV-030
- Title: V2 integration hardening and launch checklist
- Release target: V2
- Owner: PM/Designer + Founder
- Estimate: 3
- Dependencies: CV-025, CV-027, CV-029
- Description:
Run integration UAT/security checks and finalize V2 launch readiness.
- Acceptance criteria:
1. SSO/embed and white-label smoke tests pass.
2. Beta cohort campaign dry-run completed.
3. V2 release checklist signed by founder.

### CV-031
- Title: Workflow stage machine for AI delivery pipeline
- Release target: V3
- Owner: Backend B
- Estimate: 8
- Dependencies: CV-030
- Description:
Implement stage transitions from accepted idea to PRD/research/design/dev/release gates.
- Acceptance criteria:
1. Stage transitions are state-machine enforced.
2. Human approval gate remains default on every transition.
3. Stage history is fully auditable.

### CV-032
- Title: Configurable approval policy engine (gate-level quorum)
- Release target: V3
- Owner: Backend B
- Estimate: 8
- Dependencies: CV-031
- Description:
Support per-workspace approver lists, quorum rules, and escalation handling.
- Acceptance criteria:
1. Workspace admin can define gate-specific approval policy.
2. Policy checks block transitions when quorum not met.
3. Approval events are queryable for compliance evidence.

### CV-033
- Title: AI model routing layer (public API + private VPC option)
- Release target: V3
- Owner: Backend A
- Estimate: 8
- Dependencies: CV-031
- Description:
Add model provider abstraction supporting public LLM APIs and enterprise private model endpoints.
- Acceptance criteria:
1. Workspace-level model routing policy is configurable.
2. Private/VPC model path can run without public model dependency.
3. Token/cost and latency telemetry recorded per generation task.

### CV-034
- Title: PRD and market research generation module
- Release target: V3
- Owner: Backend A
- Estimate: 8
- Dependencies: CV-033
- Description:
Generate editable PRD and market research drafts from accepted ideas and template inputs.
- Acceptance criteria:
1. Generated artifacts are versioned and editable.
2. User can enforce required sections via template config.
3. Regeneration preserves audit lineage and prompt metadata.

### CV-035
- Title: Design and implementation/test-plan generation module
- Release target: V3
- Owner: Backend B
- Estimate: 8
- Dependencies: CV-034
- Description:
Generate design checklist + implementation plan + test plan before development gate.
- Acceptance criteria:
1. Artifacts are tied to gate approvals.
2. Plan output includes backend/frontend/testing breakdown.
3. Rejected outputs can be revised and resubmitted.

### CV-036
- Title: SCM check-in and deployment orchestration with approval controls
- Release target: V3
- Owner: Backend A
- Estimate: 8
- Dependencies: CV-035
- Description:
Integrate controlled SCM check-in and deploy/schedule actions with explicit approval defaults.
- Acceptance criteria:
1. Auto-commit/deploy remains opt-in and policy-gated.
2. Manual approval path is default and enforced.
3. Production test result summary is posted back to workspace timeline.

### CV-037
- Title: AI pipeline observability, cost guardrails, and V3 UAT
- Release target: V3
- Owner: PM/Designer + Founder + Backend B
- Estimate: 5
- Dependencies: CV-032, CV-033, CV-036
- Description:
Finalize V3 with AI quality controls, cost limits, and end-to-end UAT.
- Acceptance criteria:
1. Cost budget alarms and per-tenant usage views are active.
2. End-to-end pipeline UAT passes across at least two pilot workspaces.
3. Compliance-ready evidence pack generated for future SOC2/HIPAA/GDPR/ISO audits.

## 5. Release gates
1. **Gate A (enter V2):** CV-014 to CV-023 all accepted.
2. **Gate B (enter V3):** CV-024 to CV-030 all accepted.
3. **Gate C (AI production readiness):** CV-031 to CV-037 accepted with zero open P0/P1 defects.

## 6. Estimated capacity envelope
- V1 completion block (CV-014 to CV-023): **57 points**
- V2 block (CV-024 to CV-030): **39 points**
- V3 block (CV-031 to CV-037): **53 points**
- Total CV-014 onward: **149 points**
