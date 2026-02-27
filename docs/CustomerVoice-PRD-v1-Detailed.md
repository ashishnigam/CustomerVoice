# CustomerVoice PRD v1 (Detailed)

## 1. Document control
- Product: CustomerVoice
- Version: v1.0
- Date: 2026-02-27
- Owners: Founder/CEO, PM
- Engineering leads: Backend Lead, Frontend Lead

## 2. Product summary
CustomerVoice v1 is a feedback-to-planning platform. It combines a simple public feedback portal (ideas, upvotes, comments, status) with an internal dashboard and AI-assisted workflow for PRD/research/implementation planning drafts.

The initial production tenants are GoodHealth.ai and GoodWealth.ai. External B2B SaaS tenants are acquired in parallel.

## 3. Goals
1. Launch a global-ready feedback platform with Microsoft-style simplicity for end users.
2. Give product and engineering teams an internal dashboard that ties votes to prioritization and commercial impact.
3. Enable AI-assisted workflow drafts with explicit human approvals by default.
4. Support white-label theme/logo in v1 for enterprise pilots.
5. Close the loop with release notifications and beta tester targeting.

## 4. Non-goals
1. Autonomous deployment execution.
2. Full custom domain and branded email white-label.
3. Comprehensive design automation.
4. All possible integrations at launch.

## 5. Personas
1. Community user / customer
- submits ideas, upvotes, comments, tracks status.

2. Product manager
- triages feedback, merges duplicates, prioritizes ideas, triggers discovery.

3. Engineering manager
- consumes approved PRD/plan drafts, maps to Jira/Linear and GitHub workflows.

4. Customer success / revenue owner
- views affected accounts, revenue impact, and outreach opportunities.

5. Tenant admin
- configures workspace, policies, approval lists, and brand theme/logo.

## 6. Core user journeys
## Journey A: Public feedback flow
1. User opens board.
2. User searches existing ideas.
3. User upvotes/comments existing idea or submits new one.
4. User receives status updates as workflow progresses.

## Journey B: Internal prioritization and acceptance
1. PM opens internal queue.
2. PM merges duplicates and tags ideas.
3. PM reviews RICE + revenue potential signals.
4. PM moves selected idea to `Accepted for Discovery`.
5. Workflow engine opens AI draft stage.

## Journey C: AI-assisted planning
1. PM selects template and optional extra instructions.
2. AI generates PRD/research draft.
3. PM edits and requests approvals.
4. After PRD approval, AI generates implementation/test plan draft.
5. Eng manager approves and syncs tasks to Jira/Linear.

## Journey D: Delivery status and release loop
1. Team links GitHub PR/branch activity.
2. PM monitors status and marks feature released.
3. Notification service emails upvoters/commenters.
4. PM selects beta groups for targeted rollout feedback.

## 7. Functional requirements with acceptance criteria
## 7.1 Workspace, auth, and policy
### FR-001: Tenant/workspace model
- System supports tenant -> workspace hierarchy.
- Acceptance:
1. User can belong to multiple workspaces.
2. Data is scoped to workspace and tenant.

### FR-002: Authentication
- Supabase-based auth with email/password and Google.
- Acceptance:
1. Login/logout/session refresh works for web.
2. Role claims are available to backend services.

### FR-003: Approval policies
- Workspace admins can configure approval lists and gate rules.
- Acceptance:
1. Policy editor supports role-based and user-based approvers.
2. Workflow blocks restricted transitions without approvals.

## 7.2 Public feedback portal
### FR-010: Board listing and details
- Users can browse board and see idea cards.
- Acceptance:
1. List renders with pagination and sort by newest/top.
2. Status badge visible on each idea.

### FR-011: Idea create/search
- Users can search and create ideas.
- Acceptance:
1. Search includes title and description.
2. Duplicate suggestion prompt appears on create.

### FR-012: Vote and comment
- Users can vote and comment on ideas.
- Acceptance:
1. Vote count updates in near real time.
2. Comment thread persists author and timestamp.

## 7.3 Internal dashboard and prioritization
### FR-020: Internal triage queue
- PM can filter by status/tag/segment and merge duplicates.
- Acceptance:
1. Merge action preserves vote/comment relationships.
2. Audit timeline records merge source and target.

### FR-021: RICE scoring
- PM can set and view RICE dimensions.
- Acceptance:
1. Score recomputes when inputs change.
2. Sorted ranked list available.

### FR-022: Revenue potential insights
- Dashboard shows account tier and estimated revenue impact.
- Acceptance:
1. Affected customer accounts list visible per idea.
2. Revenue band and impacted account counts displayed.

## 7.4 AI workflow
### FR-030: Discovery trigger
- Setting idea to `Accepted for Discovery` starts AI draft workflow.
- Acceptance:
1. Workflow state changes to discovery stage.
2. AI job enqueued with traceable job ID.

### FR-031: PRD/research draft generation
- AI creates structured draft from template.
- Acceptance:
1. Output contains required sections (problem, personas, requirements, metrics).
2. Output is editable and versioned.
3. Model/provider metadata is recorded.

### FR-032: Plan and test draft generation
- AI generates implementation plan and test outline.
- Acceptance:
1. Task list grouped by backend/frontend/ops.
2. Test outline includes unit/integration/e2e sections.

### FR-033: Human-approval default
- AI outputs cannot trigger external write actions without approval.
- Acceptance:
1. System enforces gate checks on every stage.
2. Override action is audit-logged.

## 7.5 Integrations (v1)
### FR-040: GitHub integration
- Link repos and PR state to features.
- Acceptance:
1. User can connect workspace to GitHub installation.
2. Linked PR status appears in feature timeline.

### FR-041: Jira integration (primary)
- Push approved tasks to Jira.
- Acceptance:
1. Bulk create issues from plan draft.
2. Store external issue IDs and sync status.

### FR-042: Linear integration (beta)
- Push approved tasks to Linear as beta connector.
- Acceptance:
1. Workspace-level beta toggle.
2. Error handling and retry for failed syncs.

### FR-043: Figma + Google Docs links
- Attach design/doc artifacts to feature workflow.
- Acceptance:
1. User can add artifact links with metadata.
2. Activity timeline captures link actions.

## 7.6 Notifications and beta groups
### FR-050: Release notifications
- On feature release, notify upvoters and commenters.
- Acceptance:
1. Audience resolved without duplicates.
2. Delivery status tracked (queued/sent/failed).

### FR-051: Beta tester groups
- PM can create and target beta cohorts.
- Acceptance:
1. Group can be built by explicit list or segment rules.
2. Invite event is logged on feature timeline.

## 7.7 White-label v1
### FR-060: Theme/logo branding
- Tenant admin can configure colors and logo.
- Acceptance:
1. Branding applies to public board and key emails.
2. Branding changes are previewable before publish.

## 8. Non-functional requirements
1. Availability target: 99.5% monthly.
2. API p95 latency target: < 400 ms for common reads.
3. Tenant-isolated data access enforcement.
4. Audit trail for all admin, policy, and AI actions.
5. Global-ready timezone and locale support.
6. Accessibility target: WCAG 2.2 AA baseline for portal pages.

## 9. Security and compliance requirements
1. Encryption in transit and at rest.
2. RBAC with least privilege and role reviews.
3. Connector token encryption and rotation support.
4. DSAR-aligned export/delete workflow readiness.
5. AI prompt/output logging with configurable retention policy.
6. Security event monitoring and incident runbook.

## 10. Analytics and success metrics
## Launch metrics (first 6 months)
1. Customers:
- 2 sister-company production tenants.
- 8-12 external design partners.
2. ARR:
- conversion pipeline prepared for paid rollout after threshold.
3. Activation:
- >=60% create first board in 24h.
- >=40% move one idea to discovery in 14 days.

## Product metrics
1. Time from accepted idea to approved PRD draft.
2. Time from approved PRD draft to plan sync.
3. Release notification completion rate.
4. Percentage of accepted ideas that complete workflow stages.

## 11. Release criteria for v1 GA
1. All mandatory v1 features marked complete.
2. No P0/P1 security defects open.
3. Integration error rate below agreed SLO for two consecutive weeks.
4. End-to-end workflow demo successful in both GoodHealth and GoodWealth tenants.

## 12. Rollout plan
1. Alpha:
- internal users only.
2. Beta:
- GoodHealth + GoodWealth + selected external design partners.
3. GA:
- open onboarding with free-beta policy.
4. Monetization:
- trigger after 50 active external logos.
- default 30-day transition; configurable per tenant cohort.

## 13. Risks and mitigations
1. Risk: connector instability across APIs.
- Mitigation: retries, queue isolation, staged beta flags.
2. Risk: AI output quality variance.
- Mitigation: templates, structured schemas, human approval gates.
3. Risk: compliance lag during growth.
- Mitigation: evidence capture and policy controls from first release.
4. Risk: team bandwidth with integration-heavy scope.
- Mitigation: strict phase sequencing and tool-depth-first strategy.

## 14. Data residency policy (locked)
1. US zone is enabled by default for cloud deployment.
2. EU and India zones are supported but remain disabled until explicitly enabled.
3. Regions outside US/EU/India are added only through controlled new-zone enablement based on country/company requirements.
