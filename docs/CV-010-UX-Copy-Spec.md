# CV-010 UX and Copy Spec (Portal + Dashboard Foundation)

## Ticket
- ID: CV-010
- Scope: v1 IA, route map, low-fidelity wireframes, and handoff notes.
- Reference: Microsoft-style feedback portal parity for ideas/upvotes/comments/status.

## Information architecture (v1)
1. Authentication shell
2. Workspace-scoped portal shell
3. Boards index + board create
4. Ideas list (per board)
5. Idea detail panel (votes/comments/status)

## Route map (v1)
- Web routes
  - `/login`: sign in, session bootstrap, workspace profile selection.
  - `/portal`: workspace shell with board list and nested idea context.
  - `/portal?boardId={id}`: selected board ideas list.
  - `/portal?boardId={id}&ideaId={id}`: selected idea detail + comments.
- API routes
  - `GET /api/v1/workspaces/:workspaceId/boards`
  - `POST /api/v1/workspaces/:workspaceId/boards`
  - `GET /api/v1/workspaces/:workspaceId/boards/:boardId/ideas`
  - `POST /api/v1/workspaces/:workspaceId/boards/:boardId/ideas`
  - `GET /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId`
  - `PATCH /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/status`
  - `POST /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/votes`
  - `DELETE /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/votes`
  - `GET /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/comments`
  - `POST /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/comments`

## Copy guidelines
- Tone
  - Direct and operational.
  - No marketing-heavy copy inside product shell.
- Labels
  - Use `Board`, `Idea`, `Votes`, `Comments`, `Status` consistently.
  - Status labels: `New`, `Under Review`, `Accepted`, `Planned`, `In Progress`, `Completed`, `Declined`.
- Errors
  - Preserve technical reason in detail when available.
  - Prefix with user-action context, e.g. `Create idea failed (...)`.
- Empty states
  - Boards: `No boards yet.`
  - Ideas: `No ideas submitted yet.`
  - Comments: `No comments yet.`

## Low-fidelity wireframe notes
- Desktop structure
  - Left: boards list + create board form.
  - Middle: selected board idea list + create idea form.
  - Right: selected idea detail, vote CTA, status selector, comment thread.
- Mobile structure
  - Stacked cards: boards -> ideas -> detail/comments.
  - Keep the same workflow order with reduced parallelism.
- Login structure
  - API base, workspace, actor identity, role, optional JWT.

## UX state model
- Auth state
  - Unauthorized API response (`401/403`) transitions to `/login` with `Session ended` notice.
- Workspace switch
  - Switching workspace resets board/idea/comment state and refetches data in new context.
- Permissions
  - Status update control visible only to `tenant_admin`, `workspace_admin`, `product_manager`, `engineering_manager`.

## Engineering handoff
- Web implementation files
  - `apps/web/src/App.tsx`
  - `apps/web/src/styles.css`
- Backend contract
  - `apps/api/src/routes/ideas.ts`
  - `apps/api/src/routes/boards.ts`
  - `apps/api/openapi/openapi.yaml`
- QA focus for CV-010 acceptance
  - Verify login -> portal flow.
  - Verify workspace switch context reset.
  - Verify status control role gating.
