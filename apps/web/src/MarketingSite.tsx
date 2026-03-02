import type { MouseEvent, ReactNode } from 'react';
import {
  EnterpriseReadyIllustration,
  FeedbackLoopIllustration,
  PortalBoardIllustration,
} from './marketingIllustrations';

type NavigateFn = (path: string) => void;

type PageMetadata = {
  title: string;
  description: string;
  ogType: 'website' | 'article';
  structuredData: Record<string, unknown>;
};

type FeatureCard = {
  eyebrow: string;
  title: string;
  body: string;
};

type PricingPlan = {
  name: string;
  stage: string;
  price: string;
  summary: string;
  highlights: string[];
  ctaLabel: string;
  ctaPath: string;
};

type BlogPost = {
  slug: string;
  category: string;
  title: string;
  summary: string;
  publishedAt: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
};

const featureCards: FeatureCard[] = [
  {
    eyebrow: 'Portal',
    title: 'Collect demand in one public feedback board',
    body:
      'Boards, ideas, votes, comments, visible statuses, and category filters are in place so customers can see what is being requested and what is shipping.',
  },
  {
    eyebrow: 'Moderation',
    title: 'Triage noisy requests without losing signal',
    body:
      'Product teams can mark spam, lock comment threads, merge duplicates, and run bulk moderation actions from the internal queue.',
  },
  {
    eyebrow: 'Decisioning',
    title: 'Rank work using RICE and revenue potential',
    body:
      'Internal analytics surfaces reach, impact, confidence, effort, revenue potential, and customer contact lists so PMs can make defendable calls.',
  },
  {
    eyebrow: 'Close The Loop',
    title: 'Notify users when an idea is completed',
    body:
      'Completion notifications and outreach jobs are persisted and dispatched through the worker so teams can close the loop instead of silently shipping.',
  },
];

const workflowSteps = [
  {
    label: '1. Capture',
    title: 'Users submit and vote on ideas',
    body: 'Public boards create a single demand surface instead of scattered email threads, sales notes, and spreadsheets.',
  },
  {
    label: '2. Triage',
    title: 'Product managers moderate and deduplicate',
    body: 'Spam control, duplicate merge, and comment lock keep the signal clean before roadmap decisions are made.',
  },
  {
    label: '3. Prioritize',
    title: 'Internal analytics turns feedback into a plan',
    body: 'RICE, revenue potential, and customer contact context help teams decide what deserves roadmap capacity first.',
  },
  {
    label: '4. Ship',
    title: 'Customers are notified when work is done',
    body: 'Users who voted or commented receive completion updates so product delivery stays visible and trust compounds over time.',
  },
];

const proofPoints = [
  'GoodHealth.ai and GoodWealth.ai can use the same platform before external B2B SaaS expansion.',
  'Cloud deployment stays provider-neutral with local Docker Compose and cloud Kubernetes paths.',
  'Mock auth and Supabase JWT verification both exist so teams can move from local demo to enterprise posture cleanly.',
  'The product is being built compliance-ready for SOC 2, HIPAA, GDPR, and ISO 27001 without falsely claiming certification yet.',
];

const pricingPlans: PricingPlan[] = [
  {
    name: 'Beta',
    stage: 'Available now',
    price: '$0',
    summary: 'Free beta until the platform reaches 50 external customer logos, followed by a configurable 30-day transition window.',
    highlights: [
      'Unlimited feedback boards inside the beta period',
      'Ideas, votes, comments, categories, and status workflows',
      'Moderation queue and internal analytics cockpit',
      'Completion notification emails through the worker pipeline',
    ],
    ctaLabel: 'Open The App',
    ctaPath: '/app',
  },
  {
    name: 'Growth',
    stage: 'Planned post-beta',
    price: 'Custom',
    summary: 'For SaaS teams that want a hosted product feedback operating system with deeper packaging after beta conversion starts.',
    highlights: [
      'Everything in Beta',
      'Expanded reporting and admin controls',
      'Packaging for self-serve plus sales-assisted teams',
      'Commercial rollout after the beta threshold is reached',
    ],
    ctaLabel: 'Read Features',
    ctaPath: '/features',
  },
  {
    name: 'Enterprise',
    stage: 'Roadmap-aligned',
    price: 'Custom',
    summary: 'For regulated or large enterprises that need deployment flexibility, private AI paths, and stricter identity controls.',
    highlights: [
      'Private model and VPC posture from early enterprise design',
      'Future single-tenant or VPC deployment profile',
      'Future custom domain and branded email support',
      'Future SSO embed for sister-company and enterprise portals',
    ],
    ctaLabel: 'Open Docs',
    ctaPath: '/docs',
  },
];

const blogPosts: BlogPost[] = [
  {
    slug: 'feedback-ops-beats-static-roadmaps',
    category: 'Product Strategy',
    title: 'Why feedback ops beats a static public roadmap',
    summary:
      'A feedback board only matters when it feeds moderation, prioritization, and customer communication. Otherwise it becomes an archive of ignored requests.',
    publishedAt: 'March 2, 2026',
    sections: [
      {
        heading: 'The portal is the intake layer, not the product strategy',
        body:
          'Most feedback tools fail because they stop at collection. Teams get a board full of requests but no consistent way to deduplicate, score, or translate demand into roadmap decisions. CustomerVoice is being shaped as a workflow from idea capture to shipped update, not just as a suggestion box.',
      },
      {
        heading: 'Visible decisions reduce support and sales friction',
        body:
          'When customers can see idea status, product teams stop answering the same roadmap question in ten places. Sales, support, founders, and PMs all gain a common reference point. That is operational leverage, not just UX polish.',
      },
      {
        heading: 'Closing the loop is where trust compounds',
        body:
          'Customers remember whether teams respond after they ship. Completion notifications and targeted outreach are the mechanism that turns feedback into a trust loop. Without that loop, a portal becomes a graveyard of good intentions.',
      },
    ],
  },
  {
    slug: 'how-to-score-feature-demand-with-rice-and-revenue',
    category: 'Prioritization',
    title: 'How to score feature demand with RICE and revenue context',
    summary:
      'Votes alone are a weak prioritization signal. Mature product teams combine votes with customer concentration, revenue potential, and implementation effort.',
    publishedAt: 'February 26, 2026',
    sections: [
      {
        heading: 'Votes tell you interest, not business value',
        body:
          'An upvote count is useful, but it cannot answer whether the demand comes from strategic accounts, new segments, or low-retention cohorts. CustomerVoice pairs the visible demand signal with internal analytics so product decisions are not made on popularity alone.',
      },
      {
        heading: 'RICE creates a shared decision language',
        body:
          'Reach, impact, confidence, and effort give PMs and engineering managers a framework they can defend in roadmap reviews. The point is not mathematical purity. The point is forcing the right conversation using a consistent model.',
      },
      {
        heading: 'Revenue potential helps founders make portfolio calls',
        body:
          'A founder-led team needs to know which requests protect pipeline, expand account value, or unlock new buyers. Internal revenue potential fields and contact lists make the feedback board useful for commercial decisions, not only product decisions.',
      },
    ],
  },
  {
    slug: 'building-a-compliance-ready-feedback-platform',
    category: 'Architecture',
    title: 'Building a compliance-ready feedback platform before formal certification',
    summary:
      'Early-stage teams should not claim compliance they do not yet have. They should build evidence-friendly systems so certification becomes a process step instead of a rewrite.',
    publishedAt: 'February 18, 2026',
    sections: [
      {
        heading: 'Compliance-ready is an engineering posture',
        body:
          'The practical goal in year one is to choose patterns that later support SOC 2, HIPAA, GDPR, and ISO 27001. That means audit events, clear identity boundaries, secure defaults, and an architecture that can support data-residency expansion without re-platforming.',
      },
      {
        heading: 'Do not overbuild the first release',
        body:
          'A compliance-ready product is not the same as a bloated platform. Start with multi-tenant SaaS, keep local and cloud environments close, and put strong interfaces around auth, audit, and notification systems. That is enough to move quickly without creating future traps.',
      },
      {
        heading: 'Enterprise posture needs early design decisions',
        body:
          'Private model routing, VPC deployment options, and enterprise SSO do not need to be fully shipped in V1, but the architecture has to leave room for them. Otherwise the first enterprise deal arrives before the product is structurally ready to support it.',
      },
    ],
  },
];

const docsQuickstart = `pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/worker/.env.example apps/worker/.env
POSTGRES_PORT=55432 docker compose -f infra/docker/docker-compose.yml up -d postgres redis mailhog minio
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/customervoice pnpm --filter @customervoice/api db:migrate
pnpm dev`;

const apiGroups = [
  {
    title: 'Boards and categories',
    body: 'Create boards, define taxonomy, and keep the public portal organized by team or product area.',
    endpoints: [
      'GET /api/v1/workspaces/:workspaceId/boards',
      'POST /api/v1/workspaces/:workspaceId/boards',
      'GET /api/v1/workspaces/:workspaceId/categories',
      'POST /api/v1/workspaces/:workspaceId/categories',
    ],
  },
  {
    title: 'Ideas, votes, and comments',
    body: 'Capture feature demand, let customers vote, and attach comments to the idea record.',
    endpoints: [
      'GET /api/v1/workspaces/:workspaceId/boards/:boardId/ideas',
      'POST /api/v1/workspaces/:workspaceId/boards/:boardId/ideas',
      'POST /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/votes',
      'GET /api/v1/workspaces/:workspaceId/boards/:boardId/ideas/:ideaId/comments',
    ],
  },
  {
    title: 'Moderation and analytics',
    body: 'Run duplicate merge, spam control, comment locking, RICE scoring, CSV export, and outreach workflows.',
    endpoints: [
      'GET /api/v1/workspaces/:workspaceId/moderation/ideas',
      'POST /api/v1/workspaces/:workspaceId/moderation/ideas/merge',
      'GET /api/v1/workspaces/:workspaceId/analytics/ideas',
      'PUT /api/v1/workspaces/:workspaceId/analytics/ideas/:ideaId/input',
    ],
  },
];

const docsRoadmap = [
  'Jira and Linear are selected integration targets, but deep connector implementation is not in this V1 codebase yet.',
  'GoodHealth.ai and GoodWealth.ai SSO plus embedded portal views are planned in V2, not delivered in the current local build.',
  'AI-driven PRD, research, design, development, and release gates are intentionally moved to V3.',
];

const useCases = [
  {
    title: 'Founder-led SaaS teams',
    body: 'Turn customer calls, support requests, and account pressure into one visible board instead of a hidden spreadsheet.',
  },
  {
    title: 'Product and engineering leadership',
    body: 'Run moderation, prioritization, and shipped communication from the same surface instead of stitching together multiple tools.',
  },
  {
    title: 'Regulated and enterprise-leaning teams',
    body: 'Start with a simple multi-tenant product while preserving the architectural room needed for private AI, regional rollout, and enterprise controls.',
  },
];

const outcomeSignals = [
  'A visible public feedback board that customers can understand quickly.',
  'An internal operating layer for moderation, RICE, revenue context, and outreach.',
  'A GTM-friendly website with SEO content, product narrative, and developer-facing docs.',
];

const knownStaticRoutes = new Set([
  '/',
  '/features',
  '/pricing',
  '/blog',
  '/docs',
  '/docs/api',
  '/docs/integrations',
  '/docs/brand',
]);

function getBlogPostByPath(path: string): BlogPost | undefined {
  return blogPosts.find((post) => `/blog/${post.slug}` === path);
}

export function normalizeSitePath(path: string): string {
  const withoutHash = path.split('#')[0] ?? '/';
  const withoutQuery = withoutHash.split('?')[0] ?? '/';
  const normalized = withoutQuery.length > 1 && withoutQuery.endsWith('/') ? withoutQuery.slice(0, -1) : withoutQuery;

  if (normalized === '' || normalized === '/') {
    return '/';
  }

  if (getBlogPostByPath(normalized)) {
    return normalized;
  }

  if (normalized.startsWith('/blog/')) {
    return '/blog';
  }

  if (knownStaticRoutes.has(normalized)) {
    return normalized;
  }

  if (normalized.startsWith('/docs/')) {
    return '/docs';
  }

  return '/';
}

export function getMarketingMetadata(path: string, origin: string): PageMetadata {
  const normalizedPath = normalizeSitePath(path);
  const pageUrl = `${origin}${normalizedPath}`;
  const blogPost = getBlogPostByPath(normalizedPath);

  if (blogPost) {
    return {
      title: `${blogPost.title} | CustomerVoice Blog`,
      description: blogPost.summary,
      ogType: 'article',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: blogPost.title,
        datePublished: blogPost.publishedAt,
        articleSection: blogPost.category,
        description: blogPost.summary,
        mainEntityOfPage: pageUrl,
        author: {
          '@type': 'Organization',
          name: 'CustomerVoice',
        },
        publisher: {
          '@type': 'Organization',
          name: 'CustomerVoice',
        },
      },
    };
  }

  const pageMap: Record<string, Omit<PageMetadata, 'structuredData'>> = {
    '/': {
      title: 'CustomerVoice | Feedback Portal And Product Decision Platform',
      description:
        'CustomerVoice helps product teams capture ideas, moderate signal, prioritize with RICE and revenue context, and close the loop with shipped notifications.',
      ogType: 'website',
    },
    '/features': {
      title: 'CustomerVoice Features | Portal, Moderation, Analytics, Notifications',
      description:
        'Explore the CustomerVoice feature set across public feedback collection, moderation workflows, internal analytics, and completion notifications.',
      ogType: 'website',
    },
    '/pricing': {
      title: 'CustomerVoice Pricing | Free Beta To Growth And Enterprise',
      description:
        'View CustomerVoice beta, growth, and enterprise packaging direction including the free beta threshold and transition model.',
      ogType: 'website',
    },
    '/blog': {
      title: 'CustomerVoice Blog | Feedback Ops, Product Strategy, Architecture',
      description:
        'Read CustomerVoice articles on feedback operations, prioritization, architecture, and product delivery workflows.',
      ogType: 'website',
    },
    '/docs': {
      title: 'CustomerVoice Docs | Quickstart, Architecture, Developer Guide',
      description:
        'Developer documentation for CustomerVoice covering quickstart, auth modes, API groups, and implementation boundaries.',
      ogType: 'website',
    },
    '/docs/api': {
      title: 'CustomerVoice API Docs | Auth, Endpoint Groups, Local Testing',
      description:
        'Review the CustomerVoice API entry points for boards, ideas, moderation, analytics, and audit-friendly local testing.',
      ogType: 'website',
    },
    '/docs/integrations': {
      title: 'CustomerVoice Integration Guide | Current Platform Surface And Roadmap',
      description:
        'Understand the current CustomerVoice integration surface, auth options, and the planned roadmap for embed and connector workflows.',
      ogType: 'website',
    },
    '/docs/brand': {
      title: 'CustomerVoice Brand Guide | Design System And Voice Principles',
      description:
        'Review the CustomerVoice brand system covering visual language, voice, illustration style, and product-to-marketing experience rules.',
      ogType: 'website',
    },
  };

  const page = pageMap[normalizedPath] ?? pageMap['/'];

  return {
    ...page,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'CustomerVoice',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: page.description,
      url: pageUrl,
    },
  };
}

function SiteLink({
  path,
  onNavigate,
  className,
  children,
}: {
  path: string;
  onNavigate: NavigateFn;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    onNavigate(path);
  }

  return (
    <a className={className} href={path} onClick={handleClick}>
      {children}
    </a>
  );
}

function activeNav(path: string): string {
  if (path.startsWith('/blog/')) {
    return '/blog';
  }

  if (path.startsWith('/docs/')) {
    return '/docs';
  }

  return path;
}

function renderHome(onNavigate: NavigateFn): JSX.Element {
  return (
    <>
      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow marketing-eyebrow">Customer Feedback, Prioritization, And Product Delivery Visibility</p>
          <h1 className="hero-title">Build the public board customers want, with the internal workflow product teams need.</h1>
          <p className="hero-body">
            CustomerVoice is a feedback operations platform for SaaS teams that want more than a voting board. Capture
            demand publicly, moderate and prioritize it internally, then close the loop when work ships.
          </p>
          <div className="hero-actions">
            <SiteLink className="hero-button primary" path="/app" onNavigate={onNavigate}>
              Launch The App
            </SiteLink>
            <SiteLink className="hero-button secondary" path="/docs" onNavigate={onNavigate}>
              Explore Docs
            </SiteLink>
          </div>
          <div className="hero-metrics">
            <div>
              <strong>Public board</strong>
              <span>Customers can see requests, vote, comment, and follow visible statuses.</span>
            </div>
            <div>
              <strong>Internal cockpit</strong>
              <span>Moderation, analytics, and outreach live behind the same product surface.</span>
            </div>
            <div>
              <strong>Enterprise posture</strong>
              <span>Cloud-neutral and compliance-ready without pretending enterprise features are already done.</span>
            </div>
          </div>
        </div>
        <aside className="hero-panel">
          <PortalBoardIllustration />
        </aside>
      </section>

      <section className="marketing-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow marketing-eyebrow">Why CustomerVoice</p>
            <h2>Most feedback tools stop at collection. Product teams do not.</h2>
          </div>
          <SiteLink className="inline-link" path="/features" onNavigate={onNavigate}>
            View full feature breakdown
          </SiteLink>
        </div>
        <div className="marketing-card-grid four-up">
          {featureCards.map((feature) => (
            <article className="marketing-card" key={feature.title}>
              <p className="eyebrow marketing-eyebrow">{feature.eyebrow}</p>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section split-visual-section">
        <div>
          <p className="eyebrow marketing-eyebrow">Workflow</p>
          <h2>From demand intake to shipped update.</h2>
          <div className="workflow-grid">
            {workflowSteps.map((step) => (
              <article className="workflow-card" key={step.label}>
                <span>{step.label}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="visual-card">
          <FeedbackLoopIllustration />
        </div>
      </section>

      <section className="marketing-section proof-section">
        <div>
          <p className="eyebrow marketing-eyebrow">Operating Thesis</p>
          <h2>Designed for sister-company rollout first, then external B2B SaaS growth.</h2>
        </div>
        <div className="proof-list">
          {proofPoints.map((item) => (
            <div className="proof-item" key={item}>
              <strong>Signal</strong>
              <p>{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="marketing-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow marketing-eyebrow">Who This Is For</p>
            <h2>Built for teams that want product feedback to become an operating system.</h2>
          </div>
        </div>
        <div className="marketing-card-grid three-up">
          {useCases.map((item) => (
            <article className="marketing-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section split-visual-section">
        <div>
          <p className="eyebrow marketing-eyebrow">Enterprise-Ready Direction</p>
          <h2>Simple product now, serious architecture underneath.</h2>
          <div className="marketing-card compact-callout">
            <ul className="marketing-list">
              <li>Global-first posture with US default zone and planned EU/India activation.</li>
              <li>Mock auth locally and Supabase JWT verification for production-ready identity flows.</li>
              <li>Architecture prepared for SOC 2, HIPAA, GDPR, and ISO 27001 evidence-building.</li>
            </ul>
          </div>
        </div>
        <div className="visual-card">
          <EnterpriseReadyIllustration />
        </div>
      </section>

      <section className="marketing-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow marketing-eyebrow">What Launch Actually Delivers</p>
            <h2>Marketing promise and shipped scope stay aligned.</h2>
          </div>
          <SiteLink className="inline-link" path="/docs/integrations" onNavigate={onNavigate}>
            Review implementation boundaries
          </SiteLink>
        </div>
        <div className="marketing-card-grid three-up">
          {outcomeSignals.map((item) => (
            <article className="marketing-card" key={item}>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section cta-strip">
        <div>
          <p className="eyebrow marketing-eyebrow">Next Step</p>
          <h2>Use the website to evaluate the category. Use the app to run the workflow.</h2>
        </div>
        <div className="button-cluster">
          <SiteLink className="hero-button primary" path="/pricing" onNavigate={onNavigate}>
            See Pricing
          </SiteLink>
          <SiteLink className="hero-button ghost" path="/blog" onNavigate={onNavigate}>
            Read The Blog
          </SiteLink>
        </div>
      </section>
    </>
  );
}

function renderFeatures(onNavigate: NavigateFn): JSX.Element {
  return (
    <>
      <section className="page-intro">
        <p className="eyebrow marketing-eyebrow">Features</p>
        <h1>Everything in V1 is organized around a simple principle: visible product decisions.</h1>
        <p>
          The public portal handles collection. The internal workspace handles moderation, prioritization, and customer
          communication. The architecture leaves room for enterprise posture without forcing that complexity into day
          one.
        </p>
      </section>

      <section className="marketing-card-grid two-up">
        <article className="marketing-card feature-spotlight">
          <h2>Public portal</h2>
          <ul className="marketing-list">
            <li>Board creation and public idea submission.</li>
            <li>Votes, comments, visible status progression, and category tagging.</li>
            <li>Search, sort, and filter controls for a Microsoft-style discovery flow.</li>
            <li>Simple web UX that can later be embedded into sister-company surfaces.</li>
          </ul>
        </article>
        <article className="marketing-card feature-spotlight">
          <h2>Internal product workspace</h2>
          <ul className="marketing-list">
            <li>Moderation queue for spam control, comment lock, and duplicate merge.</li>
            <li>Bulk moderation actions to clean the backlog faster.</li>
            <li>RICE and revenue potential inputs for structured prioritization.</li>
            <li>Audience lists and outreach enqueue for product and customer teams.</li>
          </ul>
        </article>
        <article className="marketing-card feature-spotlight">
          <h2>Platform foundation</h2>
          <ul className="marketing-list">
            <li>Multi-tenant architecture with local Docker Compose and cloud Kubernetes paths.</li>
            <li>Supabase JWT verification plus local mock auth for fast iteration.</li>
            <li>Audit event persistence across auth, moderation, notifications, and analytics.</li>
            <li>Cloud-agnostic deployment direction with GCP as tie-breaker when needed.</li>
          </ul>
        </article>
        <article className="marketing-card feature-spotlight">
          <h2>What is intentionally deferred</h2>
          <ul className="marketing-list">
            <li>Beta tester cohort management moves to V2.</li>
            <li>Custom domains and branded email move to V2.</li>
            <li>GoodHealth.ai and GoodWealth.ai SSO embed moves to V2.</li>
            <li>AI-driven PRD-to-release orchestration moves to V3.</li>
          </ul>
        </article>
      </section>

      <section className="marketing-section split-callout">
        <div>
          <p className="eyebrow marketing-eyebrow">Engineering Constraint</p>
          <h2>Scalable enough for launch, simple enough to run locally.</h2>
          <p>
            The stack is React on the web, Node in the API and worker layer, Postgres for persistence, and Docker
            Compose locally. That keeps day-one developer experience practical while preserving a clean path to managed
            cloud infrastructure.
          </p>
        </div>
        <SiteLink className="hero-button secondary" path="/docs/integrations" onNavigate={onNavigate}>
          Review integration boundaries
        </SiteLink>
      </section>
    </>
  );
}

function renderPricing(onNavigate: NavigateFn): JSX.Element {
  return (
    <>
      <section className="page-intro">
        <p className="eyebrow marketing-eyebrow">Pricing</p>
        <h1>Free beta first. Commercial packaging after real adoption appears.</h1>
        <p>
          The launch model is deliberate: keep the product free during beta until 50 external logos are active, then
          move customers through a configurable 30-day transition before paid rollout. That keeps friction low while the
          workflow matures.
        </p>
      </section>

      <section className="pricing-grid">
        {pricingPlans.map((plan) => (
          <article className="pricing-card" key={plan.name}>
            <p className="plan-stage">{plan.stage}</p>
            <h2>{plan.name}</h2>
            <div className="plan-price">{plan.price}</div>
            <p>{plan.summary}</p>
            <ul className="marketing-list">
              {plan.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
            <SiteLink className="hero-button secondary" path={plan.ctaPath} onNavigate={onNavigate}>
              {plan.ctaLabel}
            </SiteLink>
          </article>
        ))}
      </section>

      <section className="marketing-section split-callout">
        <div>
          <p className="eyebrow marketing-eyebrow">Packaging Logic</p>
          <h2>Enterprise requirements are acknowledged early, not faked early.</h2>
          <p>
            Private model routing, VPC posture, and regional expansion are part of the roadmap because enterprise buyers
            will ask for them. The correct move is to design for those requirements now and commercialize them only when
            the product and demand justify it.
          </p>
        </div>
        <SiteLink className="hero-button ghost" path="/docs" onNavigate={onNavigate}>
          See technical posture
        </SiteLink>
      </section>
    </>
  );
}

function renderBlogIndex(onNavigate: NavigateFn): JSX.Element {
  return (
    <>
      <section className="page-intro">
        <p className="eyebrow marketing-eyebrow">Blog</p>
        <h1>Content designed to support SEO, funding narrative, and product education.</h1>
        <p>
          The blog should not be filler. It should explain the operating thesis, teach the market, and help founders,
          PMs, and engineering leaders understand why feedback operations matter.
        </p>
      </section>
      <section className="marketing-card-grid three-up">
        {blogPosts.map((post) => (
          <article className="marketing-card blog-card" key={post.slug}>
            <p className="eyebrow marketing-eyebrow">{post.category}</p>
            <h2>{post.title}</h2>
            <p>{post.summary}</p>
            <div className="blog-meta-row">
              <span>{post.publishedAt}</span>
              <SiteLink className="inline-link" path={`/blog/${post.slug}`} onNavigate={onNavigate}>
                Read article
              </SiteLink>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function renderBlogPost(path: string, onNavigate: NavigateFn): JSX.Element {
  const post = getBlogPostByPath(path);

  if (!post) {
    return renderBlogIndex(onNavigate);
  }

  return (
    <article className="blog-article">
      <SiteLink className="inline-link" path="/blog" onNavigate={onNavigate}>
        Back to blog
      </SiteLink>
      <p className="eyebrow marketing-eyebrow">{post.category}</p>
      <h1>{post.title}</h1>
      <p className="blog-lead">{post.summary}</p>
      <div className="blog-meta-row">
        <span>{post.publishedAt}</span>
        <span>CustomerVoice editorial</span>
      </div>
      <div className="blog-section-stack">
        {post.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}

function renderDocsOverview(onNavigate: NavigateFn): JSX.Element {
  return (
    <>
      <section className="page-intro">
        <p className="eyebrow marketing-eyebrow">Documentation</p>
        <h1>Developer docs focused on what exists now and what is intentionally planned later.</h1>
        <p>
          The fastest way to create confusion is to publish docs that promise features the platform does not yet have.
          These docs keep the line clear between implemented surface area and roadmap commitments.
        </p>
      </section>

      <section className="docs-grid">
        <article className="marketing-card docs-card">
          <h2>Quickstart</h2>
          <p>Run the local environment with Docker Compose and start the web, API, and worker apps.</p>
          <pre>
            <code>{docsQuickstart}</code>
          </pre>
        </article>
        <article className="marketing-card docs-card">
          <h2>Auth modes</h2>
          <ul className="marketing-list">
            <li>`AUTH_MODE=mock` for seeded local actor headers.</li>
            <li>`AUTH_MODE=supabase` for bearer token verification and membership resolution.</li>
            <li>Enterprise SSO and embed are planned for V2, not delivered in the current build.</li>
          </ul>
        </article>
      </section>

      <section className="marketing-card-grid two-up">
        <article className="marketing-card docs-card">
          <h2>API guide</h2>
          <p>Boards, ideas, votes, comments, moderation, analytics, membership, and audit endpoints.</p>
          <SiteLink className="inline-link" path="/docs/api" onNavigate={onNavigate}>
            Open API guide
          </SiteLink>
        </article>
        <article className="marketing-card docs-card">
          <h2>Integration guide</h2>
          <p>Current integration boundaries, auth expectations, and roadmap items that are not implemented yet.</p>
          <SiteLink className="inline-link" path="/docs/integrations" onNavigate={onNavigate}>
            Open integration guide
          </SiteLink>
        </article>
        <article className="marketing-card docs-card">
          <h2>Brand guide</h2>
          <p>Visual language, voice, illustration style, and app-to-marketing consistency rules for future work.</p>
          <SiteLink className="inline-link" path="/docs/brand" onNavigate={onNavigate}>
            Open brand guide
          </SiteLink>
        </article>
      </section>
    </>
  );
}

function renderDocsApi(): JSX.Element {
  return (
    <>
      <section className="page-intro">
        <p className="eyebrow marketing-eyebrow">API Guide</p>
        <h1>Current API surface for developers integrating with CustomerVoice.</h1>
        <p>
          The OpenAPI file remains the source of truth, but this page gives a faster operator view of what a developer
          can rely on in the current implementation.
        </p>
      </section>

      <section className="marketing-card docs-card">
        <h2>Authentication</h2>
        <ul className="marketing-list">
          <li>Mock mode accepts workspace, user, role, and email headers for local development.</li>
          <li>Supabase mode validates bearer tokens and resolves workspace membership from the database.</li>
          <li>Authorization is workspace-scoped and enforced through the RBAC policy layer.</li>
        </ul>
      </section>

      <section className="marketing-card-grid three-up">
        {apiGroups.map((group) => (
          <article className="marketing-card docs-card" key={group.title}>
            <h2>{group.title}</h2>
            <p>{group.body}</p>
            <ul className="endpoint-list">
              {group.endpoints.map((endpoint) => (
                <li key={endpoint}>
                  <code>{endpoint}</code>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </>
  );
}

function renderDocsIntegrations(): JSX.Element {
  return (
    <>
      <section className="page-intro">
        <p className="eyebrow marketing-eyebrow">Integration Guide</p>
        <h1>What integrators can use today and what remains roadmap work.</h1>
        <p>
          This prevents downstream teams from building on assumptions. Use the current API and auth surface today. Plan
          for the broader connector and embed layer in later phases.
        </p>
      </section>

      <section className="marketing-card docs-card">
        <h2>Ready today</h2>
        <ul className="marketing-list">
          <li>REST API for boards, ideas, comments, votes, moderation, analytics, membership, and audit events.</li>
          <li>Local development with Docker Compose, Postgres, Redis, MailHog, and MinIO.</li>
          <li>Supabase JWT verification path for production-grade auth integration.</li>
        </ul>
      </section>

      <section className="marketing-card docs-card">
        <h2>Planned later</h2>
        <ul className="marketing-list">
          {docsRoadmap.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

function renderDocsBrand(): JSX.Element {
  return (
    <>
      <section className="page-intro">
        <p className="eyebrow marketing-eyebrow">Brand Guide</p>
        <h1>Design and voice rules for keeping CustomerVoice coherent as the product grows.</h1>
        <p>
          The long-form source document lives in
          {' '}
          <code>/Users/ashishnigam/Startups/CustomerVoice/docs/CustomerVoice-Brand-Guidelines.md</code>
          . This page is the short operational summary for designers, engineers, and AI agents working in the repo.
        </p>
      </section>

      <section className="marketing-card-grid two-up">
        <article className="marketing-card docs-card">
          <h2>Brand posture</h2>
          <ul className="marketing-list">
            <li>Serious product operations software, not a playful suggestion box.</li>
            <li>Clear, pragmatic, and evidence-driven tone over hype-heavy SaaS copy.</li>
            <li>Visual language should feel bright, trustworthy, and deliberate.</li>
          </ul>
        </article>
        <article className="marketing-card docs-card">
          <h2>Design rules</h2>
          <ul className="marketing-list">
            <li>Use layered light backgrounds, deep blue anchors, and green support accents.</li>
            <li>Prefer expressive serif headlines plus clean sans-serif UI pairing.</li>
            <li>Use illustrations and structured layouts instead of generic stock-photo patterns.</li>
          </ul>
        </article>
      </section>
    </>
  );
}

function renderContent(path: string, onNavigate: NavigateFn): JSX.Element {
  switch (path) {
    case '/':
      return renderHome(onNavigate);
    case '/features':
      return renderFeatures(onNavigate);
    case '/pricing':
      return renderPricing(onNavigate);
    case '/blog':
      return renderBlogIndex(onNavigate);
    case '/docs':
      return renderDocsOverview(onNavigate);
    case '/docs/api':
      return renderDocsApi();
    case '/docs/integrations':
      return renderDocsIntegrations();
    case '/docs/brand':
      return renderDocsBrand();
    default:
      if (path.startsWith('/blog/')) {
        return renderBlogPost(path, onNavigate);
      }
      return renderHome(onNavigate);
  }
}

export function MarketingSite({ path, onNavigate }: { path: string; onNavigate: NavigateFn }): JSX.Element {
  const currentNav = activeNav(path);

  return (
    <div className="marketing-shell">
      <header className="marketing-header">
        <div className="marketing-header-inner">
          <SiteLink className="brand-mark" path="/" onNavigate={onNavigate}>
            <span>CustomerVoice</span>
            <small>Feedback portal and product ops</small>
          </SiteLink>
          <nav className="marketing-nav" aria-label="Primary">
            {[
              { label: 'Home', path: '/' },
              { label: 'Features', path: '/features' },
              { label: 'Pricing', path: '/pricing' },
              { label: 'Blog', path: '/blog' },
              { label: 'Docs', path: '/docs' },
            ].map((item) => (
              <SiteLink
                className={currentNav === item.path ? 'nav-link nav-link-active' : 'nav-link'}
                key={item.path}
                path={item.path}
                onNavigate={onNavigate}
              >
                {item.label}
              </SiteLink>
            ))}
          </nav>
          <div className="marketing-actions">
            <SiteLink className="hero-button ghost" path="/docs/api" onNavigate={onNavigate}>
              API Docs
            </SiteLink>
            <SiteLink className="hero-button primary" path="/app" onNavigate={onNavigate}>
              Open App
            </SiteLink>
          </div>
        </div>
      </header>

      <main className="marketing-main">{renderContent(path, onNavigate)}</main>

      <footer className="marketing-footer">
        <div>
          <strong>CustomerVoice</strong>
          <p>Public feedback collection, internal prioritization, and shipped-update workflows in one product surface.</p>
        </div>
        <div className="footer-link-row">
          <SiteLink className="inline-link" path="/features" onNavigate={onNavigate}>
            Features
          </SiteLink>
          <SiteLink className="inline-link" path="/pricing" onNavigate={onNavigate}>
            Pricing
          </SiteLink>
          <SiteLink className="inline-link" path="/blog" onNavigate={onNavigate}>
            Blog
          </SiteLink>
          <SiteLink className="inline-link" path="/docs" onNavigate={onNavigate}>
            Docs
          </SiteLink>
          <SiteLink className="inline-link" path="/app" onNavigate={onNavigate}>
            App
          </SiteLink>
        </div>
      </footer>
    </div>
  );
}
