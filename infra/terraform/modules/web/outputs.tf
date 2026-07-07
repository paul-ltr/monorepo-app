output "bucket" {
  value = aws_s3_bucket.web.bucket
}
output "distribution_id" {
  value = aws_cloudfront_distribution.web.id
}
output "distribution_domain" {
  value = aws_cloudfront_distribution.web.domain_name
}
output "distribution_hosted_zone_id" {
  value = aws_cloudfront_distribution.web.hosted_zone_id
}
