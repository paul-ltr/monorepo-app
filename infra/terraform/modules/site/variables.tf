variable "name" { type = string }
variable "env" { type = string }
variable "acm_certificate_arn" {
  type    = string
  default = null # must be an ACM cert in us-east-1 for CloudFront
}
variable "web_acl_arn" {
  type    = string
  default = null # a CLOUDFRONT-scoped WAFv2 ACL (us-east-1), optional
}
variable "domain_aliases" {
  type    = list(string)
  default = [] # e.g. ["lavopilot.fr", "www.lavopilot.fr"] once the ACM cert exists
}
variable "tags" {
  type    = map(string)
  default = {}
}
