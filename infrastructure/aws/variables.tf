variable "environment" {
  type        = string
  description = "Environment: staging or production"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Must be staging or production."
  }
}

variable "aws_region" {
  type        = string
  default     = "ap-south-1"
  description = "AWS region for all resources"
}

variable "project_name" {
  type        = string
  default     = "coindcx-trading-agent"
  description = "Project name used for resource naming"
}

variable "domain_name" {
  type        = string
  default     = ""
  description = "Optional custom domain for ACM certificate (e.g. api.example.com)"
}

variable "frontend_hosting" {
  type        = string
  default     = "cloudflare"
  description = "Frontend hosting: cloudflare or cloudfront"
  validation {
    condition     = contains(["cloudflare", "cloudfront"], var.frontend_hosting)
    error_message = "Must be cloudflare or cloudfront."
  }
}
