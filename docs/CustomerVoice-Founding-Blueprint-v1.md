# CustomerVoice Founding Blueprint (v1)

## 1) Requirement Lock (based on your decisions)

### Business and GTM
- Launch model: dual-track ICP.
- Primary early users: GoodHealth.ai and GoodWealth.ai (sister companies).
- Secondary expansion: external B2B SaaS customers.
- Region: global from day 1.
- GTM: hybrid (sales-led + strong self-serve SEO/content engine).
- Pricing at launch: free beta until customer threshold is reached.
- Strategic objective: build traction + funding narrative with product-led growth signals.

### Product Scope
- Core UX benchmark: Microsoft Feedback Portal style simplicity (ideas, votes, comments, statuses).
- Non-negotiable v1:
1. Core feedback portal parity with Microsoft-style flow.
2. Enterprise white-label capability.
3. Internal dashboard with RICE + revenue potential + customer context + outreach.
4. Workflow completion features:
   - Notify voters/commenters when feature ships.
   - Beta tester group selection.

### AI Workflow Direction
- AI workflow stages: Feedback -> Discovery/PRD -> Design (optional) -> Plan -> Dev -> Test -> Review -> SCM/Deploy -> Post-release validation.
- Default policy: explicit human approval at every gate.
- Override policy: configurable per workspace with approval lists.
- Integrations philosophy: one best-fit tool per stage initially (based on market adoption and integration maturity), then expand connectors.

### Platform and Tech
- Stack: Node.js + React web + React Native mobile.
- Cloud strategy: cloud-agnostic architecture, choose provider based on startup program acceptance; default tie-breaker is GCP if cloud-specific optimizations are required.
- Local developer experience: Docker Compose.
- Cloud runtime: Kubernetes.
- Tenant model:
  - v1: multi-tenant SaaS.
  - immediate post-v1 / phase 2: single-tenant/VPC option.
- GoodHealth/GoodWealth integration: SSO + embedded view.
- Identity: own auth UX backed by Supabase Auth + enterprise SSO + Google social login.

### Delivery Team Constraint (first 3 months)
- 5 members:
1. Backend engineer (platform/integrations).
2. Backend engineer (AI workflow/data).
3. Frontend engineer (web/mobile shell).
4. PM + designer.
5. Founder/co-founder (product + QA + customer + operations support).

---

## 2) Business Plan (gap-closed)

## 2.1 Company Thesis
CustomerVoice is not just a feedback board. It is a feedback-to-delivery operating system that turns customer demand signals into execution artifacts (PRD, design brief, implementation plan, test plan) with strong human governance.

## 2.2 Problem
- Feedback tools collect ideas but do not reliably convert them to shipped outcomes.
- Product and engineering teams lose context between voting boards, PRDs, design, issue trackers, and release systems.
- Enterprise teams need auditability, approvals, and compliance-ready controls before allowing AI-assisted execution.

## 2.3 Why now
- AI models are now good enough to accelerate discovery/planning.
- Engineering orgs already use GitHub/Jira/Figma/Docs; the missing layer is workflow orchestration across these tools.
- Market signal: incumbent feedback tools are expensive in many cases and often disconnected from execution workflows.

## 2.4 Product Positioning
- Category: AI-native feedback operations platform.
- Tagline: “From customer voice to shipped outcomes.”
- Wedge: lightweight public portal + high-leverage internal orchestration.

## 2.5 ICP and Segmentation
- Segment A (beachhead): internal rollout in GoodHealth.ai and GoodWealth.ai.
- Segment B (early external): B2B SaaS teams with 10-500 employees, active PM+engineering processes, and existing SCM + issue tracking.
- Segment C (later): enterprise programs requiring SSO, white-label, and VPC deployment.

## 2.6 Revenue Model
- Phase 0 (beta): free usage to maximize activation and case-study velocity.
- Phase 1 (monetization start): usage + seats model with generous viewer limits.
- Phase 2 (enterprise): annual contracts, white-label add-on, VPC/on-prem premium.

### Suggested pricing transition
- Beta: free until threshold (recommended threshold below).
- Growth: fixed monthly platform fee + AI usage pack.
- Enterprise: custom annual with compliance/security add-ons.

### Recommended beta threshold
- Trigger monetization at 50 active external customer logos.
- Start paid rollout using a configurable 30-day transition window (default 30 days).

## 2.7 GTM Plan
- SEO engine (core): weekly high-intent content (“feedback prioritization”, “feature voting”, “PRD automation”, “AI product ops”).
- Founder-led outbound: target PM heads/CTOs using legacy feedback tools + modern dev stack.
- Product-led conversion: frictionless signup, template board, first insight in <15 minutes.
- Partner channel (later): product ops consultants and dev agencies.

## 2.8 Funding Story (investor-readable)
- Phase 1 proof: adoption and activation from sister-company production usage.
- Phase 2 proof: repeatable external onboarding motion + improving activation funnel.
- Phase 3 proof: enterprise pilots for white-label and VPC.

---

## 3) Product Strategy and Feature Sequence

## 3.1 v1 mandatory scope (must ship)

### A. Microsoft-style Public Feedback Portal
- Idea submission.
- Upvote and comment.
- Search existing ideas.
- Status visibility.
- Public/private board toggles.
- Basic moderation and spam controls.

### B. Internal Product/Ops Dashboard
- Idea dedupe and merge.
- Prioritization matrix (RICE).
- Revenue potential signals (account tier, ARR/MRR band, strategic flags).
- Customer context cards (who requested, who voted, top impacted segments).
- Outreach list export/email actions.

### C. White-label Foundation
- Custom logo, colors, header/footer.
- Custom domain support.
- Brand-safe transactional emails.

### D. Workflow Completion
- Auto notifications on release to upvoters/commenters.
- Beta tester cohort management and targeted invites.

## 3.2 AI workflow (v1 boundary)
- Included in v1:
  - AI-generated PRD draft from accepted feature.
  - AI-generated research summary.
  - AI-generated implementation/test plan draft.
  - Human approval checkpoints.
- Deferred to v2:
  - Auto deployment execution.
  - broad autonomous code changes without strict guardrails.

## 3.3 Tool-per-stage default (v1)
1. Feedback: native CustomerVoice board.
2. PRD docs: Google Docs (first connector), Confluence in next increment.
3. Design: Figma.
4. Planning/issues: Jira (primary) + Linear beta.
5. Source control: GitHub App integration.
6. CI/CD: status ingestion only in v1.

Rationale:
- Fastest path to enterprise-compatible workflows without connector sprawl.
- Strong API ecosystems in each selected default tool.

## 3.4 Product roadmap sequence

### Phase 0 (Weeks 1-4)
- Portal MVP + auth + organization/workspace model.

### Phase 1 (Weeks 5-10)
- Voting/comments/statuses + internal dashboard + RICE.

### Phase 2 (Weeks 11-16)
- AI discovery/PRD + plan generation + human approval engine.

### Phase 3 (Weeks 17-22)
- GitHub/Jira/Linear/Figma/Google Docs connectors + event timeline + notifications.

### Phase 4 (Weeks 23-26)
- White-label hardening + beta groups + release-loop email automation + production hardening.

---

## 4) Scalable, Secure, Compliance-Ready Architecture

## 4.1 Deployment Modes

### Local (developer/POC)
- `docker-compose` stack:
  - web (React)
  - api (Node)
  - worker (Node queue consumers)
  - postgres
  - redis
  - object storage emulator (MinIO optional)
  - local mail sink (MailHog)

### Cloud (v1 SaaS)
- Kubernetes (EKS/GKE/AKS compatible manifests via Helm).
- Managed Postgres.
- Managed Redis.
- Object storage (S3/GCS/Azure Blob abstraction).
- Managed message bus (or Kafka/NATS depending scale).
- API gateway + WAF + CDN.

### Cloud (phase 2 enterprise option)
- Single-tenant/VPC deployment profile:
  - isolated database
  - isolated encryption keys
  - dedicated compute namespace or account/project
  - private networking peering options

## 4.2 Service Topology
1. `gateway-service` (BFF/API edge).
2. `identity-service` (Supabase integration + org policy).
3. `feedback-service` (boards, ideas, votes, comments, statuses).
4. `prioritization-service` (RICE, revenue scoring, dedupe).
5. `workflow-service` (stage machine + approvals + audit).
6. `ai-orchestrator` (prompting, tool calls, policy checks).
7. `integration-service` (GitHub/Jira/Figma/Docs connectors + webhooks).
8. `notification-service` (email/in-app/webhook).
9. `analytics-service` (product and business KPIs).
10. `compliance-audit-service` (tamper-evident event log and evidence exports).

## 4.3 Data Model (core entities)
- Tenant, Workspace, User, Role, Policy.
- Board, Idea, Vote, Comment, Tag, Status.
- CustomerAccount, RevenueBand, Segment.
- FeatureCandidate, PRDVersion, DesignBrief, PlanVersion, TestPlan.
- ApprovalRequest, ApprovalDecision, GatePolicy.
- IntegrationConnection, SyncJob, ExternalArtifactLink.
- ReleaseEvent, NotificationEvent, AuditEvent.

## 4.4 Multi-tenant security boundaries
- Tenant-scoped row-level constraints.
- Tenant-specific encryption context keys.
- Strict secret segregation for connector tokens.
- Workload identity for service-to-service auth.

## 4.5 AI safety and governance
- Prompt templates versioned and policy-controlled.
- Sensitive data redaction before external model calls.
- “No execution without approval” default.
- Action-level risk tiers:
  - Tier 0: read/summarize (auto allowed).
  - Tier 1: artifact draft generation (auto allowed).
  - Tier 2: external write actions (approval required).
  - Tier 3: SCM/deploy actions (approval + policy + branch restrictions).
- Full audit trail for prompts, outputs, approvals, and actions.

## 4.6 Reliability targets
- Availability target v1: 99.5%.
- RPO: 24h (v1), 4h (phase 2 enterprise).
- RTO: 8h (v1), 2h (phase 2 enterprise).
- Async jobs idempotent with dead-letter queues and replay.

---

## 5) Compliance-Ready Design (12-month readiness roadmap)

You chose “not certified on day 1, but architecture must be certification-ready.” This is correct for speed.

## 5.1 Mandatory readiness tracks
1. SOC 2 readiness controls from day 1.
2. HIPAA readiness for healthcare-adjacent workloads.
3. GDPR readiness for global operations.
4. ISO 27001-aligned ISMS foundations.

## 5.2 Additional compliance to include (recommended)
1. CCPA/CPRA readiness for California users.
2. WCAG 2.2 AA accessibility readiness (critical for public portals).
3. India DPDP Act readiness (relevant to India operations/customers).
4. NIST SSDF secure software lifecycle baseline.
5. EU AI Act readiness controls (for AI feature governance in EU-facing use cases).
6. FedRAMP path (only if targeting US public sector later).

## 5.3 Controls to implement immediately
- SSO and MFA support.
- RBAC with least privilege.
- Immutable audit logs for all admin and AI actions.
- Encryption in transit and at rest.
- Centralized secrets manager.
- Secure SDLC: SAST, dependency scan, container scan, IaC scan, secret scan.
- Incident response runbook + breach notification workflow.
- Data retention/deletion policy engine.
- Data subject request workflows (access/delete/export).

---

## 6) Execution Plan (first 6 months)

## 6.1 Team operating model
1. Backend Engineer A:
   - feedback, prioritization, integrations backbone.
2. Backend Engineer B:
   - workflow engine, AI orchestration, approvals, compliance log.
3. Frontend Engineer:
   - portal UX + internal dashboard + white-label admin.
4. PM/Designer:
   - PRD, UX specs, copy system, usability loops, beta operations.
5. Founder/Co-founder:
   - customer discovery, GTM content, QA gate, enterprise conversations.

## 6.2 Milestones

### Month 1
- Final architecture and data model.
- Auth/org/workspace base.
- First public board and idea pipeline.

### Month 2
- Voting/comments/status.
- Internal dashboard v1.
- RICE and revenue potential scoring v1.

### Month 3
- AI discovery -> PRD draft -> approval gate.
- Workflow engine with stage transitions.

### Month 4
- Jira + Linear (beta) + GitHub + Google Docs + Figma connectors (v1).
- Activity timeline and audit trail.

### Month 5
- White-label features.
- Notification automation to voters/commenters.
- Beta tester group workflows.

### Month 6
- Production hardening.
- GoodHealth/GoodWealth embed + SSO rollout.
- External design partner onboarding.

## 6.3 KPI targets (first 6 months)
- Customers:
  - 2 sister-company production deployments.
  - 8-12 external design partner accounts.
- ARR:
  - Free beta period likely $0 booked ARR unless early paid pilots.
  - Goal: convert 3-5 paid pilots immediately after threshold policy is hit.
- Activation:
  - >=60% of new workspaces create first board in 24h.
  - >=40% of activated workspaces move at least one idea to “Accepted for Discovery” in first 14 days.

---

## 7) Cost Envelope (rough planning)

## 7.1 v1 monthly cloud cost ranges (early stage)
- Base shared SaaS infra (small production):
  - $1.5k - $4k / month.
- AI usage (depends on request volume and model mix):
  - $1k - $8k / month.
- Observability + email + edge services:
  - $500 - $2k / month.
- Total expected early range:
  - $3k - $14k / month.

## 7.2 Cost control policies
- Tenant-level AI budgets and hard caps.
- Caching + prompt compression for repetitive research jobs.
- Async batching for non-urgent AI tasks.
- Model routing policy (small model first, escalate only if needed).

---

## 8) CTO Recommendations: what to do now

1. Lock product spec to “simple portal + powerful internal workflow” and avoid premature autonomous coding/deployment in v1.
2. Build one golden path first:
   - Idea -> Vote -> Accept -> PRD draft -> Plan draft -> human approval -> Jira/GitHub linkage -> release notification.
3. Instrument everything from day 1:
   - activation funnel, stage conversion, cycle time.
4. Run weekly customer councils with GoodHealth/GoodWealth PM/CS/engineering users to compress feedback loops.
5. Keep integrations narrow in v1; depth beats breadth.
6. Start compliance evidence collection now, even before formal audits.
7. Write funding-ready metrics narrative as soon as first 3 external design partners are active.

---

## 9) Immediate Next Sprint (recommended backlog)

1. Define canonical workflow states and approval schema.
2. Finalize entity model and migration plan.
3. Build auth + org + workspace + board CRUD.
4. Ship portal vote/comment/status UI.
5. Add internal idea queue with dedupe + RICE.
6. Add audit event framework.
7. Add AI PRD generation endpoint (draft only) with approval gate.
8. Add notification templates (feature accepted, feature released, beta invite).

---

## 10) Key decisions locked

1. Free-beta threshold: 50 active external logos.
2. Paid rollout trigger: configurable transition period, default 30 days after threshold.
3. Issue tracker scope for v1: Jira primary + Linear beta.
4. White-label depth: v1 theme/logo only; v2 custom domains + branded emails.
5. Cloud decision policy: cloud-agnostic target; pick provider by startup program credits, with GCP as tie-breaker for cloud-specific requirements.
6. Data residency policy:
- Cloud deployment starts with US region enabled by default.
- EU and India regions are supported profiles but remain disabled until explicitly enabled.
- Any region outside US/EU/India is enabled only as a deliberate new-zone rollout based on country/company requirements.

---

## 11) Source notes used in this blueprint
- UserVoice pricing page states starting annual pricing and packaging principles: https://www.uservoice.com/pricing
- UserVoice product positioning statements: https://www.uservoice.com/product
- Microsoft support indicates feedback portal core flow (sign in, vote, comment, create): https://support.microsoft.com/en-us/office/send-onedrive-feedback-594f538c-cb25-4079-b1f2-716d91d41bde
- Feedback portal page references Dynamics foundation: https://feedbackportal.microsoft.com/feedback/forum/ad198462-1c1c-ec11-b6e7-0022481f8472
- GitHub Apps docs for integration model and permissioning approach: https://docs.github.com/en/apps
- Google Docs API quickstart reference: https://developers.google.com/workspace/docs/api/quickstart/nodejs
- Confluence REST API reference: https://developer.atlassian.com/cloud/confluence/rest/v2/intro/
- Supabase Auth capabilities incl. social and SSO support: https://supabase.com/docs/guides/auth
- HIPAA Security Rule summary (HHS): https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html
- GDPR legal text (EUR-Lex): https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
- AI Act legal text (EUR-Lex): https://eur-lex.europa.eu/eli/reg/2024/1689/oj
- ISO/IEC 27001:2022 reference page: https://www.iso.org/standard/27001
- CCPA official resource (California OAG): https://oag.ca.gov/privacy/ccpa
- WCAG 2.2 standard (W3C): https://www.w3.org/TR/WCAG22/
- India DPDP Act 2023 publication source: https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf
- NIST SSDF publication (SP 800-218): https://csrc.nist.gov/pubs/sp/800/218/final
