# --- Networking ---
module "networking" {
  source = "./modules/networking"

  environment  = var.environment
  project_name = var.project_name
  aws_region   = var.aws_region
}

# --- ECR (independent) ---
module "ecr" {
  source = "./modules/ecr"

  project_name = var.project_name
}

# --- RDS ---
module "rds" {
  source = "./modules/rds"

  environment        = var.environment
  project_name       = var.project_name
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  sg_rds_id          = module.networking.sg_rds_id
}

# --- ElastiCache ---
module "elasticache" {
  source = "./modules/elasticache"

  environment        = var.environment
  project_name       = var.project_name
  private_subnet_ids = module.networking.private_subnet_ids
  sg_redis_id        = module.networking.sg_redis_id
}

# --- ALB ---
module "alb" {
  source = "./modules/alb"

  environment       = var.environment
  project_name      = var.project_name
  vpc_id            = module.networking.vpc_id
  public_subnet_ids = module.networking.public_subnet_ids
  sg_alb_id         = module.networking.sg_alb_id
  domain_name       = var.domain_name
}

# --- Secrets ---
module "secrets" {
  source = "./modules/secrets"

  environment  = var.environment
  project_name = var.project_name
  database_url = module.rds.database_url
  redis_url    = module.elasticache.redis_url
}

# --- ECS ---
module "ecs" {
  source = "./modules/ecs"

  environment        = var.environment
  project_name       = var.project_name
  aws_region         = var.aws_region
  private_subnet_ids = module.networking.private_subnet_ids
  sg_ecs_id          = module.networking.sg_ecs_id
  ecr_repository_url = module.ecr.repository_url
  target_group_arn   = module.alb.target_group_arn
  secrets_arn        = module.secrets.secret_arn
}

# --- S3 + CloudFront (only when frontend_hosting = "cloudfront") ---
module "s3_cloudfront" {
  count  = var.frontend_hosting == "cloudfront" ? 1 : 0
  source = "./modules/s3_cloudfront"

  environment  = var.environment
  project_name = var.project_name
  domain_name  = var.domain_name
}
