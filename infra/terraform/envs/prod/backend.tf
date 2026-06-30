terraform {
  required_version = ">= 1.7"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
  backend "s3" {
    bucket         = "pilotage-tfstate"
    key            = "envs/prod/terraform.tfstate"
    region         = "eu-west-3"
    dynamodb_table = "pilotage-tflock"
    encrypt        = true
  }
}
