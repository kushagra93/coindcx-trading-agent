# --- Networking ---
output "vpc_id" {
  value = module.networking.vpc_id
}

# --- ECR ---
output "ecr_repository_url" {
  value = module.ecr.repository_url
}

# --- RDS ---
output "rds_endpoint" {
  value = module.rds.endpoint
}

# --- ElastiCache ---
output "redis_endpoint" {
  value = module.elasticache.primary_endpoint
}

# --- ALB ---
output "alb_dns_name" {
  description = "ALB DNS name — point your domain here or use directly"
  value       = module.alb.alb_dns_name
}

# --- ECS ---
output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}

# --- S3 + CloudFront (only when frontend_hosting = "cloudfront") ---
output "frontend_bucket" {
  value = var.frontend_hosting == "cloudfront" ? module.s3_cloudfront[0].s3_bucket_name : ""
}

output "cloudfront_url" {
  description = "CloudFront URL for Flutter web app"
  value       = var.frontend_hosting == "cloudfront" ? "https://${module.s3_cloudfront[0].cloudfront_domain_name}" : ""
}

output "cloudfront_distribution_id" {
  value = var.frontend_hosting == "cloudfront" ? module.s3_cloudfront[0].cloudfront_distribution_id : ""
}

output "frontend_hosting" {
  value = var.frontend_hosting
}

# --- Secrets ---
output "secrets_arn" {
  value = module.secrets.secret_arn
}
