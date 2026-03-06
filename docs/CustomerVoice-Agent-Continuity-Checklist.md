# CustomerVoice Agent Continuity Checklist

## Context
This document serves as an entry point for any AI agent tasked with continuing development on the CustomerVoice monorepo. It details the current state of the codebase, where Phase 3 ended, and provides an actionable checklist for the next iteration.

## System Overview
- **Monorepo:** Turborepo
- **Frontend (`apps/web`):** React, Vite. The entire Customer Portal UI is housed in `CustomerPortal.tsx` with all styles in `styles.css`.
- **Backend (`apps/api`):** Fastify, Drizzle ORM, PostgreSQL. Main logic is routed through `routes/public.ts`, mapping to database actions in `db/repositories.ts`. 

## Current Implementation State
- ✅ **Phases 1-4 Completed:** Authentication, Idea submission, Commenting, Roadmap View, Changelog View, Custom Branding, Password Reset, Social Auth (Google/GitHub), Background Worker Email Dispatch, Admin Dashboard (Rich Text Editorial), and File Attachments.
- ✅ **Database:** Schemas support all features, including Webhook definitions.
- 🚧 **Gap (Phase 5):** Admins cannot merge duplicate ideas. High-end integrations (Slack, Linear, Jira) via Webhooks are not yet connected to the worker. Internal-only staff comments are not supported.

## Next Steps: Phase 5 Implementation Checklist (Moderation & Integrations)

### 1. Idea Merging & Deduplication
- [ ] Implement `mergeIdeas` repository function to re-parent comments, votes, and followers from a duplicate idea to a primary idea.
- [ ] Add an Admin UI workflow to initiate a merge, selecting the source and target ideas.
- [ ] Add UX on the primary idea showing "Merged with <duplicate URL>".

### 2. Internal Staff Comments
- [ ] Add an `is_internal` boolean column to the `idea_comments` schema.
- [ ] Modify `public.ts` comments fetch mechanism to omit internal comments unless the requester is an authenticated staff member.
- [ ] Add a visual toggle in the Admin Dashboard and Customer Portal for Staff to choose "Post as Internal Note".

### 3. Webhooks & External Routing
- [ ] Implement the UI in `AdminDashboard.tsx` to CRUD Webhooks (Slack/Discord format).
- [ ] When an idea is created, updated, or commented on, enqueue a webhook payload to the `notification_jobs` table (similar to how emails are dispatched).
- [ ] Update `apps/worker` to process webhook notification jobs.

### 4. Real-time UX (Optional / High-Impact)
- [ ] Introduce Server-Sent Events (SSE) or WebSockets in the fastify backend.
- [ ] Broadcast vote increments and new comments to connected portal clients so vote counters tick up live without refreshing.

### 5. Automated E2E Testing
- [ ] Setup Playwright in the monorepo root.
- [ ] Write critical path E2E tests for the public portal: Registration, Idea Submission, Upvoting, and Commenting.

## Local Development Commands
To work on the project, you typically need to run the entire monorepo:
```bash
cd /Users/ashishnigam/Startups/CustomerVoice
pnpm install
pnpm dev
```
