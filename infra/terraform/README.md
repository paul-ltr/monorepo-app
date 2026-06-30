# Infrastructure (Terraform)

This repo **owns the foundation infra** (network, database, auth) that the
companion data/Python repo consumes. Serverless-first, cost-guarded (see
[`../../docs/COSTS.md`](../../docs/COSTS.md)).

```
infra/terraform/
  modules/        network · rds · cognito · security · web · api · events
  remote-state/   S3 state bucket + DynamoDB lock (run once)
  envs/dev|staging|prod/   per-env roots (own backend key + tfvars)
```

## Prerequisites

Terraform ≥ 1.7, AWS creds (locally) or OIDC (CI). Region: **eu-west-3** (Paris,
RGPD). Everything is tagged `project=pilotage`, `repo=app`, `env`, `module`.

## First-time setup

```bash
# 1. Create the remote state backend (once per account+region)
cd infra/terraform/remote-state && terraform init && terraform apply

# 2. Stand up an environment
cd ../envs/dev
terraform init
terraform plan
terraform apply
```

`envs/staging` and `envs/prod` are identical module wiring with their own
`backend.tf` state key and `terraform.tfvars` (prod = managed NAT, Multi-AZ,
larger RDS, deletion protection).

## Deploy order (cross-repo)

**App first, then data.** This stack creates the VPC / RDS / Cognito and exports
the outputs the data repo imports. See [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) §3
and [`../../docs/RUNBOOK.md`](../../docs/RUNBOOK.md).

## Cross-repo contract — output names the data repo imports

From `envs/<env>` (e.g. via `terraform output` or a remote state data source):

| Output | Meaning |
|---|---|
| `vpc_id` | Shared VPC |
| `private_subnet_ids` | Private subnets (DB + compute) |
| `db_security_group_id` | SG the data-repo compute attaches to |
| `db_proxy_endpoint` | RDS Proxy endpoint to connect through |
| `db_secret_arn` | Secrets Manager ARN for DB credentials |
| `data_lake_kms_key_arn` | Shared project KMS key ARN |
| `region` | `eu-west-3` |
| `env` | `dev` \| `staging` \| `prod` |

This repo also exports `web_bucket`, `web_distribution_id`, `api_endpoint`,
`api_function_name`, `cognito_user_pool_id`, `cognito_client_id` for its own CD.

## Notes / TODOs

- **Schema bootstrap + migrations** are a gated CD step (`pnpm db:migrate`
  against `db_proxy_endpoint`), **not** Terraform — see the commented
  `null_resource` in `modules/rds` and the RUNBOOK.
- **ACM/CloudFront**: a custom domain needs an ACM cert + CLOUDFRONT-scoped WAF
  in **us-east-1** (the env root declares an `aws.us_east_1` provider alias).
  Dev uses the default CloudFront cert.
- **API code** is deployed by CI (esbuild bundle of `apps/api/src/lambda.ts` +
  a decorator-metadata plugin); Terraform ignores the function's code.
- Not runnable to `validate` in this dev container (Terraform not installed); the
  CI `terraform` job runs `fmt -check` + `validate` on every PR.
