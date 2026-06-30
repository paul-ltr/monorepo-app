variable "env" {
  type    = string
  default = "dev"
}
variable "region" {
  type    = string
  default = "eu-west-3"
}
variable "use_managed_nat" {
  type    = bool
  default = false # dev: fck-nat
}
variable "db_instance_class" {
  type    = string
  default = "db.t4g.small"
}
variable "db_multi_az" {
  type    = bool
  default = false
}
variable "db_deletion_protection" {
  type    = bool
  default = false
}
variable "db_backup_retention_days" {
  type    = number
  default = 7
}
variable "callback_urls" {
  type    = list(string)
  default = ["http://localhost:5173"]
}
variable "cors_origins" {
  type    = string
  default = "http://localhost:5173"
}
variable "monthly_budget_usd" {
  type    = string
  default = "100"
}
variable "budget_alert_emails" {
  type    = list(string)
  default = []
}
