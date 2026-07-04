# site module

Hosting for the public **marketing site** (`apps/site`, static HTML/CSS/JS):
a private, versioned, public-access-blocked S3 bucket fronted by CloudFront with
Origin Access Control. The site does client-side view switching, so 403/404 both
fall back to `/index.html`. Managed CachingOptimized policy, compression,
PriceClass_100 (EU/NA edges, cost).

Separate from the `web` module (the operator console app) so the two deploy
independently and can carry different domains — `lavopilot.fr` (this) vs
`app.lavopilot.fr` (web). The site's login button points at the web app's
`/login` and its demo form POSTs to the API's public `POST /public/leads`.

**Custom domain:** pass `domain_aliases` + `acm_certificate_arn` (ACM cert must
be in **us-east-1** for CloudFront) and optionally a `CLOUDFRONT`-scoped
`web_acl_arn`. Without them CloudFront uses its default cert/domain and no WAF.

**Deploy:** `aws s3 sync apps/site s3://<bucket>` then a CloudFront invalidation.

Outputs: `bucket`, `distribution_id`, `distribution_domain`.
