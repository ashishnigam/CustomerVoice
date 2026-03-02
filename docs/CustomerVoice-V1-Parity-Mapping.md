# CustomerVoice V1 Parity Mapping

## Purpose
This file defines the actual V1 parity decision for CustomerVoice against the Microsoft Feedback Portal-style scope discussed for launch.

## Reference basis
Primary UX reference discussed for V1:
- Microsoft Feedback Portal board/forum pattern similar to `https://feedbackportal.microsoft.com/feedback/forum/ad198462-1c1c-ec11-b6e7-0022481f8472`

The correct standard for this project is not full Microsoft platform duplication. The standard is scoped parity for the agreed V1 feature contract.

## V1 scoped parity matrix
| Capability | Microsoft-style expectation | CustomerVoice V1 status | Notes |
|---|---|---|---|
| Public board view | Board/forum page listing requests | Implemented | Boards exist and ideas are listed publicly in the web app. |
| Idea submission | Users can submit requests | Implemented | Idea create flow exists. |
| Voting | Users can upvote ideas | Implemented | Vote and unvote supported. |
| Comments | Users can comment on ideas | Implemented | Comment list and create supported. |
| Visible status | Users can see lifecycle state | Implemented | `new`, `under_review`, `accepted`, `planned`, `in_progress`, `completed`, `declined`. |
| Search | Users can search ideas | Implemented | Server-backed keyword search exists. |
| Sort and filters | Users can filter by status/category and sort results | Implemented | Search, status filter, category filter, and sort are live. |
| Moderation | Internal team can handle spam/duplicates/comment control | Implemented | Spam, restore, lock comments, merge duplicates, and bulk actions are live. |
| Internal prioritization | Product team can score and rank demand | Implemented | RICE, revenue potential, CSV export, and outreach enqueue are live. |
| Close-the-loop notification | Users get informed when shipped | Implemented | Completion notifications go to upvoters/commenters through the worker. |
| White-label foundation | Theme/logo basis for enterprise posture | Foundation only | Full custom domain and branded email are intentionally V2. |

## Explicit non-blockers for V1 manual UAT
These are not required to start V1 manual UAT because they were not part of the locked V1 contract:
1. Beta tester cohort management.
2. Full white-label custom domain and branded email.
3. GoodHealth.ai and GoodWealth.ai SSO/embed.
4. AI delivery pipeline stages.
5. Full Microsoft-specific ecosystem behavior outside the agreed scope.
6. Attachments, screenshots, or richer Microsoft Feedback Hub-specific flows.
7. Personalized "my feedback" views and other non-locked convenience surfaces.

## Readiness decision
CustomerVoice is ready for **manual V1 UAT for the agreed scope**.

This is a scoped parity result, not a claim of one-to-one parity with every Microsoft feedback property.

## Manual UAT gate
Manual UAT should be executed using:
- `/Users/ashishnigam/Startups/CustomerVoice/docs/CV-023-V1-Parity-QA-UAT-Checklist.md`

## Required proof during UAT
1. Board creation and portal browsing.
2. Idea submission, voting, and comments.
3. Search, sort, and filter behavior.
4. Moderation queue actions including spam, lock, and merge.
5. Internal analytics scoring and CSV export.
6. Completion notification email delivery via MailHog.
