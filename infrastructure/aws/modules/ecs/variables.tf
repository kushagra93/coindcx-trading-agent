variable "environment" {
  type = string
}

variable "project_name" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "sg_ecs_id" {
  type = string
}

variable "ecr_repository_url" {
  type = string
}

variable "target_group_arn" {
  type = string
}

variable "secrets_arn" {
  type = string
}
