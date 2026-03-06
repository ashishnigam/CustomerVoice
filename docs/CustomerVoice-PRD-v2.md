# CustomerVoice Product Requirements Document (v2)

## 1. Product Vision
CustomerVoice is a modern, transparent, and highly responsive feedback portal that bridges the gap between companies and their users. It allows organizations to collect feature requests, prioritize ideas based on customer upvotes, share visual roadmaps, and publish regular changelogs, all inside a beautifully branded interface.

## 2. Completed Features (Current State)

### Phase 1: Core Portal
- **Public View:** Clean, accessible portal displaying a list of submitted ideas.
- **Authentication:** Email/Password registration and login with session management.
- **Engagement:** Users can submit new ideas, vote on existing ones, and leave comments.
- **Access Control:** Boards can be public, private, or link-only, governed by robust database settings.

### Phase 2: Enhanced UX & Retention
- **User Profiles:** Users can update their display names and avatars.
- **Subscriptions:** Users can "Follow" ideas to receive updates.
- **Official Responses:** Staff comments have a distinct UI (badges/highlights) to show official alignment.
- **Pagination & Performance:** Infinite scroll implementation for high-volume idea boards.

### Phase 3: Platform Excellence
- **Public Roadmap:** Kanban-style visualization of ideas based on their status (Planned, Building, Completed).
- **Changelog:** A dedicated "What's New" timeline view for published updates and release notes.
- **Threaded Comments:** Support for nested replies and comment upvoting to foster richer discussions.
- **Markdown Support:** React-Markdown and remark-gfm allow formatting in idea descriptions and comments.
- **Custom Branding:** Board settings reflect custom accent colors, logos, and header backgrounds dynamically.

### Phase 4: Admin, Auth & Notifications
- **Admin Dashboard:** Internal UI (`/admin`) to configure board settings, update statuses, and draft Changelogs with a rich text editor.
- **Social Auth:** Fully implemented Google and GitHub OAuth callbacks issuing JWTs.
- **Background Worker:** A polling worker in `apps/worker` dispatches emails (e.g., Password Reset, Notifications) using Nodemailer/SMTP.
- **File Attachments:** Natively upload screenshots and documentation to ideas and comments via multipart form data to AWS S3 / Minio.

## 3. Architecture Overview

### Monorepo Structure
The project uses Turborepo for workspace management.
- `apps/api` (Backend): Node.js, Fastify, Drizzle ORM, connected to PostgreSQL. Contains all business logic in `routes/` and data access in `db/repositories.ts`.
- `apps/web` (Frontend): React 18, Vite. All UI is built using vanilla CSS (`styles.css`) focusing on a glassmorphic aesthetic.
- `apps/mobile` (Mobile): Placeholder for future mobile applications.
- `apps/worker` (Background jobs): Placeholder for email/notification queues.
- `packages/types`: Shared TypeScript interfaces between API and Web.
- `packages/ui` & `packages/config`: Shared configurations and components.

### API & Versioning
- All public-facing routes are prefixed with `/api/v1/public/`.
- Routes are validated using JSON Schema (TypeBox/Zod integration).
- Authentication uses bearer JWTs or secure session tokens.

## 4. Future Backlog (Phase 5: Moderation & Integrations)
- **Idea Merging (Priority):** Admin ability to merge duplicate ideas to consolidate votes and followers.
- **Internal Comments (Priority):** Staff-only notes on public ideas that customers cannot see.
- **Webhooks & External Integrations:** Send updates to Slack, Discord, Jira, or Linear. Support bidirectional status syncs.
- **Embeddable Widget:** A lightweight React script that can be embedded securely on any customer website to open a feedback modal without leaving the host application.
- **Real-time UX:** Implement Server-Sent Events (SSE) or WebSockets so the board vote counters and comments feel alive and auto-refresh.
- **User Impact / MRR Tracking:** Connect users to Stripe or Salesforce IDs to weigh votes by Total Revenue at Risk.
- **Enterprise SSO:** Support SAML or OIDC for corporate identity providers.
- **Automated E2E Testing Suite:** Prevent UI regressions using Playwright or Cypress workflows against the public portal.
