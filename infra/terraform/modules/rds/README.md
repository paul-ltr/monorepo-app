# rds module

Amazon RDS for PostgreSQL 16 (shared with the data repo) + RDS Proxy for Lambda
connection pooling. Master credentials are generated and stored in Secrets
Manager (`pilotage/<env>/db`), encrypted with the project KMS key. gp3 storage
with autoscaling cap; `multi_az`, `instance_class`, `max_allocated_storage`,
`backup_retention_days`, `deletion_protection` are parameterized (dev:
small/single-AZ; prod: larger/Multi-AZ/protected).

**Schema bootstrap & migrations are NOT run inline** — they run as a gated CD
step (`pnpm db:migrate` against the proxy endpoint with the migration role). See
the commented `null_resource` in `main.tf` and `docs/RUNBOOK.md` for the
rationale (don't couple shared-DB DDL to infra state).

## Outputs (cross-repo contract)

`db_endpoint`, `db_proxy_endpoint`, `db_security_group_id`, `db_secret_arn`,
`db_name`. The data repo attaches its compute to `db_security_group_id` and
connects via `db_proxy_endpoint` using `db_secret_arn`.
