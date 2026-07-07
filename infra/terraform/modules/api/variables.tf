variable "name" { type = string }
variable "env" { type = string }
variable "region" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "db_proxy_endpoint" { type = string }
variable "db_secret_arn" { type = string }
variable "kms_key_arn" { type = string }
variable "cognito_user_pool_id" { type = string }
variable "cognito_client_id" { type = string }
variable "cors_origins" { type = string }

variable "compute" {
  type    = string
  default = "lambda" # "lambda" | "fargate" (see fargate.tf.disabled)
  validation {
    condition     = contains(["lambda", "fargate"], var.compute)
    error_message = "compute must be lambda or fargate."
  }
}
variable "lambda_zip" {
  type    = string
  default = null # null => generated placeholder bundle (archive_file below); CD ships real code via `aws lambda update-function-code`
}
variable "memory_size" {
  type    = number
  default = 512
}
variable "log_retention_days" {
  type    = number
  default = 14
}
variable "throttle_burst" {
  type    = number
  default = 100
}
variable "throttle_rate" {
  type    = number
  default = 50
}
variable "provider_secret_arns" {
  type    = list(string)
  default = []
}
variable "sqs_queue_arns" {
  type    = list(string)
  default = ["*"]
}
variable "web_acl_arn" {
  type    = string
  default = null
}
variable "tags" {
  type    = map(string)
  default = {}
}
