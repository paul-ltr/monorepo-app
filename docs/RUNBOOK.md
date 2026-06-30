# Runbook — operate & deploy

Operational procedures for the Pilotage app stack. Infra lives in
`infra/terraform` (per-env roots under `envs/`). CI/CD runs through GitHub
Actions with OIDC to AWS (no static keys).

## Deploy order (cross-repo)

**App first, then data.** The app creates the VPC / RDS / Cognito and publishes
the Terraform outputs the data repo imports (`vpc_id`, `private_subnet_ids`,
`db_security_group_id`, `db_proxy_endpoint`, `db_secret_arn`,
`data_lake_kms_key_arn`, `region`, `env`). See `ARCHITECTURE.md` §3.

## First-time bootstrap

```bash
# 1. Remote state (once per account/region)
cd infra/terraform/remote-state && terraform init && terraform apply

# 2. Dev environment
cd ../envs/dev && terraform init && terraform plan && terraform apply
```

## Deploy (per env)

CI does this on merge to `main` (dev auto, staging/prod gated with manual
approval). Manual equivalent:

```bash
# Infra
cd infra/terraform/envs/<env> && terraform apply

# DB: bootstrap (roles/extensions) is run by the rds module; then migrations
DATABASE_URL=<proxy-url> pnpm db:migrate      # bootstrap.sql + drizzle + rls.sql

# Web (static)
pnpm --filter @pilotage/web build
aws s3 sync apps/web/dist s3://<web-bucket> --delete
aws cloudfront create-invalidation --distribution-id <id> --paths '/*'

# API (Lambda)
# CI bundles src/lambda.ts with esbuild (+ a decorator-metadata plugin), zips,
# and updates the function. See .github/workflows.
```

## Rollback

- **Web**: re-sync the previous build artifact (S3 keeps versions) + invalidate.
- **API**: Lambda keeps versions/aliases — shift the alias to the previous
  version (instant). Or re-deploy the prior commit.
- **DB**: migrations are **forward-only**. To undo, write a new compensating
  migration. For a bad data state, restore from the latest RDS snapshot (see
  below) — coordinate with the data repo (shared instance).
- **Infra**: `terraform apply` the previous commit's state, or targeted revert.

## Secrets

Stored in Secrets Manager as `pilotage/<env>/<provider>` (mistral, stripe, brevo,
webpush, gbp) and the DB credential secret (managed by the rds module). Rotate:

```bash
aws secretsmanager put-secret-value --secret-id pilotage/<env>/mistral \
  --secret-string '{"api_key":"<new>"}'
# Lambda reads on cold start; force a refresh by publishing a new version or
# bumping an env var. DB creds rotation is handled by RDS-managed rotation.
```

Never put secrets in the repo, in Terraform vars files, or in CI logs.

## Scale RDS

Parameterized in the `rds` module: `instance_class`, `multi_az`,
`max_allocated_storage`. To scale:

```bash
cd infra/terraform/envs/<env>
# edit terraform.tfvars: instance_class = "db.t4g.medium"  (and multi_az = true)
terraform apply   # apply during a maintenance window; Multi-AZ change is online-ish
```

RDS Proxy absorbs connection churn from Lambda — keep `max` connections modest.

## Switch NAT mode (cost lever)

`network` module var `use_managed_nat`: `false` = fck-nat instance (cheap, dev),
`true` = managed NAT Gateway (prod). Flip in `terraform.tfvars` and apply.

## DB bootstrap + migrations detail

`pnpm db:migrate` runs, in order: `sql/bootstrap.sql` (extensions, `uuidv7()`,
`app_rw`/`data_rw` roles + grants) → Drizzle migrations (`core` tables) →
`sql/rls.sql` (RLS policies + reference views). Idempotent. In AWS this runs as
a gated CD step against the RDS Proxy endpoint, with the migration role (not
`app_rw`).

## Smoke test (post-deploy)

```bash
curl -fsS https://<api-domain>/health          # {"status":"ok","database":"ok"}
curl -fsS https://<api-domain>/me -H "Authorization: Bearer <token>"
# Web: load the CloudFront URL, sign in, dashboard renders with live data.
```

## Common alarms (see `security` module)

- RDS CPU / connections high → scale instance or check a runaway query
  (`pg_stat_statements`).
- Lambda errors / API 5xx → check CloudWatch Logs (retention 14–30d) for the
  request id (problem+json includes `requestId`).
- Cost anomaly → check NAT mode, RDS size, log retention.
