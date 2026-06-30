# remote-state bootstrap

Creates the S3 bucket (versioned, KMS-encrypted, public-access-blocked) and the
DynamoDB lock table that the per-env roots use as their Terraform backend.

**Chicken-and-egg:** this config uses a **local backend** (its state is a local
`terraform.tfstate`) because the remote backend doesn't exist until this runs.
Run it once per account+region:

```bash
cd infra/terraform/remote-state
terraform init
terraform apply           # creates pilotage-tfstate + pilotage-tflock
```

Then commit nothing secret; the env roots reference the bucket/table by name in
their `backend.tf`. To recreate in a new account, change `state_bucket` /
`lock_table` (bucket names are globally unique).
