# web module

Private S3 bucket (versioned, fully public-access-blocked) fronted by CloudFront
with Origin Access Control. SPA routing: 403/404 → `/index.html`. Managed
CachingOptimized cache policy, compression, PriceClass_100 (EU/NA edges, cost).

**ACM/us-east-1 note:** a custom-domain CloudFront cert must live in
**us-east-1**. Pass `acm_certificate_arn` (created via a `us-east-1` provider
alias in the env root) and optionally `web_acl_arn` (a `CLOUDFRONT`-scoped WAFv2
ACL, also us-east-1). Without them CloudFront uses its default cert/no-WAF.

Outputs: `bucket`, `distribution_id`, `distribution_domain` (deploy target +
smoke URL).
