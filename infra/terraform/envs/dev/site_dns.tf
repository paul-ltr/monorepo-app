# DNS + TLS for the marketing site (apex lavopilot.com + www).
#
# Mirrors dns.tf (the web console). Reuses the same Route 53 hosted zone
# (aws_route53_zone.primary) created there. The apex and www both point at the
# `site` CloudFront distribution. CloudFront requires the ACM cert in us-east-1.

resource "aws_acm_certificate" "site" {
  provider                  = aws.us_east_1
  domain_name               = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
  validation_method         = "DNS"
  tags                      = local.tags
  lifecycle { create_before_destroy = true }
}

resource "aws_route53_record" "site_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.site.domain_validation_options : dvo.domain_name => {
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

resource "aws_acm_certificate_validation" "site" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = [for r in aws_route53_record.site_cert_validation : r.fqdn]
}

# apex lavopilot.com -> site CloudFront distribution.
resource "aws_route53_record" "site_apex" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = var.domain_name
  type    = "A"
  alias {
    name                   = module.site.distribution_domain
    zone_id                = module.site.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "site_apex_aaaa" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = var.domain_name
  type    = "AAAA"
  alias {
    name                   = module.site.distribution_domain
    zone_id                = module.site.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}

# www.lavopilot.com -> site CloudFront distribution.
resource "aws_route53_record" "site_www" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"
  alias {
    name                   = module.site.distribution_domain
    zone_id                = module.site.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "site_www_aaaa" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "www.${var.domain_name}"
  type    = "AAAA"
  alias {
    name                   = module.site.distribution_domain
    zone_id                = module.site.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}
