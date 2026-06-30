output "db_endpoint" {
  value = aws_db_instance.this.address
}

output "db_proxy_endpoint" {
  value = aws_db_proxy.this.endpoint
}

output "db_security_group_id" {
  value = aws_security_group.db.id
}

output "db_secret_arn" {
  value = aws_secretsmanager_secret.db.arn
}

output "db_name" {
  value = var.db_name
}
