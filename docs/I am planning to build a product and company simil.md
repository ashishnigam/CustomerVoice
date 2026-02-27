<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# I am planning to build a product and company similar to user voice (https://www.uservoice.com/) a deep analysis of the company, revenue, business model and features in their product.

Microsoft using user voice for customer feedback like here "https://feedbackportal.microsoft.com/feedback/forum/ad198462-1c1c-ec11-b6e7-0022481f8472"

analyse more details and build a complete business plan document in .docx format with proper formatting and PRD for the v1 product.

Also this product will have AI integration for agent driven development.

- Once a votes feature is accepted by the user (PM, CEO, Owner) for development
- It will be moved to next stage in pipeline for PRD and marker research, user can ask specific details to be added in research and PRD, provide template etc.
- Once market research and PRD is accepted, it will move to design phase.
- Once design is accepted or skipped in case only back end changes
- it will move to development phase where AI agent will create development and release plane along with test plan.
- Once Development, testing and release plan is accepted then it will start development.
- Once development done \& testing done - it will show the results \& ask for manual review.
- Once user approve it, it will checkin the code in SCM and deploy or schedule to deploy as per user setting.
- Once deployed, it will perform production testing and inform the user.

Here is a deep UserVoice analysis plus a complete, Word-ready business plan and v1 PRD for an AI-augmented alternative. Copy the “Business Plan” and “PRD v1” sections into Word and apply Heading 1/2/3 styles as needed.

***

## UserVoice company overview

UserVoice is a SaaS company that started in 2008 to help software teams collect, prioritize, and act on customer feedback through online forums and voting.  It emerged from the founder’s need to monitor user feedback efficiently and was inspired by Joel Spolsky’s idea of using a finite number of votes to prioritize features.[^1]

The company initially gained traction with early adopters like Stack Overflow and expanded into customer engagement and helpdesk tools in the early 2010s.  Over time, it specialized around product feedback management for SaaS and software companies rather than generic helpdesk.[^2][^3][^1]

***

## UserVoice product and features

UserVoice’s core offering is a product feedback management solution that aggregates feedback from multiple sources into a central system for product teams.  It provides a customizable feedback portal, in‑app widgets, and integrations with email, CRM, and support tools so both customers and internal teams can submit ideas and requests.[^4][^3][^2]

Key feature themes include:

- Feedback portals and widgets (web + in-app) for idea submission and voting.[^1][^2]
- Voting and prioritization (incl. more advanced comparison-based SmartVote voting).[^1]
- Feedback consolidation from multiple channels into a single source of truth.[^2][^4]
- Analytics and segmentation, including filtering by customer segment, account, or revenue data (e.g., via Salesforce/CRM).[^4][^2]
- Communication tools and automatic notifications to “close the feedback loop” with customers and internal stakeholders.[^3][^4]

Historically, UserVoice also offered a HelpDesk product with gamification (“kudos”) and “Instant Answers,” but its market positioning today is strongly around product feedback and customer intelligence rather than general support ticketing.[^2][^1]

***

## UserVoice business model and pricing

UserVoice follows a classic B2B SaaS model with multi-tiered pricing targeted primarily at growing SaaS companies and enterprises.  Plans are structured by feature set and number of “unique users” or feedback participants, with higher tiers unlocking more integrations, analytics, and security options.[^5][^6][^3][^2]

Recent analyses of UserVoice’s pricing show entry points around 999 USD per month for lower tiers and about 1,499 USD per month for popular “Premium” plans, often billed quarterly or annually with minimum commitments.  Various third‑party breakdowns describe 3–4 tiers (e.g., Pro around 999 USD/mo, Internal Capture around 1,299 USD/mo, Premium around 1,499 USD/mo, plus Enterprise with custom pricing), with average annual customer spend estimated above 20,000 USD for many accounts.[^6][^5]

UserVoice has also offered a specialized “Validation” product focused on micro‑surveys for idea validation at lower individual price points (around 199 USD/month historically), although this is still positioned as premium compared to newer competitors.  Overall, the pricing and positioning skew toward mid‑market and enterprise customers rather than early‑stage startups.[^7][^5][^6]

***

## UserVoice revenue, funding, and positioning

UserVoice has raised multiple rounds of venture funding totaling somewhere between about 3.3M USD (CB Insights older data) and roughly 9.6M USD (more recent estimates), reflecting modest but not hyper‑growth funding levels.  Third‑party revenue estimate platforms differ: one source estimates annual revenue at around 4.3M USD with ~39 employees, implying a revenue per employee of about 110,000 USD, while another lists revenue closer to 15M USD with about 51 employees; both are modeled, not disclosed numbers.[^8][^9][^10]

The company competes with a crowded ecosystem including Productboard, Canny, Pendo, and various feedback/roadmap tools, many of which position themselves as more modern, less expensive, or more transparent in pricing.  Some commentary notes that large customers such as Microsoft have moved away from UserVoice toward first‑party or alternative feedback systems, which suggests both opportunity and threat for a new entrant that can differentiate on price, usability, and AI capabilities.[^9][^5][^7][^6]

***

## Competitive insight and opportunity

Competitors and review sites consistently criticize UserVoice on three axes: high pricing, opaque or sales‑driven pricing processes, and somewhat dated UX compared to newer tools.  Many alternatives emphasize simpler pricing, unlimited user counts, and modern UI/UX to attract teams that feel UserVoice is too expensive for the value delivered.[^5][^7][^6]

UserVoice, however, still benefits from brand recognition, enterprise credibility, and deep domain knowledge around product feedback workflows, which means that a new product needs clear differentiation.  AI‑driven workflows that go beyond “feedback collection” into actual PRD drafting, design collaboration, and agent‑assisted development and deployment would offer a strong point of differentiation compared with both UserVoice and lighter‑weight competitors.[^7][^6][^3][^4]

***

## Business plan (Word-ready) for “FeedbackLoop AI” (working name)

Below is a structured business plan you can paste into Word and format with Heading 1/2/3. Replace “FeedbackLoop AI” with your chosen name.

***

### 1. Executive Summary

FeedbackLoop AI is a SaaS platform that combines user feedback management (similar to UserVoice) with an AI‑agent-driven product delivery pipeline, turning accepted feature requests into PRDs, designs, development plans, code, tests, and deployments with human oversight at each gate.

The initial target segment is SaaS and B2B software companies (startups to mid‑market) that find incumbent tools like UserVoice too expensive and disconnected from their actual development workflow. The core value proposition: “Turn feedback into shipped features with one continuous, AI‑assisted workflow,” reducing cycle time, coordination overhead, and misalignment between feedback and shipped product.

***

### 2. Problem Statement and Opportunity

Product teams struggle with:

- Fragmented feedback from many channels, leading to poor prioritization and lost insights.
- Manual, slow transitions from accepted ideas → PRDs → design → development → release.
- Expensive, siloed tools (feedback, roadmapping, design management, project management, CI/CD), each requiring integration and manual glue work.

UserVoice and similar tools address feedback collection and prioritization, but they stop well before execution; dev teams still rely on manual processes and separate tools to define, design, implement, test, and ship features.  With the rise of capable AI models and agent frameworks, there is an opportunity to tightly couple feedback management with automated research, PRD creation, design support, task breakdown, code generation, testing, and deployment, all under human control.[^3][^4][^2]

***

### 3. Vision and Mission

- Vision: Become the default “feedback‑to‑feature” engine for modern SaaS teams, where high‑quality ideas are automatically transformed into shipped, validated features.
- Mission: Provide a secure, AI‑native feedback and product delivery platform that lets teams move from customer request to production deployment with minimal friction and maximum traceability.

***

### 4. Product Overview

FeedbackLoop AI combines three layers:

1) Feedback Management

- Customer and internal feedback portals with voting, tagging, and status updates.
- Aggregation from email, support tools, CRM, and in‑app widgets.
- Segmentation and analytics by account, plan, revenue, and usage.

2) AI Product Operations Layer

- AI agent that, when a feature is accepted, generates or assists with: market/competitor research, PRD, user stories, edge cases, and success metrics.
- Design‑phase support (requirements → wireframe suggestions, design checklists, and copy suggestions).
- Development‑phase support (epic/task breakdown, architecture notes, test plan, risk register).

3) AI‑Assisted Delivery Pipeline

- Integration with SCM (GitHub/GitLab/Bitbucket) and CI/CD (GitHub Actions, GitLab CI, etc.).
- Option for AI agents to propose code changes (via PRs), generate test cases, and orchestrate test runs.
- Controlled deployment with environment‑aware checks and post‑deployment validation.

***

### 5. Target Market and Customer Segments

Primary segment (Year 1–2):

- SaaS and B2B software companies (10–500 employees) with active product teams and at least several hundred paying customers.
- Roles: Product managers, founders/CEOs of early‑stage startups, heads of product, CTOs, and engineering managers.

Secondary segment (later):

- Larger enterprises and business units with complex product portfolios and existing feedback tools but weak integration with delivery pipelines.
- Agencies and software consultancies who want to standardize how they translate client feedback into delivery.

Key characteristics:

- High release cadence.
- Established source control and CI/CD practices.
- Frustration with siloed feedback and the manual overhead of project management.

***

### 6. Competitive Landscape

Competitor buckets:

- Legacy/high‑priced feedback tools (UserVoice).
- Modern feedback/roadmap tools (Canny, Featurebase, etc.).[^9][^6]
- Broader product management platforms (Productboard, Pendo, Gainsight PX).[^9]
- Generic issue trackers/project management (Jira, Linear, ClickUp).

Differentiation:

- End‑to‑end workflow from feedback to deployment, not just collection and prioritization.
- Deep, opinionated AI agents that understand product lifecycle stages.
- Flexible pricing aimed at making “enterprise‑grade feedback + AI” accessible to startups and mid‑market teams.

***

### 7. Value Proposition

For Product Leaders:

- Clear visibility from feedback to shipped features, with impact metrics.
- Faster cycle times, more customer‑aligned roadmaps, and consistent PRD quality.

For Engineers:

- Better‑defined requirements, reduced back‑and‑forth, structured test plans, and optional AI‑generated scaffolding.
- Integration into existing SCM and CI/CD, not a parallel universe.

For Customers:

- Transparent roadmap and status updates tied directly to their feedback.
- Confidence that their requests lead to concrete outcomes.

***

### 8. Business Model and Pricing Strategy

Model: B2B SaaS, multi‑tenant, subscription based.

Pricing principles:

- Transparent pricing on website (no “contact sales” for basic tiers).
- Lower entry point than UserVoice and most enterprise‑heavy tools.[^6][^5][^7]
- Value metric: combination of “internal seats” and “feedback participants” with generous limits to avoid friction.

Example pricing (you can adjust these):

- Starter: 99–149 USD/month – up to 5 internal seats, 1 feedback board, limited AI usage.
- Growth: 299–399 USD/month – up to 25 internal seats, multiple feedback boards, full AI PRD/plan generation, integrations.
- Scale: 799–999 USD/month – SSO/SAML, advanced analytics, custom AI guardrails, higher usage limits.
- Enterprise: Custom – dedicated environment options, on‑prem or VPC deployment, procurement/security review.

Add‑ons:

- Additional AI usage blocks.
- Professional services (onboarding, workflow design, custom agent scripting).

***

### 9. Go-to-Market Strategy

Channels:

- Self‑serve sign‑up with in‑product onboarding.
- Product-led growth: free trial (14–30 days) or limited free tier for basic feedback boards.
- Content marketing around “feedback to shipped features,” AI product ops, and case studies.
- Integration marketplace listings (GitHub, GitLab, Jira, Slack).

Early acquisition tactics:

- Target startups and mid‑market companies migrating from UserVoice or spreadsheet‑based feedback.
- Outbound to companies using modern dev tooling but legacy feedback or roadmapping.
- Partnerships with dev tool resellers or product‑ops consultants.

Land and expand:

- Start with one product team or business unit, then expand to more teams once value is proven.
- Upsell AI depth (code generation, test automation) and analytics.

***

### 10. Product and Technology Strategy

Architecture (high-level):

- Multi‑tenant SaaS with strict tenant isolation.
- Backend: modern web framework (e.g., Node/TypeScript, Go, or Python) with REST/GraphQL API.
- Frontend: SPA (React/Vue/Svelte) with component library aligned to B2B UX.
- Data stores: relational DB (Postgres) for core entities; search/indexing for feedback and comments.
- AI layer:
    - LLM orchestration service (agent framework).
    - Separate “AI workspace” per tenant with prompt templates, tools, and configurable policies.
    - Connectors to SCM, CI/CD, design tools, and documentation repositories.

Security and compliance priorities:

- SSO/SAML, SCIM for higher tiers.
- Audit logging for AI actions (especially code and deployment steps).
- Secrets management for SCM and deployment credentials.

***

### 11. AI Agent-Driven Workflow (End-to-End)

This is the core differentiator—aligning with your described pipeline:

1) Feedback Collection \& Voting

- Users and internal teams submit feature ideas; customers vote and comment.
- PM sees ranked list of requests, segmented by revenue, plan, region, etc.

2) Acceptance and Pipeline Transition

- When a PM/CEO/Owner accepts a feature, it moves automatically to “Discovery \& PRD” stage.
- AI agent summarizes raw feedback, clusters similar requests, and surfaces key pain points.

3) AI-Assisted Market Research \& PRD

- Agent generates:
    - Problem statement, user personas, use cases.
    - Competitive and market analysis (with user promptable depth).
    - High‑level solution outline, functional and non‑functional requirements.
    - Success metrics and rollout strategy.
- User can ask the agent to add specific sections, adjust tone, or follow a custom template.

4) Design Phase (optional for backend‑only changes)

- If UX is impacted, the feature moves to “Design.”
- Agent suggests wireframe structures, key UI states, and UX copy; integrates links to Figma or another design tool.
- If change is backend‑only, PM can skip design and proceed.

5) Development Planning

- Agent creates:
    - High‑level architecture notes.
    - Epics and tasks for issue tracker (Jira/Linear/etc.).
    - Test plan and acceptance criteria.
    - Risk/impact analysis (performance, data model, security).

6) Development and Testing

- Agent optionally generates code stubs or PRs in a dedicated branch, respecting user‑defined repositories, languages, and guidelines.
- Test code generation (unit/integration) and CI pipeline updates.
- Human developers review, adjust, and approve PRs.

7) Release and Deployment

- Once PRs and tests are approved, the agent can trigger or schedule deployments via CI/CD, depending on environment and rules.
- Post‑deployment checks (health endpoints, synthetic tests, key metrics) and notifications.

8) Post-Deployment and Feedback Loop

- Agent links deployment back to original feedback items and updates status on public/internal boards.
- Optionally prompts selected customers for post‑release feedback to close the loop.

***

### 12. Roadmap (High Level)

Phase 1 (0–6 months):

- Core feedback boards, voting, tagging, basic analytics.
- Admin console and roles/permissions.
- AI agent for PRD drafting and basic market research.
- Simple SCM integration (read‑only), Jira/Linear issue syncing.

Phase 2 (6–12 months):

- Deeper analytics and segmentation.
- Design‑phase workflows and design tool integration.
- AI‑assisted development planning, test plan generation, and basic code scaffolding.
- Slack/Teams integration and notification streams.

Phase 3 (12–24 months):

- Agent‑driven PR creation and more advanced CI/CD integrations.
- Guardrailed autonomous execution for low‑risk changes with strict approvals.
- Enterprise features (SSO/SAML, data residency, VPC options).
- Marketplace for custom agent tools and templates.

***

### 13. Key Metrics and KPIs

Product metrics:

- Time from “feature accepted” to “PRD completed.”
- Time from “PRD completed” to “deployed to production.”
- Percentage of ideas that reach production.
- Customer satisfaction with shipped features (e.g., feature NPS, CSAT).

Business metrics:

- ARR and net revenue retention.
- Seat expansion within existing customers.
- AI feature adoption rate (PRDs, plans, code generation).
- Churn and reasons (pricing, complexity, missing integrations).

***

## PRD for v1 Product: “FeedbackLoop AI – v1”

Use this as a starting PRD structure for Version 1 focusing on feedback + AI PRD/plan support and a partial development pipeline (not full autonomous deployment in v1, unless you choose to be aggressive).

***

### 1. Product Overview

- Product Name (working): FeedbackLoop AI
- Version: v1
- Owner: [Your Name / Role]
- Date: [Insert Date]

Description:
FeedbackLoop AI v1 is a SaaS platform that provides feedback boards, voting, status tracking, and AI‑assisted discovery and planning. When a feature is accepted, the platform moves it into an AI‑driven discovery stage that produces a first‑draft PRD, market/competitor summary, and development/test plan, which humans can refine and approve.

***

### 2. Goals and Non‑Goals

Goals (v1):

- Centralize customer and internal feedback in boards with voting and status.
- Provide a simple public feedback portal and internal capture interface.
- Provide AI‑generated PRD drafts and market/competitor research summaries on accepted features.
- Provide AI‑generated development task breakdown and test plan outlines.
- Integrate with at least one SCM (GitHub) for PR linkage and one issue tracker (Jira or Linear) for tasks.

Non‑Goals (v1):

- Fully autonomous code generation and production deployment without human review.
- Comprehensive design tool integration; v1 will support only simple design notes and links.
- Enterprise features such as SSO/SAML, VPC deployment, and complex approvals.

***

### 3. User Personas

1) Product Manager (PM)

- Needs: structured feedback, prioritization, quick PRDs, alignment with customers and stakeholders.
- Success: reduced time on documentation, clearer prioritization, fewer misaligned releases.

2) Founder/CEO of Startup

- Needs: fast idea validation, signal from paying customers, lightweight yet powerful tooling.
- Success: faster feedback cycles, less time switching between tools.

3) Engineering Manager / Tech Lead

- Needs: clear requirements, manageable scope, predictable release plans.
- Success: fewer requirement clarifications, better test coverage, more reliable releases.

4) Customer Success / Support Lead

- Needs: easy way to feed customer insights into product without losing context.
- Success: feeling that customer voice impacts roadmap, easier communication back to customers.

***

### 4. User Stories (Core v1)

Feedback collection and prioritization:

- As a PM, I can create feedback boards (public or internal) so I can collect and organize ideas.
- As a customer, I can submit ideas and vote on existing ones without friction.
- As a PM, I can tag, merge, and deduplicate ideas to keep boards manageable.
- As a PM, I can see which ideas come from which accounts, plans, or segments.

Acceptance and AI discovery:

- As a PM, I can change the status of an idea to “Accepted for Discovery,” triggering AI discovery.
- As a PM, I can specify what kind of research or PRD structure I want (e.g., include ROI analysis, technical constraints, etc.).
- As a PM, I receive an AI‑generated PRD draft and market/competitor overview, which I can edit and approve.

Planning and development support:

- As an Engineering Manager, I can request an AI‑generated task breakdown and test plan based on an approved PRD.
- As a PM/Eng, I can push generated tasks into our issue tracker (e.g., Jira, Linear).
- As a developer, I can see links between a task, its original feedback items, and the PRD.

SCM and CI/CD linkage (limited v1):

- As a developer, I can link a GitHub branch or PR to a feature in FeedbackLoop AI.
- As a PM, I can see the development status based on PR statuses (open, merged).
- As a PM, I can mark features as “Released to Production” once deployment is done.

***

### 5. Functional Requirements

#### 5.1 Feedback Boards and Portals

- FR‑1: Ability to create multiple boards with configurable names, descriptions, and visibility (public/private).
- FR‑2: Public board UI for customers to submit ideas, vote, comment, and see statuses.
- FR‑3: Internal “capture” UI for CS/support/sales to log feedback on behalf of customers (with account context).
- FR‑4: Voting mechanism (upvotes) with per‑user vote limits; configurable by board.
- FR‑5: Status fields (e.g., “Under Review,” “Planned,” “In Progress,” “Released,” “Declined”).
- FR‑6: Tagging, merging, and linking of similar ideas.


#### 5.2 Analytics and Segmentation (basic)

- FR‑7: Simple counts of ideas, votes, and comments per board and per status.
- FR‑8: Ability to filter ideas by tag, status, and basic account properties (e.g., plan, MRR bucket).
- FR‑9: “Top ideas” view by vote count and by “weighted impact” (votes × revenue or similar).


#### 5.3 AI Discovery and PRD Generation

- FR‑10: When an idea is marked “Accepted for Discovery,” the system triggers an AI workflow.
- FR‑11: The PM can choose from PRD templates (e.g., “Lean PRD,” “Enterprise PRD”) or define sections.
- FR‑12: AI generates:
    - Problem statement and context.
    - User personas and use cases.
    - Proposed solution overview.
    - Functional requirements list.
    - Non‑functional requirements (performance, security, etc.).
    - Success metrics and rollout/measurement plan.
- FR‑13: AI generates a short market/competitor snapshot using integrated research tools (with clear disclaimers and references, and respecting your data policies).
- FR‑14: PM can edit the AI‑generated PRD, accept it, and lock a version.


#### 5.4 AI Planning and Task/Test Plan

- FR‑15: From an approved PRD, PM/Eng can click “Generate Plan” to create:
    - Epics and tasks grouped logically (backend, frontend, devops).
    - Test plan outline with types of tests and edge cases.
- FR‑16: Users can customize the granularity of tasks (e.g., high‑level only vs. detailed).
- FR‑17: Approved tasks can be synced to issue trackers via integration.


#### 5.5 Integrations (v1 scope)

- FR‑18: GitHub integration (OAuth app or GitHub App) for:
    - Linking repos to the workspace.
    - Linking branches/PRs to features.
    - Reading PR status.
- FR‑19: One issue tracker integration (Jira or Linear) for pushing tasks and syncing status.
- FR‑20: Webhooks for basic event notifications (e.g., idea submitted, PRD approved).


#### 5.6 Notifications and Collaboration

- FR‑21: Email or in‑app notifications for key events (new idea, status change, PRD ready, plan ready).
- FR‑22: Comments on ideas, PRDs, and plans with @mentions.
- FR‑23: Activity timeline for each feature from feedback to release.

***

### 6. Non‑Functional Requirements

- NFR‑1: Multi‑tenant architecture with tenant isolation.
- NFR‑2: Response time targets (e.g., <300 ms for typical UI calls under normal load).
- NFR‑3: Basic role‑based access control (Admin, PM, Contributor, Viewer).
- NFR‑4: Data retention and export options for feedback and PRDs.
- NFR‑5: Logging and monitoring for AI actions, including prompts and outputs, to support auditability.
- NFR‑6: Clear privacy and security constraints around using customer data in AI prompts (configurable).

***

### 7. AI Design and Guardrails (v1)

- AI outputs must always be editable and never auto‑executed without explicit user confirmation.
- All AI‑generated artifacts (PRDs, plans) must be clearly labeled as drafts generated by AI.
- Integrations with external research sources must be configurable and log source URLs where possible.
- There must be an internal mechanism to block certain repositories, environments, or branches from any AI‑initiated action until advanced guardrails are implemented (for later autonomous deployment features).

***

### 8. UX and UI Requirements

- Clean, modern UI with minimal onboarding friction.
- Public feedback portal easy to embed or link from existing sites.
- PRD and plan views should support rich text editing, section collapse/expand, and side‑by‑side diff for versions.
- Clear visual pipeline: Feedback → Discovery → Design (optional) → Plan → Development → Released.

***

### 9. Metrics for v1 Success

- At least X active workspaces and Y monthly active users within N months of launch (set your own targets).
- Average time from “Accepted for Discovery” to “PRD Approved” reduced by at least 50% for pilot teams.
- >70% of pilot teams report that PRDs and plans created with the tool require less back‑and‑forth.
- At least 50% of accepted ideas in pilot accounts go through the AI discovery workflow.

***

### 10. Risks and Assumptions

- Risk: Over‑promising full autonomous development and deployment; mitigation: position v1 as “AI‑assisted” with strong human control.
- Risk: Integration complexity with diverse tech stacks; mitigation: focus on GitHub + one issue tracker first.
- Risk: Data/privacy concerns around feeding confidential data to AI; mitigation: clear documentation, tenant‑level controls, and minimal data in prompts.
- Assumption: Target customers already use modern SCM and issue trackers and are comfortable with AI in the workflow.

***

If you like, a next step can be:

- Tailor the business plan to a specific region (e.g., India, EU, US focus) and pricing in INR.
- Deepen the AI technical architecture (agent design, tools, safety) for your preferred stack.
<span style="display:none">[^11][^12][^13][^14]</span>

<div align="center">⁂</div>

[^1]: https://en.wikipedia.org/wiki/UserVoice

[^2]: https://www.softwareadvice.com/product-roadmap/uservoice-profile/

[^3]: https://www.linkedin.com/products/uservoice/

[^4]: https://www.uservoice.com/product/enterprise-feedback

[^5]: https://userjot.com/blog/uservoice-pricing

[^6]: https://www.featurebase.app/blog/uservoice-pricing

[^7]: https://www.feedbear.com/blog/uservoice-pricing

[^8]: https://www.cbinsights.com/company/uservoice/financials

[^9]: https://growjo.com/company/UserVoice

[^10]: https://www.zoominfo.com/c/uservoice-inc/345658731

[^11]: https://app.dealroom.co/companies/uservoice

[^12]: https://firstsales.io/brand-review/uservoice/

[^13]: https://www.uservoice.com/pricing

[^14]: https://techcrunch.com/2009/05/18/uservoice-raises-funding-white-labels-user-feedback-facilitator/

