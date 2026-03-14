resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name = "coindcx/${var.environment}/app-secrets"

  tags = { Name = "${var.project_name}-${var.environment}-app-secrets" }
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id

  secret_string = jsonencode({
    DATABASE_URL       = var.database_url
    REDIS_URL          = var.redis_url
    GATEWAY_JWT_SECRET = random_password.jwt_secret.result

    # Operator must populate these after apply
    SOLANA_RPC_URL   = "PLACEHOLDER"
    SOLANA_WS_URL    = "PLACEHOLDER"
    HELIUS_API_KEY   = "PLACEHOLDER"
    EVM_RPC_URL      = "PLACEHOLDER"
    EVM_WS_URL       = "PLACEHOLDER"
    ALCHEMY_API_KEY  = "PLACEHOLDER"
    ONEINCH_API_KEY  = "PLACEHOLDER"
    ZEROX_API_KEY    = "PLACEHOLDER"
    COINGECKO_API_KEY = "PLACEHOLDER"
    ANTHROPIC_API_KEY = "PLACEHOLDER"
    COINDCX_API_KEY  = "PLACEHOLDER"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
