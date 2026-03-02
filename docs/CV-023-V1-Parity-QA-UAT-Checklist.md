# CV-023 V1 Parity QA/UAT Checklist

## Scope
Validate V1 completion block covering CV-014 to CV-022:
1. Portal search/sort/filter/category UX.
2. Moderation workflows (spam, lock comments, merge duplicate ideas, bulk actions).
3. Notification workflow when idea status becomes `completed`.
4. Internal analytics dashboard with RICE, revenue potential, CSV export, and outreach enqueue.

## Preconditions
1. Branch contains CV-014 to CV-022 implementation.
2. Local stack running with postgres, redis, mailhog, api, worker, web.
3. API in `AUTH_MODE=mock` for manual QA or Supabase test tenant configured.
4. MailHog UI available at `http://localhost:8025`.
5. Seed workspace available:
- workspace `22222222-2222-2222-2222-222222222222`
- admin `33333333-3333-3333-3333-333333333333`
- contributor `44444444-4444-4444-4444-444444444444`

## Test Matrix
| Area | Scenario | Expected Result |
|---|---|---|
| Portal | Search ideas by keyword | Matching ideas returned only |
| Portal | Filter ideas by status | Only selected status visible |
| Portal | Filter ideas by category | Only tagged ideas visible |
| Portal | Sort by most commented/top voted/newest | Ordering matches selected mode |
| Categories | Create category | Category visible in portal filter and idea create form |
| Moderation | Mark spam | Idea hidden from default portal list and shown as spam in moderation queue |
| Moderation | Lock comments | New comments return `409 idea_comments_locked` |
| Moderation | Merge duplicate ideas | Source marked `merged`, target retains votes/comments lineage |
| Notifications | Move idea to `completed` | Notification job and recipients created; worker sends email |
| Analytics | Save scoring inputs | RICE and revenue values visible in dashboard |
| Analytics | Export CSV | CSV download contains idea analytics rows |
| Analytics | Outreach enqueue | Notification job created with target audience count |

## Manual API Checklist
1. Create category:
- `POST /api/v1/workspaces/{workspaceId}/categories`
2. Create idea with category:
- `POST /api/v1/workspaces/{workspaceId}/boards/{boardId}/ideas`
3. Filter idea list:
- `GET /api/v1/workspaces/{workspaceId}/boards/{boardId}/ideas?status=new&categoryIds={id}&sort=top_voted`
4. Lock comments:
- `PATCH /api/v1/workspaces/{workspaceId}/moderation/ideas/{ideaId}/comments-lock`
5. Merge duplicate ideas:
- `POST /api/v1/workspaces/{workspaceId}/moderation/ideas/merge`
6. Complete idea and inspect notification job:
- `PATCH /api/v1/workspaces/{workspaceId}/boards/{boardId}/ideas/{ideaId}/status`
7. Save analytics inputs:
- `PUT /api/v1/workspaces/{workspaceId}/analytics/ideas/{ideaId}/input`
8. Export analytics CSV:
- `GET /api/v1/workspaces/{workspaceId}/analytics/ideas?format=csv`
9. Enqueue outreach:
- `POST /api/v1/workspaces/{workspaceId}/analytics/ideas/{ideaId}/outreach`

## Web UAT Flow
1. Sign in to `/Users/ashishnigam/Startups/CustomerVoice/apps/web/src/App.tsx` shell in mock mode.
2. Create board and category.
3. Create idea with category tags.
4. Verify search/status/category/sort controls update visible ideas.
5. Upvote and comment as contributor.
6. Open `Moderation` tab as admin or PM.
7. Lock comments and verify portal comment posting is blocked.
8. Create duplicate idea and merge it into the target.
9. Open `Analytics` tab and save scoring inputs.
10. Export CSV and confirm file contents.
11. Trigger outreach and verify MailHog receives message after worker poll.
12. Move idea to `completed` and verify MailHog receives shipped notification.

## Regression Commands
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @customervoice/api test:integration:db
```

## Release Sign-off Criteria
1. All matrix scenarios pass in manual QA and automated tests.
2. No open P0/P1 defects across portal, moderation, notifications, or analytics scope.
3. Worker dispatch verified against MailHog locally.
4. Mock auth and at least one Supabase-authenticated smoke path validated.

## Demo Script
1. Show portal create/filter/sort/category flow.
2. Show moderation queue with lock + merge.
3. Show analytics ranking + outreach enqueue.
4. Change idea to `completed`.
5. Show MailHog delivery for outreach and completion notifications.

## Execution Log
| Date | Tester | Environment | Result | Notes |
|---|---|---|---|---|
| YYYY-MM-DD |  | local/staging | pass/fail |  |
