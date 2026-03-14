locals {
  services = {
    api = {
      service_mode       = "api"
      cpu                = var.environment == "production" ? 512 : 256
      memory             = var.environment == "production" ? 1024 : 512
      desired_count      = var.environment == "production" ? 2 : 1
      capacity_provider  = var.environment == "production" ? "FARGATE" : "FARGATE_SPOT"
      port               = 3000
      attach_lb          = true
      min_capacity       = var.environment == "production" ? 2 : 1
      max_capacity       = var.environment == "production" ? 4 : 2
    }
    data-ingestion = {
      service_mode       = "data-ingestion"
      cpu                = 256
      memory             = 512
      desired_count      = 1
      capacity_provider  = "FARGATE_SPOT"
      port               = 3000
      attach_lb          = false
      min_capacity       = 1
      max_capacity       = 2
    }
    signal-worker = {
      service_mode       = "signal-worker"
      cpu                = 256
      memory             = 512
      desired_count      = 1
      capacity_provider  = "FARGATE_SPOT"
      port               = 3000
      attach_lb          = false
      min_capacity       = 1
      max_capacity       = 2
    }
    executor = {
      service_mode       = "executor"
      cpu                = var.environment == "production" ? 512 : 256
      memory             = var.environment == "production" ? 1024 : 512
      desired_count      = 1
      capacity_provider  = var.environment == "production" ? "FARGATE" : "FARGATE_SPOT"
      port               = 3000
      attach_lb          = false
      min_capacity       = 1
      max_capacity       = var.environment == "production" ? 3 : 2
    }
    supervisor = {
      service_mode       = "supervisor"
      cpu                = 256
      memory             = 512
      desired_count      = 1
      capacity_provider  = var.environment == "production" ? "FARGATE" : "FARGATE_SPOT"
      port               = 3001
      attach_lb          = false
      min_capacity       = 1
      max_capacity       = 2
    }
  }

  log_retention = var.environment == "production" ? 30 : 7
}

# --- ECS Cluster ---
resource "aws_ecs_cluster" "main" {
  name = "coindcx-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "coindcx-${var.environment}" }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = var.environment == "production" ? "FARGATE" : "FARGATE_SPOT"
    weight            = 1
  }
}

# --- IAM: Execution Role ---
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${var.project_name}-${var.environment}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution_base" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_extra" {
  statement {
    actions = [
      "secretsmanager:GetSecretValue",
    ]
    resources = [var.secrets_arn]
  }

  statement {
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "execution_extra" {
  name   = "secrets-and-logs"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_extra.json
}

# --- IAM: Task Role ---
resource "aws_iam_role" "task" {
  name               = "${var.project_name}-${var.environment}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

data "aws_iam_policy_document" "task" {
  statement {
    actions = [
      "secretsmanager:GetSecretValue",
    ]
    resources = [var.secrets_arn]
  }

  statement {
    actions = [
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:GenerateDataKey",
    ]
    resources = ["*"]
  }

  # ECS Exec support
  statement {
    actions = [
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "task" {
  name   = "task-permissions"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task.json
}

# --- CloudWatch Log Groups ---
resource "aws_cloudwatch_log_group" "services" {
  for_each          = local.services
  name              = "/ecs/${var.project_name}-${var.environment}/${each.key}"
  retention_in_days = local.log_retention

  tags = { Name = "${var.project_name}-${var.environment}-${each.key}" }
}

# --- Task Definitions ---
resource "aws_ecs_task_definition" "services" {
  for_each = local.services

  family                   = "${var.project_name}-${var.environment}-${each.key}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = each.key
      image     = "${var.ecr_repository_url}:latest"
      essential = true

      portMappings = [
        {
          containerPort = each.value.port
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = var.environment == "production" ? "production" : "staging" },
        { name = "SERVICE_MODE", value = each.value.service_mode },
        { name = "LOG_LEVEL", value = "info" },
        { name = "DRY_RUN", value = "false" },
        { name = "DB_MAX_CONNECTIONS", value = "200" },
        { name = "PORT", value = tostring(each.value.port) },
        { name = "JUPITER_API_URL", value = "https://quote-api.jup.ag/v6" },
        { name = "DEFAULT_EVM_CHAIN_ID", value = "137" },
        { name = "HYPERLIQUID_MAINNET", value = "true" },
        { name = "HOST_APP_ADAPTER", value = "generic" },
      ]

      secrets = [
        { name = "DATABASE_URL", valueFrom = "${var.secrets_arn}:DATABASE_URL::" },
        { name = "REDIS_URL", valueFrom = "${var.secrets_arn}:REDIS_URL::" },
        { name = "GATEWAY_JWT_SECRET", valueFrom = "${var.secrets_arn}:GATEWAY_JWT_SECRET::" },
        { name = "SOLANA_RPC_URL", valueFrom = "${var.secrets_arn}:SOLANA_RPC_URL::" },
        { name = "SOLANA_WS_URL", valueFrom = "${var.secrets_arn}:SOLANA_WS_URL::" },
        { name = "HELIUS_API_KEY", valueFrom = "${var.secrets_arn}:HELIUS_API_KEY::" },
        { name = "EVM_RPC_URL", valueFrom = "${var.secrets_arn}:EVM_RPC_URL::" },
        { name = "EVM_WS_URL", valueFrom = "${var.secrets_arn}:EVM_WS_URL::" },
        { name = "ALCHEMY_API_KEY", valueFrom = "${var.secrets_arn}:ALCHEMY_API_KEY::" },
        { name = "ONEINCH_API_KEY", valueFrom = "${var.secrets_arn}:ONEINCH_API_KEY::" },
        { name = "ZEROX_API_KEY", valueFrom = "${var.secrets_arn}:ZEROX_API_KEY::" },
        { name = "COINGECKO_API_KEY", valueFrom = "${var.secrets_arn}:COINGECKO_API_KEY::" },
        { name = "ANTHROPIC_API_KEY", valueFrom = "${var.secrets_arn}:ANTHROPIC_API_KEY::" },
        { name = "COINDCX_API_KEY", valueFrom = "${var.secrets_arn}:COINDCX_API_KEY::" },
        { name = "SOLANA_PRIVATE_KEY", valueFrom = "${var.secrets_arn}:SOLANA_PRIVATE_KEY::" },
        { name = "OPENROUTER_API_KEY", valueFrom = "${var.secrets_arn}:OPENROUTER_API_KEY::" },
        { name = "OPENROUTER_MODEL", valueFrom = "${var.secrets_arn}:OPENROUTER_MODEL::" },
        { name = "OPENROUTER_INTENT_MODEL", valueFrom = "${var.secrets_arn}:OPENROUTER_INTENT_MODEL::" },
        { name = "BIRDEYE_API_KEY", valueFrom = "${var.secrets_arn}:BIRDEYE_API_KEY::" },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.project_name}-${var.environment}/${each.key}"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = { Name = "${var.project_name}-${var.environment}-${each.key}" }
}

# --- ECS Services ---
resource "aws_ecs_service" "services" {
  for_each = local.services

  name            = each.key
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.services[each.key].arn
  desired_count   = each.value.desired_count

  capacity_provider_strategy {
    capacity_provider = each.value.capacity_provider
    weight            = 1
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.sg_ecs_id]
    assign_public_ip = false
  }

  enable_execute_command = true

  dynamic "load_balancer" {
    for_each = each.value.attach_lb ? [1] : []
    content {
      target_group_arn = var.target_group_arn
      container_name   = each.key
      container_port   = each.value.port
    }
  }

  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }

  depends_on = [aws_ecs_task_definition.services]

  tags = { Name = "${var.project_name}-${var.environment}-${each.key}" }
}

# --- Auto Scaling ---
resource "aws_appautoscaling_target" "services" {
  for_each = local.services

  max_capacity       = each.value.max_capacity
  min_capacity       = each.value.min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${each.key}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"

  depends_on = [aws_ecs_service.services]
}

resource "aws_appautoscaling_policy" "cpu" {
  for_each = local.services

  name               = "${each.key}-cpu-tracking"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.services[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.services[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.services[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70
    scale_out_cooldown = 60
    scale_in_cooldown  = 300
  }
}
