variable "environment" {
  type = string
}

variable "project_name" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "sg_redis_id" {
  type = string
}
