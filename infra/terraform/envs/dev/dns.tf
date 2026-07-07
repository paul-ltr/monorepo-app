# DNS + TLS for the web console (dev-app.lavopilot.com).
#
# The hosted zone is domain-global but created here for the dev-first bring-up.
# After the first apply, delegate the domain at the registrar (GoDaddy) to the
# `route53_name_servers` output. staging/prod should reference this zone via a
# `data "aws_route53_zone"` lookup rather than recreating it.

resource "aws_route53_zone" "primary" {
  name = var.domain_name
  tags = local.tags
}

# CloudFront requires the ACM cert in us-east-1 (provider alias in providers.tf).
resource "aws_acm_certificate" "web" {
  provider          = aws.us_east_1
  domain_name       = var.web_domain
  validation_method = "DNS"
  tags              = local.tags
  lifecycle { create_before_destroy = true }
}

resource "aws_route53_record" "web_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.web.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }
  zone_id         = aws_route53_zone.primary.zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

# Blocks until the validation records resolve publicly — i.e. until the GoDaddy
# nameserver delegation to Route 53 has propagated.
resource "aws_acm_certificate_validation" "web" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.web.arn
  validation_record_fqdns = [for r in aws_route53_record.web_cert_validation : r.fqdn]
}

# dev-app.lavopilot.com -> web CloudFront distribution.
resource "aws_route53_record" "web" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = var.web_domain
  type    = "A"
  alias {
    name                   = module.web.distribution_domain
    zone_id                = module.web.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "web_aaaa" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = var.web_domain
  type    = "AAAA"
  alias {
    name                   = module.web.distribution_domain
    zone_id                = module.web.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}
