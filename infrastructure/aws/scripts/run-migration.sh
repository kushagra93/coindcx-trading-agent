#!/usr/bin/env bash
set -euo pipefail

# Run database migrations via ECS run-task.
# Usage: ./run-migration.sh <environment>

ENV="${1:?Usage: $0 <staging|production>}"
REGION="${AWS_REGION:-ap-south-1}"
CLUSTER="coindcx-${ENV}"
TASK_FAMILY="coindcx-trading-agent-${ENV}-api"

echo "==> Running migration on cluster: ${CLUSTER}"

# Get the latest task definition ARN
TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition "$TASK_FAMILY" \
  --region "$REGION" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

# Get network configuration from the running service
NETWORK_CONFIG=$(aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services api \
  --region "$REGION" \
  --query 'services[0].networkConfiguration' \
  --output json)

echo "==> Using task definition: ${TASK_DEF}"
echo "==> Starting migration task..."

TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$TASK_DEF" \
  --region "$REGION" \
  --launch-type FARGATE \
  --network-configuration "$NETWORK_CONFIG" \
  --overrides '{
    "containerOverrides": [{
      "name": "api",
      "command": ["node", "dist/index.js", "--migrate"]
    }]
  }' \
  --query 'tasks[0].taskArn' \
  --output text)

echo "==> Migration task started: ${TASK_ARN}"
echo "==> Waiting for task to complete..."

aws ecs wait tasks-stopped \
  --cluster "$CLUSTER" \
  --tasks "$TASK_ARN" \
  --region "$REGION"

EXIT_CODE=$(aws ecs describe-tasks \
  --cluster "$CLUSTER" \
  --tasks "$TASK_ARN" \
  --region "$REGION" \
  --query 'tasks[0].containers[0].exitCode' \
  --output text)

if [[ "$EXIT_CODE" == "0" ]]; then
  echo "==> Migration completed successfully."
else
  echo "==> Migration FAILED with exit code: ${EXIT_CODE}"
  echo "==> Check CloudWatch logs: /ecs/coindcx-trading-agent-${ENV}/api"
  exit 1
fi
