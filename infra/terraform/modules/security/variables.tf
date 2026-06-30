variable "env" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "monthly_budget_usd" {
  type    = string
  default = "100"
}
variable "budget_alert_emails" {
  type    = list(string)
  default = []
}
variable "db_instance_id" {
  type    = string
  default = null
}
variable "api_function_name" {
  type    = string
  default = null
}
variable "alarm_topic_arn" {
  type    = string
  default = null
}
