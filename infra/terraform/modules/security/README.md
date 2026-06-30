# security module

Project KMS key (rotation on), provider secret *containers*
(`pilotage/<env>/{mistral,stripe,brevo,webpush}` — values set out-of-band so
secrets never enter Terraform state), a regional WAFv2 ACL (AWS managed common
rules + IP rate-limit) for the API, an AWS monthly Budget with email alerts, and
optional CloudWatch alarms (RDS CPU, Lambda errors) wired when target ids are
passed in.

> CloudFront WAF must be created with scope `CLOUDFRONT` in **us-east-1**; the
> `web` module documents that provider-alias requirement. This module's WAF is
> `REGIONAL` for API Gateway.

Outputs: `kms_key_arn` (consumed by rds), `regional_web_acl_arn` (consumed by
api), `provider_secret_arns`.
