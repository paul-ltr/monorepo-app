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
variable "tags" {
  type    = map(string)
  default = {}
}
