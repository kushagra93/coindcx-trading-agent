#!/usr/bin/env bash
set -euo pipefail

# Populate API keys in Secrets Manager after terraform apply.
# Usage: ./populate-secrets.sh <environment>
# Example: ./populate-secrets.sh staging

ENV="${1:?Usage: $0 <staging|production>}"
SECRET_ID="coindcx/${ENV}/app-secrets"
REGION="${AWS_REGION:-ap-south-1}"

echo "==> Populating secrets for: ${SECRET_ID}"
echo "    Region: ${REGION}"
echo ""

# Fetch current secret value
CURRENT=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ID" \
  --region "$REGION" \
  --query SecretString \
  --output text)

prompt_secret() {
  local key="$1"
  local current_val
  current_val=$(echo "$CURRENT" | jq -r ".${key} // empty")

  if [[ "$current_val" == "PLACEHOLDER" || -z "$current_val" ]]; then
    echo -n "  ${key} [not set]: "
  else
    echo -n "  ${key} [already set, press enter to keep]: "
  fi

  read -r value
  if [[ -n "$value" ]]; then
    CURRENT=$(echo "$CURRENT" | jq --arg k "$key" --arg v "$value" '.[$k] = $v')
    echo "    -> updated"
  else
    echo "    -> skipped"
  fi
}

echo "==> Enter values for each secret (press enter to skip):"
echo ""

echo "--- Blockchain RPCs ---"
prompt_secret "SOLANA_RPC_URL"
prompt_secret "SOLANA_WS_URL"
prompt_secret "HELIUS_API_KEY"
prompt_secret "EVM_RPC_URL"
prompt_secret "EVM_WS_URL"
prompt_secret "ALCHEMY_API_KEY"

echo ""
echo "--- DEX & Market Data APIs ---"
prompt_secret "ONEINCH_API_KEY"
prompt_secret "ZEROX_API_KEY"
prompt_secret "COINGECKO_API_KEY"

echo ""
echo "--- AI ---"
prompt_secret "ANTHROPIC_API_KEY"

echo ""
echo "--- CoinDCX ---"
prompt_secret "COINDCX_API_KEY"

echo ""
echo "==> Preview (redacted):"
echo "$CURRENT" | jq 'to_entries | map(
  if .value == "PLACEHOLDER" then .
  elif (.value | length) > 8 then .value = .value[:4] + "****" + .value[-4:]
  else .value = "****"
  end
) | from_entries'

echo ""
read -rp "Apply these values? [y/N] " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
  aws secretsmanager put-secret-value \
    --secret-id "$SECRET_ID" \
    --region "$REGION" \
    --secret-string "$CURRENT"
  echo "==> Secrets updated successfully."
  echo ""
  echo "IMPORTANT: Force-restart ECS services to pick up new secrets:"
  echo "  CLUSTER=coindcx-${ENV}"
  echo "  for svc in api data-ingestion signal-worker executor supervisor; do"
  echo "    aws ecs update-service --cluster \$CLUSTER --service \$svc --force-new-deployment"
  echo "  done"
else
  echo "==> Aborted."
fi
