# Cognito user pool for the operator console. Groups map to the app's system
# roles (fine-grained permissions live in core.user_role / the RBAC catalog).

locals {
  tags   = merge(var.tags, { module = "cognito" })
  groups = ["owner", "manager", "accountant", "technician", "viewer", "network_admin"]
}

resource "aws_cognito_user_pool" "this" {
  name                     = "pilotage-${var.env}"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  mfa_configuration = var.mfa_optional ? "OPTIONAL" : "OFF"
  dynamic "software_token_mfa_configuration" {
    for_each = var.mfa_optional ? [1] : []
    content { enabled = true }
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = local.tags
}

resource "aws_cognito_user_group" "groups" {
  for_each     = toset(local.groups)
  name         = each.value
  user_pool_id = aws_cognito_user_pool.this.id
  description  = "Maps to the ${each.value} app role"
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "pilotage-${var.env}-web"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret               = false # public SPA client → PKCE
  explicit_auth_flows           = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  supported_identity_providers  = ["COGNITO"]
  callback_urls                 = var.callback_urls
  logout_urls                   = var.callback_urls
  allowed_oauth_flows           = ["code"]
  allowed_oauth_scopes          = ["openid", "email", "profile"]
  allowed_oauth_flows_user_pool_client = true

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

resource "aws_cognito_user_pool_domain" "this" {
  count        = var.hosted_ui_domain == null ? 0 : 1
  domain       = var.hosted_ui_domain
  user_pool_id = aws_cognito_user_pool.this.id
}
