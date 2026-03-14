# GitHub Actions OIDC provider + IAM role for CI/CD deployments.
# This allows GitHub Actions to assume an AWS role without long-lived credentials.
#
# After applying, set the role ARN as a GitHub Actions secret:
#   AWS_DEPLOY_ROLE_ARN = <output.github_actions_role_arn>

variable "github_org" {
  type        = string
  default     = ""
  description = "GitHub org/user name. Leave empty to skip OIDC setup."
}

variable "github_repo" {
  type        = string
  default     = ""
  description = "GitHub repository name (without org). Leave empty to skip OIDC setup."
}

# --- OIDC Provider ---
resource "aws_iam_openid_connect_provider" "github" {
  count = var.github_org != "" ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = { Name = "github-actions-oidc" }
}

# --- Deploy Role ---
data "aws_iam_policy_document" "github_assume" {
  count = var.github_org != "" ? 1 : 0

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github[0].arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main",
        "repo:${var.github_org}/${var.github_repo}:environment:staging",
        "repo:${var.github_org}/${var.github_repo}:environment:production",
      ]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  count = var.github_org != "" ? 1 : 0

  name               = "${var.project_name}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_assume[0].json

  tags = { Name = "${var.project_name}-github-deploy" }
}

data "aws_iam_policy_document" "github_deploy" {
  count = var.github_org != "" ? 1 : 0

  # ECR
  statement {
    actions = [
      "ecr:GetAuthorizationToken",
    ]
    resources = ["*"]
  }

  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
    ]
    resources = [module.ecr.repository_arn]
  }

  # ECS
  statement {
    actions = [
      "ecs:DescribeServices",
      "ecs:UpdateService",
      "ecs:DescribeTaskDefinition",
      "ecs:RegisterTaskDefinition",
      "ecs:RunTask",
      "ecs:DescribeTasks",
    ]
    resources = ["*"]
  }

  statement {
    actions = ["iam:PassRole"]
    resources = [
      "arn:aws:iam::*:role/${var.project_name}-*-ecs-execution",
      "arn:aws:iam::*:role/${var.project_name}-*-ecs-task",
    ]
  }

  # S3 (frontend — only relevant when using CloudFront hosting)
  dynamic "statement" {
    for_each = var.frontend_hosting == "cloudfront" ? [1] : []
    content {
      actions = [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
      ]
      resources = [
        module.s3_cloudfront[0].s3_bucket_arn,
        "${module.s3_cloudfront[0].s3_bucket_arn}/*",
      ]
    }
  }

  # CloudFront
  dynamic "statement" {
    for_each = var.frontend_hosting == "cloudfront" ? [1] : []
    content {
      actions   = ["cloudfront:CreateInvalidation"]
      resources = ["*"]
    }
  }

  # Terraform state (if using S3 backend)
  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:ListBucket",
    ]
    resources = ["arn:aws:s3:::${var.project_name}-terraform-state*"]
  }

  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
    ]
    resources = ["arn:aws:dynamodb:*:*:table/${var.project_name}-terraform-lock"]
  }

  # Secrets Manager (read-only for deploy, populate-secrets is manual)
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [module.secrets.secret_arn]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  count = var.github_org != "" ? 1 : 0

  name   = "deploy-permissions"
  role   = aws_iam_role.github_deploy[0].id
  policy = data.aws_iam_policy_document.github_deploy[0].json
}

output "github_actions_role_arn" {
  value = var.github_org != "" ? aws_iam_role.github_deploy[0].arn : ""
}
