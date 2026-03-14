resource "random_password" "redis" {
  length  = 64
  special = false
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}"
  subnet_ids = var.private_subnet_ids
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.project_name}-${var.environment}"
  description          = "${var.project_name} ${var.environment} Redis"

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.environment == "production" ? "cache.t4g.small" : "cache.t4g.micro"
  parameter_group_name = "default.redis7"

  num_cache_clusters   = var.environment == "production" ? 2 : 1
  automatic_failover_enabled = var.environment == "production"
  multi_az_enabled           = var.environment == "production"

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [var.sg_redis_id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis.result

  snapshot_retention_limit = var.environment == "production" ? 3 : 0

  port = 6379

  tags = { Name = "${var.project_name}-${var.environment}" }
}
