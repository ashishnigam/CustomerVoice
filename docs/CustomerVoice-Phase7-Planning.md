# CustomerVoice Phase 7 Planning (Competitor-Gap Driven)

Last updated: 2026-03-07

## 1. Purpose
Define Phase 7 planning options using:
1. Current codebase status after Phase 6 baseline.
2. Competitor capability signals from official product/docs pages.

Roadmap source of truth remains:
- `docs/summary.md`
- `docs/CustomerVoice-Phases.md`

## 2. Current baseline (CustomerVoice)
Implemented by code:
- Public portal flows: ideas, votes, comments, roadmap/changelog, markdown, categories.
- Moderation + merge + spam + comment locking.
- SSE live updates for vote/comment events.
- Embeddable widget script + widget mode.
- MRR data path (`portal_users.mrr`) + impact scoring in queries.
- Enterprise SSO route skeleton + domain-based connection lookup.
- Playwright E2E scaffold and passing Phase 6 gate tests (`apps/e2e`).

Known pre-Phase-7 hardening focus:
- Complete configuration UX + automation for enterprise controls.
- Expand deterministic E2E and integration quality surface.

## 3. Competitor scan (official sources)

### 3.1 UserVoice
- Pricing positions enterprise-first with higher ACV and integration-dependent packaging.
- Multi-protocol SSO support (SAML, OIDC, OAuth2, JWT), including multi-provider setups.
- Feedback portal + in-app widget + contributor-side capture + status notifications are explicitly positioned.
- Roadmap supports stakeholder-specific views and shareable audiences.

### 3.2 Canny
- Public feature surface includes board privacy, internal comments, segmentation, MRR-impact sorting, roadmap/changelog, widget.
- Plan packaging is tiered; enterprise SSO/OIDC is Business-tier scoped.
- Roadmap/changelog are default core concepts with board access controls.

### 3.3 Productboard
- Product Portal + external sharing + feedback loop closure are central platform capabilities.
- Pricing clearly gates advanced portal/security/integration capabilities by tier.
- Enterprise SAML SSO and SCIM provisioning are documented as enterprise capabilities.
- Strong Jira integration depth (auth modes, mapping, multi-integration patterns).

### 3.4 Frill
- Public positioning emphasizes low-friction widgets, roadmap/changelog embedding, SSO, and broad integration set.
- Pricing is transparent and feature-tiered, with explicit add-on structure.
- Public feature list includes duplicate detection, webhooks, segmentation, prioritization matrix, and survey modules.

## 4. Gap matrix (CustomerVoice vs market signals)

### Gap A: Enterprise identity depth
Current:
- SSO callback/login baseline exists.
- SSO connection management APIs now exist.

Remaining gap:
- Full IdP onboarding UX, policy controls, and SCIM-style lifecycle provisioning are not complete.
- No hardened operator workflow for multi-IdP lifecycle and audit-ready administration.

### Gap B: Prioritization depth
Current:
- Vote, comment, and MRR impact scoring exist.
- Added `highest_impact` sorting in public flow.

Remaining gap:
- No rich prioritization model editor (weighted formulas, scenario comparisons, score governance).
- Limited segmentation/operator tooling compared with dedicated PM suites.

### Gap C: Search and retrieval quality
Current:
- Basic keyword search over ideas.

Remaining gap:
- No full-text relevance layer, semantic retrieval, or cross-entity global search.

### Gap D: Commercial packaging
Current:
- Pricing page content exists in marketing.

Remaining gap:
- No Stripe-backed billing, entitlements, plan enforcement, upgrade/downgrade lifecycle.

### Gap E: Operator analytics
Current:
- Internal analytics with RICE/revenue/outreach exists.

Remaining gap:
- Limited KPI trend dashboards, cohort outcomes, portal funnel analytics, and release impact analytics.

### Gap F: Reliability and QA maturity
Current:
- CI baseline + unit/integration + Playwright scaffold.
- E2E port/seed alignment improved.

Remaining gap:
- Broader deterministic DB-backed suites and production-like smoke automation are still needed.

## 5. Phase 7 planning options (no final priority lock yet)

### Option 1: Reliability-first Phase 7
Goal:
- Reduce delivery risk before monetization features.

Scope:
- CI hardening, deterministic DB integration setup, expanded E2E matrix, health/smoke checks, runbook automation.

Output:
- Higher confidence release cadence and lower regression risk for billing/search rollout.

### Option 2: Revenue-first Phase 7
Goal:
- Introduce monetization and entitlement controls.

Scope:
- Stripe subscriptions, workspace entitlements, plan enforcement middleware, billing lifecycle events, migration tools.

Output:
- Monetization readiness and controlled rollout to external tenants.

### Option 3: Discovery-first Phase 7
Goal:
- Differentiate product decision quality.

Scope:
- Full-text/global search, richer prioritization framework, advanced impact dashboards.

Output:
- Stronger PM workflow positioning versus portal-only competitors.

## 6. Suggested sequencing (balanced)
1. Reliability hardening gate (short block, mandatory).
2. Commercialization foundation (billing + entitlements).
3. Discovery differentiation (search + advanced analytics/prioritization).

This sequence keeps risk controlled while preserving revenue path and long-term differentiation.

## 7. External sources (official pages used)
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
