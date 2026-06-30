output "queue_arns" {
  value = { for k, q in aws_sqs_queue.main : k => q.arn }
}
output "queue_urls" {
  value = { for k, q in aws_sqs_queue.main : k => q.url }
}
output "event_bus_arn" {
  value = aws_cloudwatch_event_bus.this.arn
}
