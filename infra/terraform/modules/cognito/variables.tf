variable "env" { type = string }
variable "callback_urls" {
  type    = list(string)
  default = ["http://localhost:5173"]
}
variable "mfa_optional" {
  type    = bool
  default = true
}
variable "hosted_ui_domain" {
  type    = string
  default = null
}
variable "tags" {
  type    = map(string)
  default = {}
}
