# CustomerVoice Phase 7 Planning (Consolidated)

Last updated: 2026-03-07

## 1. Purpose
This document consolidates the current Phase 7 planning discussion into a single decision surface.

It is designed to answer:
1. What must happen before broader roadmap expansion.
2. Which major workstreams are candidates for Phase 7.
3. Which workstreams may need to move into Phase 8 instead.

## 2. Strategic Direction Locked
These planning assumptions are now locked unless explicitly changed:
1. Focus on the current feedback product only.
2. External SaaS commercialization drives prioritization before sister-company-specific embed work.
3. AI workflow platform work is deferred until after stability and commercialization of the feedback product.
4. Immediate correctness issues in auth and enterprise access UX are pre-roadmap gate work, not optional polish.

## 3. Current Baseline (In Code)
CustomerVoice already includes:
- Public portal flows for ideas, votes, comments, roadmap, changelog, markdown, attachments, favorites, follows, and profile basics.
- Moderation workflows including spam, restore, duplicate merge, comment locking, and internal-note behavior.
- Widget mode plus embeddable widget script.
- Internal analytics with RICE, revenue potential, audience discovery, outreach, and MRR-backed impact sorting.
- Worker-based notification delivery and webhook dispatch.
- SSO login/callback baseline plus SSO connection management APIs.
- Playwright baseline coverage and DB-backed integration coverage.

## 4. Competitor-Gap Summary

### 4.1 UserVoice
Signals:
- Enterprise pricing and strong identity packaging.
- Mature SSO story and roadmap audience controls.

Implication:
- CustomerVoice needs stronger enterprise access administration and clearer commercial packaging.

### 4.2 Canny
Signals:
- Strong board privacy, widget, roadmap/changelog defaults, and practical segmentation/value features.

Implication:
- CustomerVoice should strengthen access control UX, operator segmentation, and prioritization depth.

### 4.3 Productboard
Signals:
- Strong portal plus enterprise security plus Jira depth.

Implication:
- CustomerVoice needs better commercialization and enterprise admin depth before pushing higher upmarket.

### 4.4 Frill
Signals:
- Lightweight widget and embeddable roadmap/changelog positioning with transparent packaging.

Implication:
- CustomerVoice should improve commercial readiness without losing low-friction portal strengths.

## 5. Mandatory Pre-Phase Gate
Before selecting the larger Phase 7 feature block, the following must be treated as correctness work:
1. Auth callback flows must work end-to-end for public auth and SSO.
2. Restricted-board access controls must be enforced consistently across public routes.
3. Enterprise access UX must support actual configuration and usable login entry points.
4. Validation coverage must exist for the restricted-board path.

## 6. Candidate Phase 7 Workstreams

### Workstream A: Stability And Production Readiness
Goal:
- Reduce operational risk and make the current product safer to commercialize.

Candidate scope:
- CI hardening.
- More deterministic DB-backed integration coverage.
- Expanded Playwright flows.
- Health/smoke automation.
- Production runbook tightening.
- Reliability instrumentation and release confidence improvements.

Why it matters:
- This is the foundation for any external SaaS monetization push.

### Workstream B: Billing And Entitlements
Goal:
- Turn the current hosted product into something that can be sold and controlled.

Candidate scope:
- Stripe subscriptions.
- Workspace plans and entitlements.
- Plan-aware middleware and feature gates.
- Upgrade/downgrade lifecycle handling.
- Billing event audit trail.
- Migration path from free beta to paid tiers.

Why it matters:
- External SaaS commercialization is now the primary driver, so monetization readiness is no longer optional.

### Workstream C: Search, Prioritization, And Discovery Depth
Goal:
- Improve the quality of product decision-making beyond portal collection basics.

Candidate scope:
- Better search and retrieval.
- Full-text/global search.
- Richer prioritization formulas or scenario modeling.
- Better impact dashboards.
- Stronger operator insight surfaces.

Why it matters:
- This is the clearest path to differentiation against portal-only competitors.

## 7. Planning Options For Phase 7 Vs Phase 8

### Option 1: Phase 7 = Stability + Billing, Phase 8 = Discovery Depth
Best when:
- Commercial rollout speed matters most.

Pros:
- Strongest path to hosted SaaS monetization.
- Keeps sequencing disciplined.

Tradeoff:
- Product differentiation improvements wait longer.

### Option 2: Phase 7 = Stability + Discovery Depth, Phase 8 = Billing
Best when:
- Product differentiation is more urgent than monetization readiness.

Pros:
- Stronger product story versus Canny/Frill-style alternatives.

Tradeoff:
- Commercial rollout remains structurally delayed.

### Option 3: Phase 7 = Stability Only, Phase 8 = Billing + Discovery
Best when:
- The current product needs hardening first and the team wants a cleaner reset after that.

Pros:
- Lowest near-term execution risk.

Tradeoff:
- Slower revenue motion and slower differentiation.

## 8. Recommended Decision Rule
Regardless of the final split, Phase 7 should include:
1. The mandatory correctness and enterprise-access gate.
2. A non-trivial stability hardening block.

After that, choose between:
- Billing first, if commercialization urgency dominates.
- Discovery first, if competitive differentiation dominates.

## 9. External Sources Used
- UserVoice pricing: https://uservoice.com/pricing
- UserVoice SSO overview: https://help.uservoice.com/hc/en-us/articles/360060499314-Single-Sign-On-SSO
- UserVoice roadmap/product page: https://www.uservoice.com/product/multiple-roadmaps
- Canny features: https://canny.io/features
- Canny billing plans: https://help.canny.io/en/articles/9131812-canny-s-billing-plans
- Canny OIDC SSO: https://help.canny.io/en/articles/8047570-openid-connect-oidc-sso-integration
- Productboard pricing: https://www.productboard.com/pricing/productboard/
- Productboard portal page: https://www.productboard.com/product-portal/
- Productboard SAML SSO: https://support.productboard.com/hc/en-us/articles/360056316354-Enforce-SAML-single-sign-on
- Frill pricing: https://frill.co/pricing
- Frill widget page: https://frill.co/widget
- Frill SSO implementation docs: https://help.frill.co/article/65-sso-implementation
