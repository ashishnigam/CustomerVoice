# CustomerVoice Implementation Command Plan

## 1. Purpose
This plan defines the command-level workflow for bootstrapping and running CustomerVoice from local development to cloud deployment pipelines.

## 2. Assumptions
1. Runtime: Node.js LTS + pnpm.
2. Container runtime: Docker Desktop or OrbStack.
3. Local orchestration: Docker Compose.
4. Cloud orchestration: Kubernetes.
5. Repo target: `https://github.com/ashishnigam/CustomerVoice`.

## 3. Repository bootstrap commands
If current folder is not initialized as git:
```bash
cd /Users/ashishnigam/Startups
git clone https://github.com/ashishnigam/CustomerVoice.git
cd CustomerVoice
```

If initializing from existing local folder:
```bash
cd /Users/ashishnigam/Startups/CustomerVoice
git init
git remote add origin https://github.com/ashishnigam/CustomerVoice.git
git checkout -b codex/bootstrap
```

## 4. Recommended monorepo structure
```text
apps/
  web/
  api/
  worker/
  mobile/
packages/
  ui/
  config/
  types/
  eslint-config/
  tsconfig/
infra/
  docker/
  k8s/
  terraform/
docs/
```

## 5. Initial scaffold commands
```bash
pnpm init
pnpm add -D turbo typescript eslint prettier
pnpm dlx create-vite apps/web --template react-ts
pnpm dlx create-expo-app apps/mobile
mkdir -p apps/api apps/worker packages/ui packages/config packages/types infra/docker infra/k8s infra/terraform
```

## 6. Environment file commands
```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Minimum env keys:
```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
REDIS_URL=
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
JIRA_CLIENT_ID=
JIRA_CLIENT_SECRET=
LINEAR_CLIENT_ID=
LINEAR_CLIENT_SECRET=
FIGMA_ACCESS_TOKEN=
GOOGLE_DOCS_CLIENT_ID=
GOOGLE_DOCS_CLIENT_SECRET=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
DATA_RESIDENCY_DEFAULT_ZONE=US
DATA_RESIDENCY_ENABLED_ZONES=US
```

## 7. Local services commands (Docker Compose)
```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres redis mailhog minio
docker compose -f infra/docker/docker-compose.yml ps
```

## 8. Application install and run commands
```bash
pnpm install
pnpm -r build
pnpm --filter api dev
pnpm --filter worker dev
pnpm --filter web dev
pnpm --filter mobile start
```

## 9. Database workflow commands
Example with Prisma:
```bash
pnpm --filter api prisma generate
pnpm --filter api prisma migrate dev --name init
pnpm --filter api prisma db seed
```

## 10. Quality and test commands
```bash
pnpm -r lint
pnpm -r typecheck
pnpm -r test
pnpm -r test:integration
pnpm -r test:e2e
```

## 11. Security scan commands
```bash
pnpm -r audit
pnpm -r snyk test
pnpm -r eslint
```

Container and IaC scans (example tools):
```bash
trivy image customervoice/api:local
trivy config infra/terraform
```

## 12. Build and release commands
```bash
pnpm -r build
docker build -t customervoice/api:$(git rev-parse --short HEAD) apps/api
docker build -t customervoice/web:$(git rev-parse --short HEAD) apps/web
docker build -t customervoice/worker:$(git rev-parse --short HEAD) apps/worker
```

## 13. Kubernetes deploy commands
```bash
kubectl config use-context <target-cluster>
kubectl apply -f infra/k8s/namespaces.yaml
kubectl apply -f infra/k8s/secrets.yaml
kubectl apply -f infra/k8s/postgres.yaml
kubectl apply -f infra/k8s/redis.yaml
kubectl apply -f infra/k8s/api.yaml
kubectl apply -f infra/k8s/worker.yaml
kubectl apply -f infra/k8s/web.yaml
kubectl rollout status deploy/customervoice-api -n cv-staging
kubectl rollout status deploy/customervoice-web -n cv-staging
```

## 14. CI pipeline command stages
1. `install`:
```bash
pnpm install --frozen-lockfile
```
2. `verify`:
```bash
pnpm -r lint && pnpm -r typecheck && pnpm -r test
```
3. `security`:
```bash
pnpm -r audit && trivy config infra/terraform
```
4. `build`:
```bash
pnpm -r build
```
5. `package`:
```bash
docker build ...
```
6. `deploy-staging`:
```bash
kubectl apply ...
```
7. `smoke`:
```bash
pnpm --filter api test:smoke
```

## 15. Feature workflow commands (developer)
```bash
git checkout -b codex/<feature-name>
pnpm -r lint
pnpm -r test
git add .
git commit -m "feat: <summary>"
git push -u origin codex/<feature-name>
```

## 16. Integration testing commands
Jira:
```bash
pnpm --filter api test:integration:jira
```

Linear beta:
```bash
pnpm --filter api test:integration:linear
```

GitHub:
```bash
pnpm --filter api test:integration:github
```

## 17. Launch operations commands
Create release tag:
```bash
git checkout main
git pull
git tag v1.0.0
git push origin v1.0.0
```

Post-release validation:
```bash
pnpm --filter api test:smoke:prod
pnpm --filter api test:workflow:e2e
```

## 18. Command guardrails
1. No direct production DB writes outside migration tooling.
2. No deployment from local branch without PR and approvals.
3. AI-assisted workflow actions that write external artifacts require explicit gate approval by default.
4. Billing enablement commands remain behind feature flag until threshold conditions are met.

## 19. Monetization transition commands
After 50 external active logos:
```bash
pnpm --filter api feature-flag enable billing.transition
pnpm --filter api config set billing.transition_days 30
pnpm --filter api jobs enqueue transition-notice --all-eligible-workspaces
```

For tenant-specific override:
```bash
pnpm --filter api config set billing.transition_days <days> --workspace <workspace-id>
```

## 20. Data residency zone commands
Default (US-only):
```bash
pnpm --filter api config set data_residency.default_zone US
pnpm --filter api config set data_residency.enabled_zones US
```

Enable EU or India when approved:
```bash
pnpm --filter api config set data_residency.enabled_zones US,EU
pnpm --filter api config set data_residency.enabled_zones US,EU,IN
```

Pin tenant/workspace zone:
```bash
pnpm --filter api residency assign --workspace <workspace-id> --zone US
```
