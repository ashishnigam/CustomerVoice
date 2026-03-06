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
- **Auth Gap Fixes:** Fully functional password reset flow and UI stubs for Google/GitHub OAuth.

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

## 4. Future Backlog (Phase 4 & Beyond)
- **SSO Integration:** Full SAML/OIDC and OAuth (Google, GitHub, Slack) implementations.
- **Admin Dashboard:** A robust internal UI for staff to manage user access, define board settings, moderate comments, and update idea statuses.
- **Notification Worker:** Implement BullMQ/Redis in `apps/worker` to process email notifications for password resets and subscribed idea updates via Resend/SendGrid.
- **File Attachments:** Allow users to upload screenshots and PDFs to their idea submissions.
- **Webhooks:** Trigger external events when new ideas are posted or statuses change (schema exists, delivery mechanism pending).
- **Rich Text Editor:** Add a WYSIWYG editor for admins creating changelogs.
- **Testing Suite:** Add extensive end-to-end tests (Playwright/Cypress) and integration tests.
