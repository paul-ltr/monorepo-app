locals {
  name = "pilotage-${var.env}"
  tags = { project = "pilotage", repo = "app", env = var.env }
}

# KMS + provider secret containers + WAF + budget come first (KMS feeds others).
module "security" {
  source              = "../../modules/security"
  env                 = var.env
  monthly_budget_usd  = var.monthly_budget_usd
  budget_alert_emails = var.budget_alert_emails
  tags                = local.tags
}

module "network" {
  source          = "../../modules/network"
  name            = local.name
  region          = var.region
  use_managed_nat = var.use_managed_nat
  # t4g.nano was capacity-short in eu-west-3a; use a larger pool in eu-west-3b.
  nat_instance_type = "t4g.small"
  nat_subnet_index  = 1
  tags              = local.tags
}

module "rds" {
  source                = "../../modules/rds"
  name                  = local.name
  env                   = var.env
  vpc_id                = module.network.vpc_id
  vpc_cidr              = module.network.vpc_cidr
  private_subnet_ids    = module.network.private_subnet_ids
  kms_key_arn           = module.security.kms_key_arn
  instance_class        = var.db_instance_class
  multi_az              = var.db_multi_az
  deletion_protection   = var.db_deletion_protection
  backup_retention_days = var.db_backup_retention_days
  tags                  = local.tags
}

module "cognito" {
  source        = "../../modules/cognito"
  env           = var.env
  callback_urls = var.callback_urls
  tags          = local.tags
}

module "events" {
  source      = "../../modules/events"
  name        = local.name
  kms_key_arn = module.security.kms_key_arn
  tags        = local.tags
}

module "web" {
  source              = "../../modules/web"
  name                = local.name
  env                 = var.env
  domain_aliases      = [var.web_domain]
  acm_certificate_arn = aws_acm_certificate_validation.web.certificate_arn
  tags                = local.tags
}

module "site" {
  source = "../../modules/site"
  name   = local.name
  env    = var.env
  tags   = local.tags
}

module "api" {
  source               = "../../modules/api"
  name                 = local.name
  env                  = var.env
  region               = var.region
  vpc_id               = module.network.vpc_id
  private_subnet_ids   = module.network.private_subnet_ids
  db_proxy_endpoint    = module.rds.db_proxy_endpoint
  db_secret_arn        = module.rds.db_secret_arn
  kms_key_arn          = module.security.kms_key_arn
  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id    = module.cognito.user_pool_client_id
  cors_origins         = var.cors_origins
  provider_secret_arns = values(module.security.provider_secret_arns)
  sqs_queue_arns       = values(module.events.queue_arns)
  web_acl_arn          = module.security.regional_web_acl_arn
  # WAFv2 cannot associate with an API Gateway v2 HTTP API (only REST/ALB/
  # CloudFront), so leave it detached. Protect the API via CloudFront WAF later.
  attach_web_acl = false
  tags           = local.tags
}
