# CustomerVoice Agent Continuity Checklist

## Context
This document serves as an entry point for any AI agent tasked with continuing development on the CustomerVoice monorepo. It details the current state of the codebase, where Phase 3 ended, and provides an actionable checklist for the next iteration.

## System Overview
- **Monorepo:** Turborepo
- **Frontend (`apps/web`):** React, Vite. The entire Customer Portal UI is housed in `CustomerPortal.tsx` with all styles in `styles.css`.
- **Backend (`apps/api`):** Fastify, Drizzle ORM, PostgreSQL. Main logic is routed through `routes/public.ts`, mapping to database actions in `db/repositories.ts`. 

## Current Implementation State
- ✅ **Phases 1-3 Completed:** Authentication, Idea submission, Commenting, Threaded Comments, Roadmap View, Changelog View, Custom Branding, Markdown Rendering, and Password Reset flow.
- ✅ **Database:** Up to migration `007_platform_excellence` applied. Schema supports all current features plus placeholders for Webhooks.
- 🚧 **Gap:** The frontend Customer Portal is highly refined, but the internal Admin Dashboard for managing these settings, modifying idea statuses, and creating changelogs is missing.
- 🚧 **Gap:** No actual email dispatch mechanism exists yet (password reset token currently operates silently on the backend).

## Next Steps: Phase 4 Implementation Checklist

### 1. Robust Email & Notifications
- [ ] Setup a background worker (`apps/worker`) using BullMQ/Redis or a simple cron job.
- [ ] Integrate an email provider (Resend, SendGrid, Amazon SES).
- [ ] Connect the `forgot-password` route to actually dispatch an email containing the reset link (`/portal/boards/:boardSlug?reset_token=...`).
- [ ] Dispatch email notifications to users subscribed to an idea when its status changes.

### 2. Admin & Staff Dashboard
- [ ] Create `apps/web/src/AdminDashboard.tsx`.
- [ ] Build UI to manage Board Settings (custom CSS, logos, access control).
- [ ] Build UI for staff to change Idea Statuses (moves them across the public roadmap).
- [ ] Build UI to draft and publish Changelog Entries.
- [ ] Ensure Admin routes in `apps/api` are securely protected using staff/admin role checks.

### 3. Authentication Enhancements
- [ ] Implement actual OAuth logic in Fastify for Google and GitHub.
- [ ] Remove the UI stubs in `CustomerPortal.tsx` and connect them to real OAuth scopes.

### 4. Technical Debt & Refactoring
- [ ] `CustomerPortal.tsx` is over 1,600 lines. Refactor it by extracting smaller components (e.g., `IdeaDetailPanel`, `RoadmapBoard`, `ChangelogTimeline`, `AuthModal`).
- [ ] `styles.css` is over 4,700 lines. Consider splitting it into logical CSS modules or adopting a styling framework if appropriate.
- [ ] Add unit logic tests and API integration tests.

## Local Development Commands
To work on the project, you typically need to run the entire monorepo:
```bash
cd /Users/ashishnigam/Startups/CustomerVoice
pnpm install
pnpm dev
```
