# Deployment Guide

## Prerequisites

- AWS CLI v2 configured with admin credentials
- Terraform >= 1.0
- Docker
- Flutter SDK (for frontend)
- `jq` (for secrets script)

## 1. Initial Infrastructure Setup

```bash
cd infrastructure/aws

# Copy and fill in variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Init and apply
terraform init
terraform validate
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

Save the outputs — you'll need them:

```bash
terraform output
```

Key outputs:
- `ecr_repository_url` — Docker image registry
- `alb_dns_name` — Backend API endpoint
- `cloudfront_url` — Frontend URL
- `secrets_arn` — Secrets Manager ARN
- `frontend_bucket` — S3 bucket for Flutter web
- `cloudfront_distribution_id` — For cache invalidation

## 2. Populate API Keys

Terraform creates the secret with `DATABASE_URL`, `REDIS_URL`, and `GATEWAY_JWT_SECRET` auto-populated. All external API keys are set to `PLACEHOLDER` and must be filled in:

```bash
# Interactive prompt for each key
./scripts/populate-secrets.sh staging
```

Or manually via AWS CLI:

```bash
aws secretsmanager get-secret-value \
  --secret-id "coindcx/staging/app-secrets" \
  --query SecretString --output text | jq .

# Update a single key
aws secretsmanager get-secret-value \
  --secret-id "coindcx/staging/app-secrets" \
  --query SecretString --output text \
  | jq '.ANTHROPIC_API_KEY = "sk-ant-..."' \
  | aws secretsmanager put-secret-value \
      --secret-id "coindcx/staging/app-secrets" \
      --secret-string file:///dev/stdin
```

### Required Secrets

| Key | Source | Required For |
|-----|--------|-------------|
| `SOLANA_RPC_URL` | Helius / QuickNode | Solana trading |
| `SOLANA_WS_URL` | Helius / QuickNode | Solana WebSocket |
| `HELIUS_API_KEY` | helius.dev | Token metadata |
| `EVM_RPC_URL` | Alchemy / Infura | EVM trading |
| `EVM_WS_URL` | Alchemy / Infura | EVM WebSocket |
| `ALCHEMY_API_KEY` | alchemy.com | EVM provider |
| `ONEINCH_API_KEY` | 1inch.dev | DEX aggregator |
| `ZEROX_API_KEY` | 0x.org | DEX aggregator |
| `COINGECKO_API_KEY` | coingecko.com | Market data |
| `ANTHROPIC_API_KEY` | console.anthropic.com | AI chat |
| `COINDCX_API_KEY` | CoinDCX | Host app adapter |

## 3. Build & Push Docker Image

```bash
# Get ECR login
ECR_URL=$(terraform -chdir=infrastructure/aws output -raw ecr_repository_url)
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin "$ECR_URL"

# Build and push (tag with git SHA)
IMAGE_TAG="sha-$(git rev-parse --short HEAD)"
docker build -t "$ECR_URL:$IMAGE_TAG" -t "$ECR_URL:latest" .
docker push "$ECR_URL:$IMAGE_TAG"
docker push "$ECR_URL:latest"
```

## 4. Run Database Migrations

```bash
./infrastructure/aws/scripts/run-migration.sh staging
```

Or via ECS Exec (interactive):

```bash
CLUSTER="coindcx-staging"
TASK_ID=$(aws ecs list-tasks --cluster $CLUSTER --service-name api --query 'taskArns[0]' --output text | awk -F/ '{print $NF}')
aws ecs execute-command --cluster $CLUSTER --task $TASK_ID --container api --interactive --command "/bin/sh"
# Then: node dist/index.js --migrate
```

## 5. Force Deploy ECS Services

After pushing a new image, update all services:

```bash
CLUSTER="coindcx-staging"
for svc in api data-ingestion signal-worker executor supervisor; do
  aws ecs update-service --cluster $CLUSTER --service $svc --force-new-deployment
done
```

## 6. Deploy Flutter Frontend

```bash
# Get outputs
API_URL=$(terraform -chdir=infrastructure/aws output -raw alb_dns_name)
BUCKET=$(terraform -chdir=infrastructure/aws output -raw frontend_bucket)
CF_ID=$(terraform -chdir=infrastructure/aws output -raw cloudfront_distribution_id)

# Build
cd mobile_app
flutter build web --release --dart-define=API_BASE_URL=http://$API_URL

# Deploy
aws s3 sync build/web/ "s3://$BUCKET/" --delete
aws cloudfront create-invalidation --distribution-id "$CF_ID" --paths "/*"
```

## 7. Verify

```bash
ALB=$(terraform -chdir=infrastructure/aws output -raw alb_dns_name)

curl -s "http://$ALB/health" | jq .
curl -s "http://$ALB/ready" | jq .

# Check all 5 services are running
aws ecs describe-services \
  --cluster coindcx-staging \
  --services api data-ingestion signal-worker executor supervisor \
  --query 'services[].{name:serviceName,running:runningCount,desired:desiredCount,status:status}' \
  --output table
```

## CI/CD Setup (GitHub Actions)

### 1. Enable OIDC

Set `github_org` and `github_repo` in your `terraform.tfvars`:

```hcl
github_org  = "your-org"
github_repo = "coindcx-trading-agent"
```

Run `terraform apply` — this creates the OIDC provider and deploy role.

### 2. Create GitHub Environments

Create two environments in GitHub repo settings: **staging** and **production**.

For production, enable "Required reviewers" for manual approval before deploy.

### 3. Set GitHub Secrets

Per environment (Settings > Environments > staging/production > Environment secrets):

| Secret | Value | Source |
|--------|-------|--------|
| `AWS_DEPLOY_ROLE_ARN` | IAM role ARN | `terraform output github_actions_role_arn` |
| `API_BASE_URL` | `http://<alb_dns>` or `https://api.yourdomain.com` | `terraform output alb_dns_name` |
| `FRONTEND_BUCKET` | S3 bucket name | `terraform output frontend_bucket` |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront dist ID | `terraform output cloudfront_distribution_id` |

### 4. How It Works

Three workflows:

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `deploy-backend.yml` | Push to `main` (src/Dockerfile changes) | Build Docker → push ECR → update all 5 ECS services |
| `deploy-frontend.yml` | Push to `main` (mobile_app changes) | Build Flutter web → sync S3 → invalidate CloudFront |
| `terraform.yml` | PR (infra changes) or manual | Plan on PR, apply on manual dispatch |

Manual deploys: use **Actions > Run workflow** and select the environment.

### 5. Production Deploys

For production, use `workflow_dispatch`:
1. Go to Actions > Deploy Backend > Run workflow
2. Select **production** environment
3. Approve the deployment (if required reviewers enabled)

## Environment Variables Reference

### Injected as plain env vars (in task definition)

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `staging` / `production` | Matches environment |
| `SERVICE_MODE` | Per service | `api`, `data-ingestion`, etc. |
| `LOG_LEVEL` | `info` | |
| `DRY_RUN` | `false` | |
| `DB_MAX_CONNECTIONS` | `200` | |
| `PORT` | `3000` (api) / `3001` (supervisor) | |
| `JUPITER_API_URL` | `https://quote-api.jup.ag/v6` | |
| `DEFAULT_EVM_CHAIN_ID` | `137` | Polygon |
| `HYPERLIQUID_MAINNET` | `true` | |
| `HOST_APP_ADAPTER` | `generic` | |

### Injected from Secrets Manager

All keys in `coindcx/<env>/app-secrets` — see table in section 2.

## Troubleshooting

### Services won't start
```bash
# Check service events
aws ecs describe-services --cluster coindcx-staging --services api \
  --query 'services[0].events[:5]'

# Check task logs
aws logs tail /ecs/coindcx-trading-agent-staging/api --since 30m
```

### ECS Exec into running container
```bash
TASK_ID=$(aws ecs list-tasks --cluster coindcx-staging --service-name api \
  --query 'taskArns[0]' --output text | awk -F/ '{print $NF}')
aws ecs execute-command --cluster coindcx-staging --task $TASK_ID \
  --container api --interactive --command /bin/sh
```

### Secret not found errors
ECS tasks pull secrets at startup. After updating secrets, force a new deployment:
```bash
aws ecs update-service --cluster coindcx-staging --service api --force-new-deployment
```
