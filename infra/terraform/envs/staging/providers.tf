provider "aws" {
  region = var.region
  default_tags {
    tags = {
      project = "pilotage"
      repo    = "app"
      env     = var.env
    }
  }
}

# CloudFront certs (ACM) and CLOUDFRONT-scoped WAF must live in us-east-1.
# Used only when a custom domain is configured (not in dev).
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = {
      project = "pilotage"
      repo    = "app"
      env     = var.env
    }
  }
}
