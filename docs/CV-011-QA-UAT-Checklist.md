# CV-011 QA/UAT Checklist (Sprint 1)

## Scope
Validate Sprint-1 foundation with focus on:
1. Auth and workspace-scope enforcement.
2. Board list/create workflow.
3. Membership read/invite authorization.
4. Audit event generation for write operations.

## Preconditions
1. Branch: `codex/sprint1-scaffold`.
2. API and DB running (`docker compose` or equivalent).
3. API configured in local `mock` auth mode for manual QA:
- `AUTH_MODE=mock`
- `ENABLE_BOOTSTRAP_SEED=true`
4. Seed values available:
- workspace `22222222-2222-2222-2222-222222222222`
- user `33333333-3333-3333-3333-333333333333`

## Test Matrix
| Area | Scenario | Expected Result |
|---|---|---|
| Auth | Missing auth headers | `401 missing_mock_actor_headers` |
| Scope | Header workspace != route workspace | `403 workspace_scope_violation` |
| Boards | Viewer role lists boards | `200` with items |
| Boards | Contributor tries create | `403 forbidden` |
| Boards | Workspace admin creates board | `201` board created + audit event |
| Membership | Viewer lists members | `200` with items |
| Membership | Viewer invites member | `403 forbidden` |
| Membership | Workspace admin invites member | `201` member invited + audit event |

## Manual API Checklist
1. Board list:
- `GET /api/v1/workspaces/{workspaceId}/boards`
- Verify response code and payload shape.
2. Board create:
- `POST /api/v1/workspaces/{workspaceId}/boards`
- Verify `name`, `visibility`, `slug`, `id` returned.
3. Membership list:
- `GET /api/v1/workspaces/{workspaceId}/members`
- Verify active memberships.
4. Membership invite:
- `POST /api/v1/workspaces/{workspaceId}/members/invite`
- Verify member appears in list.
5. Audit list:
- `GET /api/v1/workspaces/{workspaceId}/audit-events?limit=50`
- Verify `board.create` and `membership.invite` events.

## Web UAT Checklist
1. Open web app and set API base/workspace/user/role.
2. Load boards with viewer role.
3. Attempt create board with contributor role (must fail).
4. Create board with workspace admin role (must succeed).
5. Verify new board appears in list.

## Regression Checklist
1. `pnpm lint` passes.
2. `pnpm typecheck` passes.
3. `pnpm test` passes.
4. `pnpm build` passes.

## Sign-off Criteria
1. All matrix scenarios pass.
2. No open P1 defects in auth/scope/board/membership flow.
3. Integration test suite for boards + membership auth green in CI.

## Execution Log (fill during run)
| Date | Tester | Environment | Result | Notes |
|---|---|---|---|---|
| YYYY-MM-DD |  | local/staging | pass/fail |  |
