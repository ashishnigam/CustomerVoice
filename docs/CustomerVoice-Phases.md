# CustomerVoice Phases

A clear breakdown of the iterative development phases of the CustomerVoice platform.

## Phase 1: Core Portal
- **Public View:** Clean portal displaying requested ideas.
- **Authentication:** Email/Password registration and login.
- **Engagement:** Idea submission, voting, and commenting.
- **Access Control:** Public, private, or link-only boards.

## Phase 2: Enhanced UX & Retention
- **User Profiles:** Display names and avatars.
- **Subscriptions:** "Follow" ideas to receive updates.
- **Official Responses:** Staff comments highlighted with badges.
- **Pagination:** Infinite scroll for high-volume boards.

## Phase 3: Platform Excellence
- **Public Roadmap:** Kanban-style visualization of statuses (Planned, Building, Completed).
- **Changelog:** "What's New" timeline for published updates.
- **Threaded Comments:** Nested replies and comment upvoting.
- **Markdown Support:** Rich text formatting in descriptions and comments.
- **Custom Branding:** Board-specific accent colors, logos, and headers.

## Phase 4: Admin, Auth & Notifications
- **Admin Dashboard:** Internal UI for board CRUD, statuses, and changelog drafting.
- **Social Auth:** Google and GitHub OAuth.
- **Background Worker:** Email dispatch (Password Reset, Notifications).
- **File Attachments:** Natively upload screenshots/docs to S3.

## Phase 5: Moderation & Integrations
- **Idea Merging:** Admin ability to deduplicate ideas, consolidating votes/followers.
- **Internal Comments:** Staff-only notes on public ideas.
- **Webhooks:** Send real-time updates to Slack, Discord, Jira, etc.
- **Testing:** Base testing frameworks.

## Phase 6: Real-Time & Enterprise Scale
- **Real-Time UX (SSE):** Make the portal "alive." Live ticking votes and comment streaming via Server-Sent Events.
- **Embeddable Feedback Widget:** A modular JS bundle allowing B2B clients to inject CustomerVoice directly into their own SaaS apps asynchronously.
- **User Impact / MRR Tracking:** Connect users to Stripe/Salesforce to sort ideas dynamically by "Total Revenue at Risk."
- **Enterprise SSO & Test Automation:** Harden the Identity Layer (SAML/OIDC) and establish rigorous Playwright E2E browser tests to ensure stability.

## Phase 7: Tenant Foundation & Enterprise Identity
- **True Multi-Tenant Core:** Make tenant resolution explicit across domain, auth, session, board, and workspace boundaries.
- **Enterprise Domain Ownership:** Verified domain claim flow, tenant-scoped SSO ownership, and domain-aware access rules.
- **Personal Tenants:** Public-email users get an individual tenant by default instead of being grouped by provider domain.
- **Tenant-Aware Routing:** Public boards, streams, and portal actions resolve tenant before board access.
- **Migration & Hardening:** Backfill tenant ownership across existing records, cut over safely, and lock in regression coverage.

## Phase 8: Commercialization, Search & Expansion
- **Production Infrastructure:** Docker compose deployments, CI/CD pipelines, health checks, and broader release automation.
- **Billing & Subscriptions:** Stripe plans, entitlements, and commercial lifecycle handling.
- **Advanced Analytics:** Feature success metrics, usage reporting, and deeper operator insight surfaces.
- **Search & SEO:** Full-text search across ideas plus portal SEO improvements.
- **Deferred Product Expansion:** White-label depth, beta-cohort tooling, embed-specific productization, and AI workflow orchestration.
