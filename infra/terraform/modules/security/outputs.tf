output "kms_key_arn" {
  value = aws_kms_key.main.arn
}
output "regional_web_acl_arn" {
  value = aws_wafv2_web_acl.regional.arn
}
output "provider_secret_arns" {
  value = { for k, s in aws_secretsmanager_secret.provider : k => s.arn }
}
