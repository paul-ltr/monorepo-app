# RDS PostgreSQL (shared with the data repo) + RDS Proxy for Lambda pooling.
# Credentials live in Secrets Manager. The schema/role/RLS bootstrap and Drizzle
# migrations run as a CD step (see RUNBOOK + the commented null_resource below),
# not inline, so Terraform stays declarative and migrations stay auditable.

locals {
  tags = merge(var.tags, { module = "rds" })
}

resource "random_password" "db" {
  length  = 32
  special = false
}

# The data repo authenticates as the `data_rw` Postgres role directly through the
# RDS Proxy (unlike the app, which connects as master and `SET ROLE app_rw`). So
# data_rw needs a real, managed password — generated here, published to Secrets
# Manager, and synced onto the DB role via the ops-lambda (see RUNBOOK). special
# = false keeps it URL-safe for the data repo's DATABASE_URL.
resource "random_password" "data_rw" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db" {
  name        = "pilotage/${var.env}/db"
  description = "Pilotage RDS master credentials (${var.env})"
  kms_key_id  = var.kms_key_arn
  tags        = local.tags
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = var.master_username
    password = random_password.db.result
    engine   = "postgres"
    host     = aws_db_instance.this.address
    port     = 5432
    dbname   = var.db_name
    # The data repo reads these two keys from db_secret_arn (its
    # common.db.build_database_url) to connect as data_rw. Master keys stay intact.
    data_rw_username = "data_rw"
    data_rw_password = random_password.data_rw.result
  })
}

# Dedicated, proxy-shaped secret for data_rw. An RDS Proxy auth entry maps exactly
# one {username,password}, so data_rw gets its own secret (the master secret's
# extra data_rw_* keys are for the data repo, not a shape the proxy understands).
resource "aws_secretsmanager_secret" "data_rw" {
  name        = "pilotage/${var.env}/db-data_rw"
  description = "Pilotage RDS data_rw role credentials (${var.env}) — RDS Proxy auth"
  kms_key_id  = var.kms_key_arn
  tags        = local.tags
}

resource "aws_secretsmanager_secret_version" "data_rw" {
  secret_id = aws_secretsmanager_secret.data_rw.id
  secret_string = jsonencode({
    username = "data_rw"
    password = random_password.data_rw.result
    engine   = "postgres"
    host     = aws_db_instance.this.address
    port     = 5432
    dbname   = var.db_name
  })
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-db"
  subnet_ids = var.private_subnet_ids
  tags       = local.tags
}

resource "aws_security_group" "db" {
  name        = "${var.name}-db"
  description = "RDS Postgres - from app/data compute only"
  vpc_id      = var.vpc_id
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = local.tags
}

# Allow Postgres from inside the VPC (app Lambda + data-repo compute attach here).
resource "aws_security_group_rule" "db_in" {
  type              = "ingress"
  security_group_id = aws_security_group.db.id
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  cidr_blocks       = [var.vpc_cidr]
  description       = "Postgres from VPC"
}

resource "aws_db_parameter_group" "this" {
  name   = "${var.name}-pg16"
  family = "postgres16"
  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot" # static param — cannot apply immediately
  }
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }
  tags = local.tags
}

resource "aws_db_instance" "this" {
  identifier     = "${var.name}-pg"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = var.kms_key_arn

  db_name  = var.db_name
  username = var.master_username
  password = random_password.db.result

  multi_az               = var.multi_az
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]
  parameter_group_name   = aws_db_parameter_group.this.name

  backup_retention_period      = var.backup_retention_days
  deletion_protection          = var.deletion_protection
  skip_final_snapshot          = !var.deletion_protection
  final_snapshot_identifier    = var.deletion_protection ? "${var.name}-final" : null
  apply_immediately            = var.env != "prod"
  performance_insights_enabled = true

  tags = local.tags

  # engine_version pins only the major (see variables.tf). AWS applies minor
  # upgrades automatically (auto_minor_version_upgrade defaults on), so ignore
  # post-create drift on the running minor version to avoid a spurious plan.
  lifecycle {
    ignore_changes = [engine_version]
  }
}

# --- RDS Proxy (connection pooling for Lambda) -------------------------------
resource "aws_iam_role" "proxy" {
  name = "${var.name}-rds-proxy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "rds.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "proxy_secret" {
  name = "read-db-secret"
  role = aws_iam_role.proxy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      # Both proxy auth secrets: master (admin/app) + data_rw (data repo).
      Resource = [aws_secretsmanager_secret.db.arn, aws_secretsmanager_secret.data_rw.arn]
      }, {
      Effect   = "Allow"
      Action   = ["kms:Decrypt"]
      Resource = var.kms_key_arn
    }]
  })
}

resource "aws_db_proxy" "this" {
  name                   = "${var.name}-proxy"
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.proxy.arn
  vpc_subnet_ids         = var.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.db.id]
  require_tls            = true
  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.db.arn
  }
  # Second auth entry so the data repo can connect through the proxy as data_rw.
  # RDS Proxy only admits client logins for users whose creds are in a registered
  # auth secret, so without this data_rw cannot reach the DB at all.
  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.data_rw.arn
  }
  tags = local.tags
}

resource "aws_db_proxy_default_target_group" "this" {
  db_proxy_name = aws_db_proxy.this.name
  connection_pool_config {
    max_connections_percent      = 75
    max_idle_connections_percent = 50
  }
}

resource "aws_db_proxy_target" "this" {
  db_proxy_name          = aws_db_proxy.this.name
  target_group_name      = aws_db_proxy_default_target_group.this.name
  db_instance_identifier = aws_db_instance.this.identifier
}

# --- Bootstrap placeholder (intentionally NOT applied inline) ----------------
# The role/extension/RLS bootstrap (packages/db/sql/bootstrap.sql) and Drizzle
# migrations run as a gated CD step against the proxy endpoint with the migration
# role — NOT here. Doing DDL in Terraform couples schema to infra state and makes
# rollbacks dangerous on a shared instance. The CD step is documented in
# docs/RUNBOOK.md. A local-exec hook would look like:
#
# resource "null_resource" "bootstrap" {
#   triggers = { instance = aws_db_instance.this.id }
#   provisioner "local-exec" {
#     command = "DATABASE_URL=... pnpm --filter @pilotage/db migrate"
#   }
#   depends_on = [aws_db_proxy_target.this]
# }
