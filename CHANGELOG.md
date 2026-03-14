# Changelog

## 2026-03-14

### Infrastructure & Deployment
- **AWS Terraform IaC**: 8 modules (networking, ecr, rds, elasticache, alb, ecs, s3_cloudfront, secrets) with environment-driven scaling (staging/production)
- **Staging deployed**: All 5 ECS services running on Fargate Spot, RDS PostgreSQL 16, ElastiCache Redis 7.1, ALB
- **Cloudflare Pages**: Frontend hosting switched from CloudFront (account verification blocked) to Cloudflare Pages with `frontend_hosting` flag
- **GitHub org**: coindcx-agent created, private repo, staging + production environments
- **CI/CD**: 3 workflows — deploy-backend (Docker→ECR→ECS), deploy-frontend (Flutter→Cloudflare Pages), CI (lint, typecheck, test, build)
- **GitHub OIDC**: Keyless AWS deployments via IAM role

### Backend
- **Merged live-data-integration**: Real on-chain Jupiter swaps, live copy trade engine, prompt security guard
- **Merged feature-main**: SageMaker ML module, test coverage, data export pipeline
- **LLM setup**: OpenRouter with gpt-5-mini (default), SageMaker toggle via `USE_SAGEMAKER_INFERENCE`
- **Secrets**: 20 keys in Secrets Manager — Solana wallet generated, OpenRouter, Birdeye, Helius, Alchemy configured
- **DB migrations**: Schema pushed via ECS run-task (16 tables, 27 indexes)
- **Auth bypass**: All routes public in staging for demo
- **CORS**: Open for staging, Cloudflare Pages URLs added to production allow-list

### Frontend (Flutter)
- **UI/UX overhaul** across 5 screens:
  - Discovery: shimmer loading, rank badges on hot cards, gradient borders, green/red indicator bars, search glow effect
  - Portfolio: gradient hero card, frosted P&L breakdown, grouped transactions with status badges
  - Leaderboard: gold/silver/bronze top-3 badges, segmented controls, green pills for high performers
  - Settings: section headers with tinted icons, glowing agent dot, risk buttons with icons
  - Strategies: wider template cards, solid CTA buttons, risk/return badges
- **Configurable API URL**: `--dart-define=API_BASE_URL=...` replaces hardcoded localhost
- **Onboarding fix**: Infinite width crash on web resolved
- **Skip onboarding**: Default to main app for demo

### Fixes
- ECR immutable tags: removed :latest from deploy workflow
- RDS SSL: `sslmode=no-verify` for AWS RDS cert compatibility
- TypeScript build errors from merge (ChatCard type, TradeRecord status)
- CI rollup bindings: explicit `@rollup/rollup-linux-x64-gnu` install
- Flutter version: 3.27→3.38 for Dart SDK 3.8.1 compatibility
- package-lock.json: regenerated in Node 22 container
