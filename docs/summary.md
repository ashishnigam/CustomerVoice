# CustomerVoice Summary & Context

## Project Overview
CustomerVoice is a modern, transparent, and highly responsive feedback portal bridging the gap between organizations and their users. It empowers companies to easily collect feature requests, prioritize ideas based on customer upvotes (and business value/MRR), share public visual roadmaps, and publish regular changelogs.

The platform distinguishes itself through a beautiful "glassmorphic" UI, deep integration capabilities (webhooks, widgets), and enterprise-grade tools (SSO, moderation) that scale from startups to large B2B SaaS teams.

## Technology Stack
- **Monorepo Strategy**: Turborepo (managing `apps/web`, `apps/api`, `apps/worker` and shared packages).
- **Backend (`apps/api`)**: Node.js, Fastify framework, Drizzle ORM connected to PostgreSQL. JSON Schema (TypeBox) for rapid, validated routing.
- **Frontend (`apps/web`)**: React 18, Vite, React Query. UI built with pure Vanilla CSS emphasizing rich aesthetics (smooth gradients, micro-animations, glass UI).
- **Background Jobs (`apps/worker`)**: Independent service handling email dispatch (Nodemailer/SMTP), notifications, and webhook forwarding.

## Current Project State
CustomerVoice has progressed through **5 core phases**, establishing a fully functional public feedback portal, robust engagement loops (follows, threaded comments, changelogs), and essential internal moderation tools (admin dashboard, deduplication, webhooks).

We have currently completed **Phase 6: Advanced Workflows & Enterprise Parity**, which introduced Real-Time UX (Server-Sent Events), an Embeddable Widget, MRR (Monthly Recurring Revenue) tracking to sort ideas by financial impact, and Enterprise SSO.

We are now moving into **Phase 7: Polish, Production Readiness & Billing** to finalize the application for public launch.

### Key References
- **`docs/CustomerVoice-Phases.md`**: A detailed outline of all historical and current development phases.
- **`docs/implementation_plan.md`**: A technical roadmap and gap analysis for the active development phase (currently Phase 7).
- **`docs/CustomerVoice-Agent-Continuity-Checklist.md`**: Immediate context when continuing active work.
