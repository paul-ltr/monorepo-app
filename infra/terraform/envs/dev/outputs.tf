# --- Cross-repo contract (the data repo imports these by name) --------------
output "vpc_id" { value = module.network.vpc_id }
output "private_subnet_ids" { value = module.network.private_subnet_ids }
output "db_security_group_id" { value = module.rds.db_security_group_id }
output "db_proxy_endpoint" { value = module.rds.db_proxy_endpoint }
output "db_secret_arn" { value = module.rds.db_secret_arn }
output "data_lake_kms_key_arn" { value = module.security.kms_key_arn }
output "region" { value = var.region }
output "env" { value = var.env }

# --- Convenience (this repo's own deploy) -----------------------------------
output "web_bucket" { value = module.web.bucket }
output "web_distribution_id" { value = module.web.distribution_id }
output "web_distribution_domain" { value = module.web.distribution_domain }
output "api_endpoint" { value = module.api.api_endpoint }
output "api_function_name" { value = module.api.function_name }
output "cognito_user_pool_id" { value = module.cognito.user_pool_id }
output "cognito_client_id" { value = module.cognito.user_pool_client_id }
