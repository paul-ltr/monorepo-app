variable "name" { type = string }
variable "kms_key_arn" { type = string }
variable "refresh_schedule" {
  type    = string
  default = "rate(5 minutes)"
}
variable "tags" {
  type    = map(string)
  default = {}
}
