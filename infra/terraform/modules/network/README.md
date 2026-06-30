# network module

VPC across 2 AZs with public/private subnets, IGW, and VPC endpoints (S3
gateway + interface endpoints for Secrets Manager, ECR api/dkr, CloudWatch
Logs) so AWS-API traffic stays off the egress path.

## NAT trade-off (`use_managed_nat`)

- `false` (**dev default**) → a **fck-nat** t4g.nano Spot instance (~$3–5/mo).
  Single-AZ, no HA; if it dies, egress stops until it's replaced — acceptable
  for dev/MVP. Cheap because the alternative (managed NAT GW) is ~$32/mo + data.
- `true` (**prod**) → a managed **NAT Gateway** (HA per-AZ if extended, here
  single for cost). Pay for reliability.

VPC endpoints mean most traffic (S3, Secrets, ECR, Logs) never touches NAT, so
NAT data cost stays low regardless of mode. See `docs/COSTS.md`.

## Outputs

`vpc_id`, `private_subnet_ids`, `public_subnet_ids`, `vpc_cidr` — consumed by
the rds/api/events modules and re-exported as the cross-repo contract.
