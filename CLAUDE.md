# CoinDCX Trading Agent

## Project Overview
Multi-service Node.js/Fastify backend + Flutter web frontend for AI-powered crypto trading. 5 backend services (same Docker image, different `SERVICE_MODE`), PostgreSQL, Redis.

## Architecture
- **Backend**: Node 22, TypeScript, Fastify, Drizzle ORM
- **Frontend**: Flutter 3.38+ (web), Riverpod state management
- **Infra**: AWS ECS Fargate, RDS PostgreSQL 16, ElastiCache Redis 7.1, ALB
- **Frontend hosting**: Cloudflare Pages (not CloudFront)
- **CI/CD**: GitHub Actions (deploy-backend, deploy-frontend, ci, terraform)

## Key Commands
```bash
# Backend
npm install          # Install deps
npm run build        # TypeScript compile
npm test             # Vitest tests
npm run typecheck    # tsc --noEmit

# Flutter
cd mobile_app && flutter pub get && flutter run -d chrome --web-port=8080

# Docker
docker build -t app .   # Uses Node 22 Alpine multi-stage

# Terraform
cd infrastructure/aws && terraform plan -var-file=terraform.tfvars
```

## Service Modes
Set via `SERVICE_MODE` env var: `api`, `data-ingestion`, `signal-worker`, `executor`, `supervisor`

## Important Files
- `src/core/config.ts` — All env var definitions
- `src/api/server.ts` — Fastify setup, CORS, auth middleware, route registration
- `src/data/llm.ts` — LLM integration (OpenRouter default, SageMaker optional)
- `infrastructure/aws/` — Terraform IaC (8 modules)
- `.github/workflows/` — CI/CD pipelines

## Conventions
- ECR tags: `sha-XXXXXXX` (immutable, no :latest)
- DATABASE_URL must include `?sslmode=no-verify` for RDS
- package-lock.json: regenerate in Node 22 container when deps change
- Auth is bypassed in staging (all routes public). Re-enable when adapter ready.
- LLM: OpenRouter by default. Set `USE_SAGEMAKER_INFERENCE=true` for SageMaker.

## Environments
| | Staging | Production |
|--|---------|-----------|
| AWS Account | 876610982379 | Same |
| ECS Cluster | coindcx-staging | coindcx-production |
| Frontend | staging.coindcx-trading-agent.pages.dev | production.coindcx-trading-agent.pages.dev |
| Node env | staging | production |
| Auth | Bypassed | Enabled |

## GitHub
- Org: coindcx-agent
- Repo: coindcx-agent/coindcx-trading-agent (private)
- Origin remote: kushagra93/coindcx-trading-agent (feature branches)
- Deploy remote: coindcx-agent/coindcx-trading-agent (main)
