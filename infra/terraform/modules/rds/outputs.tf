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

# Proxy-shaped secret for the data_rw role (proxy auth + ops password sync).
output "db_data_rw_secret_arn" {
  value = aws_secretsmanager_secret.data_rw.arn
}

output "db_name" {
  value = var.db_name
}
