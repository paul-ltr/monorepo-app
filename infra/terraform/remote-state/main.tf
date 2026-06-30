# Bootstrap for the Terraform remote state backend: a versioned, encrypted S3
# bucket + a DynamoDB lock table. Chicken-and-egg: this config uses a LOCAL
# backend (its own state lives on disk / in git-ignored .tfstate) because the
# remote backend doesn't exist yet. Run this ONCE per account+region, then the
# env roots use the S3 backend it creates.

terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # Intentionally a local backend — see the module header.
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { project = "pilotage", repo = "app", module = "remote-state" }
  }
}

variable "region" {
  type    = string
  default = "eu-west-3"
}

variable "state_bucket" {
  type    = string
  default = "pilotage-tfstate"
}

variable "lock_table" {
  type    = string
  default = "pilotage-tflock"
}

resource "aws_s3_bucket" "state" {
  bucket = var.state_bucket
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "aws:kms" }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "lock" {
  name         = var.lock_table
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }
}

output "state_bucket" {
  value = aws_s3_bucket.state.bucket
}
output "lock_table" {
  value = aws_dynamodb_table.lock.name
}
