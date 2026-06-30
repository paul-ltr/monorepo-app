# Security: project KMS key, provider secret placeholders, WAF (regional for the
# API), a monthly cost budget, and CloudWatch alarms. The actual secret *values*
# are set out-of-band (CLI / console) — Terraform only creates the containers so
# secrets never live in state from a tfvars file.

locals {
  tags = merge(var.tags, { module = "security" })
}

# --- KMS ---------------------------------------------------------------------
resource "aws_kms_key" "main" {
  description             = "pilotage-${var.env} data key"
  deletion_window_in_days = 14
  enable_key_rotation     = true
  tags                    = local.tags
}

resource "aws_kms_alias" "main" {
  name          = "alias/pilotage-${var.env}"
  target_key_id = aws_kms_key.main.key_id
}

# --- Provider secret containers (values set out-of-band) ---------------------
resource "aws_secretsmanager_secret" "provider" {
  for_each    = toset(["mistral", "stripe", "brevo", "webpush"])
  name        = "pilotage/${var.env}/${each.value}"
  description = "Pilotage ${each.value} credentials (${var.env}) — set value via CLI"
  kms_key_id  = aws_kms_key.main.arn
  tags        = local.tags
}

# --- WAFv2 (regional — for API Gateway). CloudFront WAF must be us-east-1 -----
resource "aws_wafv2_web_acl" "regional" {
  name        = "pilotage-${var.env}-regional"
  scope       = "REGIONAL"
  description = "Managed rules for the API"
  default_action { allow {} }

  rule {
    name     = "common"
    priority = 1
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "common"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "rate-limit"
    priority = 2
    action { block {} }
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "pilotage-${var.env}-regional"
    sampled_requests_enabled   = true
  }
  tags = local.tags
}

# --- Budget + cost anomaly ---------------------------------------------------
resource "aws_budgets_budget" "monthly" {
  name         = "pilotage-${var.env}-monthly"
  budget_type  = "COST"
  limit_amount = var.monthly_budget_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  cost_filter {
    name   = "TagKeyValue"
    values = ["user:project$pilotage"]
  }
  dynamic "notification" {
    for_each = var.budget_alert_emails
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = 80
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [notification.value]
    }
  }
}

# --- Alarms (optional — created when the target ids are supplied) -------------
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  count               = var.db_instance_id == null ? 0 : 1
  alarm_name          = "pilotage-${var.env}-rds-cpu"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  dimensions          = { DBInstanceIdentifier = var.db_instance_id }
  alarm_actions       = var.alarm_topic_arn == null ? [] : [var.alarm_topic_arn]
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  count               = var.api_function_name == null ? 0 : 1
  alarm_name          = "pilotage-${var.env}-api-errors"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanThreshold"
  dimensions          = { FunctionName = var.api_function_name }
  alarm_actions       = var.alarm_topic_arn == null ? [] : [var.alarm_topic_arn]
  tags                = local.tags
}
